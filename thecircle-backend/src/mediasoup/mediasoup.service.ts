import {Injectable, Logger, OnModuleDestroy,} from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import * as os from 'os';
import {UserService} from '../user/user.service';
import {TransparencyReward} from './mediasoup.types';

// Types for mediasoup
type MediasoupWorker = {
    worker: mediasoup.types.Worker;
    router: mediasoup.types.Router;
    isActive: boolean;
};

type TransportInfo = {
    id: string;
    type: 'webrtc' | 'plain';
    transport: mediasoup.types.WebRtcTransport | mediasoup.types.PlainTransport;
    producer?: mediasoup.types.Producer;
    consumers: Map<string, mediasoup.types.Consumer>;
};

export interface StreamerInfo {
    id: string;
    socket: any;
    username: string;
    transport: TransportInfo;
    streamId: string;
    isStreaming: boolean;
    producers: Map<string, mediasoup.types.Producer>;
    isTransparent: boolean;
    lastTransparencyCheck: number;
    videoRotation: number;
    videoMirrored: boolean;
}

type ViewerInfo = {
    id: string;
    socket: any;
    transport: TransportInfo;
    streamId: string;
    streamsWatching?: number;
};

type StreamInfo = {
    streamId: string;
    streamer: StreamerInfo;
    viewers: Map<string, ViewerInfo>;
    router: mediasoup.types.Router;
    tags?: string[];
    viewerCount?: number;
    videoRotation?: number;
    videoMirrored?: boolean;
};

@Injectable()
export class MediasoupService implements OnModuleDestroy {
    private readonly logger = new Logger(MediasoupService.name);
    private workers: MediasoupWorker[] = [];
    private streams = new Map<string, StreamInfo>();
    private currentWorkerIndex = 0;
    private viewerStreamsWatching = new Map<string, number>();

    constructor(
        private readonly userService: UserService
    ) {
    }

    private getLocalIpAddress(): string {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            const iface = interfaces[name];
            if (iface) {
                for (const alias of iface) {
                    if (alias.family === 'IPv4' && !alias.internal) {
                        return alias.address;
                    }
                }
            }
        }
        return '127.0.0.1'; // fallback
    }

    private getConfig() {
        return {
            numWorkers: 1, // For local development
            workerSettings: {
                logLevel: 'warn' as mediasoup.types.WorkerLogLevel,
                logTags: [
                    'info',
                    'ice',
                    'dtls',
                    'rtp',
                    'srtp',
                    'rtcp',
                ] as mediasoup.types.WorkerLogTag[],
                rtcMinPort: 10000,
                rtcMaxPort: 10100,
            },
            routerOptions: {
                mediaCodecs: [
                    {
                        kind: 'audio' as mediasoup.types.MediaKind,
                        mimeType: 'audio/opus',
                        clockRate: 48000,
                        channels: 2,
                    },
                    {
                        kind: 'video' as mediasoup.types.MediaKind,
                        mimeType: 'video/VP8',
                        clockRate: 90000,
                        parameters: {
                            'x-google-start-bitrate': 1000,
                        },
                    },
                    {
                        kind: 'video' as mediasoup.types.MediaKind,
                        mimeType: 'video/H264',
                        clockRate: 90000,
                        parameters: {
                            'packetization-mode': 1,
                            'profile-level-id': '42e01f',
                            'level-asymmetry-allowed': 1,
                        },
                    },
                ],
            },
            webRtcTransportOptions: {
                listenIps: [
                    {
                        ip: '0.0.0.0',
                        announcedIp: this.getLocalIpAddress(),
                    },
                ],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: 1000000,
                iceServers: [
                    {
                        urls: [
                            'stun:stun.l.google.com:19302',
                            'stun:stunq.l.google.com:19302',
                            'stun:stun2.l.google.com:19302',
                            'stun:stun3.l.google.com:19302',
                            'stun:stun4.l.google.com:19302',
                        ],
                    },
                ],
            },
        };
    }

    // In mediasoup.service.ts
    private transparencyRewards = new Map<string, TransparencyReward>();

    // Methode om transparantie te updaten
    private updateTransparency(userId: string): number {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 1 uur in milliseconden
        const resetTimeout = 1.5 * oneHour; // 1.5 uur timeout

        let reward = this.transparencyRewards.get(userId);

        if (!reward) {
            reward = {
                userId,
                currentHourlyRate: 1,
                consecutiveHours: 1,
                lastActiveTimestamp: now,
                totalEarned: 0
            };
            this.transparencyRewards.set(userId, reward);
        }

        const timeSinceLastActive = now - reward.lastActiveTimestamp;

        if (timeSinceLastActive > resetTimeout) {
            // Meer dan 1.5 uur inactief, reset
            reward.currentHourlyRate = 1;
            reward.consecutiveHours = 1;
        } else if (timeSinceLastActive >= oneHour) {
            // Minstens 1 uur actief, verhoog beloning
            reward.consecutiveHours++;
            reward.currentHourlyRate = Math.min(Math.pow(2, reward.consecutiveHours - 1), 64); // Max 64 satoshis/uur
        }

        reward.lastActiveTimestamp = now;
        reward.totalEarned += reward.currentHourlyRate;

        this.transparencyRewards.set(userId, reward);
        return reward.currentHourlyRate;
    }

    // Methode om beloning op te halen
    public getTransparencyReward(userId: string): TransparencyReward | null {
        return this.transparencyRewards.get(userId) || null;
    }

    private transparencyCheckInterval: NodeJS.Timeout;

    async onModuleInit() {
        const localIp = this.getLocalIpAddress();
        this.logger.log(`Detected local IP address: ${localIp}`);
        await this.createWorkers();

        this.transparencyCheckInterval = setInterval(() => {
            this.checkTransparencyRewards();
        }, 60 * 60 * 1000); // Elk uur
    }

    private checkTransparencyRewards() {
        try {
            this.logger.log('Transparency check interval running at: ' + new Date().toISOString());

            for (const [streamId, stream] of this.streams.entries()) {
                try {
                    this.logger.log(`Checking stream ${streamId} - Transparent: ${stream.streamer.isTransparent}, Streaming: ${stream.streamer.isStreaming}`);

                    if (stream.streamer.isTransparent && stream.streamer.isStreaming) {
                        const reward = this.updateTransparency(stream.streamer.id);
                        const rewardData = this.transparencyRewards.get(stream.streamer.id);

                        this.logger.log(`Transparency reward for ${stream.streamer.username}: ${reward} satoshis this hour`);

                        try {
                            if (stream.streamer.socket && stream.streamer.socket.readyState === WebSocket.OPEN) {
                                stream.streamer.socket.send(JSON.stringify({
                                    event: 'transparency-reward',
                                    data: {
                                        currentRate: reward,
                                        totalEarned: rewardData?.totalEarned || 0,
                                        consecutiveMinutes: rewardData?.consecutiveHours || 1
                                    }
                                }));
                                this.logger.log(`Reward update sent to ${stream.streamer.username}`);
                            } else {
                                this.logger.warn(`Socket not ready for ${stream.streamer.username}`);
                            }
                        } catch (e) {
                            this.logger.error(`Error sending reward update: ${e.message}`);
                        }
                    } else {
                        this.logger.log(`Stream ${streamId} is not transparent or not streaming, skipping reward update.`);
                    }
                } catch (e) {
                    this.logger.error(`Error processing transparency for stream ${streamId}: ${e.message}`);
                }
            }
        } catch (e) {
            this.logger.error(`Error in transparency check interval: ${e.message}`);
        }

    }

    async onModuleDestroy() {
        await this.closeWorkers();
        await this.closeAllStreams();
    }

    private async createWorkers() {
        for (let i = 0; i < this.getConfig().numWorkers; i++) {
            const worker = await mediasoup.createWorker({
                logLevel: this.getConfig().workerSettings.logLevel,
                logTags: this.getConfig().workerSettings.logTags,
                rtcMinPort: this.getConfig().workerSettings.rtcMinPort,
                rtcMaxPort: this.getConfig().workerSettings.rtcMaxPort,
            });

            const router = await worker.createRouter({
                mediaCodecs: this.getConfig().routerOptions.mediaCodecs,
            });

            this.workers.push({
                worker,
                router,
                isActive: true,
            });

            this.logger.log(`Worker ${i} created`);
        }
    }

    private async closeWorkers() {
        for (const workerInfo of this.workers) {
            workerInfo.worker.close();
        }
        this.workers = [];
    }

    private getNextWorker(): MediasoupWorker {
        const worker = this.workers[this.currentWorkerIndex];
        this.currentWorkerIndex =
            (this.currentWorkerIndex + 1) % this.workers.length;
        return worker;
    }

    async createStream(
        streamId: string,
        streamerId: string,
        streamerSocket: any,
        username: string,
        tags?: string[],
        viewerCount?: number,
    ): Promise<StreamInfo> {
        const worker = this.getNextWorker();
        const router = worker.router;
        this.transparencyRewards.delete(streamerId);
        const streamInfo: StreamInfo = {
            streamId,
            streamer: {
                id: streamerId,
                socket: streamerSocket,
                username,
                transport: {
                    id: '',
                    type: 'webrtc',
                    transport: null as any,
                    consumers: new Map(),
                },
                streamId,
                isStreaming: false,
                producers: new Map(),
                isTransparent: false,
                lastTransparencyCheck: Date.now(),
                videoRotation: 0,
                videoMirrored: false,
            },
            viewers: new Map(),
            router,
            tags: tags || [],
            viewerCount: viewerCount || 0,
            videoRotation: 0,
            videoMirrored: false,
        };

        this.streams.set(streamId, streamInfo);
        this.logger.log(`Stream created: ${streamId}`);
        return streamInfo;
    }

    async createWebRtcTransport(
        streamId: string,
        isStreamer: boolean,
        streamerId: string,
        clientId?: string,
    ): Promise<any> {
        const stream = this.streams.get(streamerId);
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }

        const transportOptions = this.getConfig().webRtcTransportOptions;
        this.logger.log(`Creating WebRTC transport with options:`, {
            listenIps: transportOptions.listenIps,
            iceServers: transportOptions.iceServers,
            enableUdp: transportOptions.enableUdp,
            enableTcp: transportOptions.enableTcp,
        });

        const transport =
            await stream.router.createWebRtcTransport(transportOptions);

        const transportInfo: TransportInfo = {
            id: transport.id,
            type: 'webrtc',
            transport,
            consumers: new Map(),
        };

        if (isStreamer) {
            stream.streamer.transport = transportInfo;
        } else {
            // Store transport for viewer
            if (clientId) {
                const viewer = stream.viewers.get(clientId);
                if (viewer) {
                    viewer.transport = transportInfo;
                    this.logger.log(
                        `Transport ${transport.id} stored for viewer ${clientId}`,
                    );
                } else {
                    this.logger.warn(
                        `Viewer ${clientId} not found when creating transport`,
                    );
                }
            }
        }

        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        };
    }

    async connectTransport(
        streamId: string,
        transportId: string,
        dtlsParameters: any,
        isStreamer: boolean,
    ): Promise<void> {

        const stream = this.streams.get(streamId);
        if (!stream) {
            console.log('[CONNECT] Stream not found:', streamId);
            throw new Error(`Stream ${streamId} not found`);
        }

        let transport: mediasoup.types.WebRtcTransport | undefined;
        if (isStreamer) {
            transport = stream.streamer.transport
                .transport as mediasoup.types.WebRtcTransport;
            // console.log('[CONNECT] Found streamer transport:', transport.id);
        } else {
            // Find viewer transport
            for (const viewer of stream.viewers.values()) {
                if (viewer.transport.id === transportId) {
                    transport = viewer.transport
                        .transport as mediasoup.types.WebRtcTransport;
                    // console.log('[CONNECT] Found viewer transport:', transport.id);
                    break;
                }
            }
        }

        if (!transport) {
            console.log('[CONNECT] Transport not found:', transportId);
            throw new Error(`Transport ${transportId} not found`);
        }

        // console.log('[CONNECT] Connecting transport with dtlsParameters:', dtlsParameters);
        await transport.connect({dtlsParameters});
        console.log('[CONNECT] Transport connected successfully');
    }

    async createProducer(
        streamId: string,
        transportId: string,
        kind: 'audio' | 'video',
        rtpParameters: any,
    ): Promise<any> {
        const stream = this.streams.get(streamId);
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }

        const transport = stream.streamer.transport
            .transport as mediasoup.types.WebRtcTransport;
        if (transport.id !== transportId) {
            throw new Error(`Transport ${transportId} not found`);
        }

        const producer = await transport.produce({
            kind,
            rtpParameters,
        });

        stream.streamer.producers.set(kind, producer);

        if (!stream.streamer.isStreaming) {
            stream.streamer.isStreaming = true;
            this.logger.log(`Stream ${streamId} is now live.`);
        }

        this.logger.log(
            `Producer created: ${producer.id} (${kind}) for stream: ${streamId}`,
        );

        return {
            id: producer.id,
            kind: producer.kind,
        };
    }

    async createConsumer(
        streamId: string,
        viewerId: string,
        transportId: string,
        rtpCapabilities: any,
    ): Promise<any> {
        console.log('[SERVICE] createConsumer called with:', {
            streamId,
            viewerId,
            transportId,
        });

        const stream = this.streams.get(streamId);
        if (!stream) {
            console.log('[SERVICE] Stream not found:', streamId);
            throw new Error(`Stream ${streamId} not found`);
        }

        const viewer = stream.viewers.get(viewerId);
        if (!viewer) {
            console.log('[SERVICE] Viewer not found:', viewerId);
            throw new Error(`Viewer ${viewerId} not found`);
        }

        const transport = viewer.transport
            .transport as mediasoup.types.WebRtcTransport;
        if (transport.id !== transportId) {
            console.log('[SERVICE] Transport ID mismatch:', {
                expected: transport.id,
                received: transportId,
            });
            throw new Error(`Transport ${transportId} not found`);
        }

        console.log(
            '[SERVICE] Stream has producers:',
            stream.streamer.producers.size,
        );
        if (stream.streamer.producers.size === 0) {
            console.log('[SERVICE] No producers available');
            throw new Error(`No producers available for stream ${streamId}`);
        }

        // Create consumers for all available producers
        const consumers: Array<{
            id: string;
            kind: mediasoup.types.MediaKind;
            rtpParameters: mediasoup.types.RtpParameters;
            type: mediasoup.types.ConsumerType;
            producerId: string;
        }> = [];

        for (const [kind, producer] of stream.streamer.producers.entries()) {
            console.log('[SERVICE] Creating consumer for producer:', {
                kind,
                producerId: producer.id,
            });

            const consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities,
                paused: false,
            });

            viewer.transport.consumers.set(consumer.id, consumer);
            consumers.push({
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerId: consumer.producerId,
            });

            this.logger.log(
                `Consumer created: ${consumer.id} (${kind}) for viewer: ${viewerId}`,
            );
        }

        // console.log('[SERVICE] Returning consumers:', consumers);
        return consumers;
    }

    async addViewer(
        streamId: string,
        viewerId: string,
        viewerSocket: any,
    ): Promise<ViewerInfo> {
        // console.log(this.streams)
        const stream = this.streams.get(streamId);
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }

        const currentWatching = this.viewerStreamsWatching.get(viewerId) || 0;
        if (currentWatching >= 4) {
            this.logger.warn(`Viewer ${viewerId} is already watching 4 streams`);
            throw new Error(`You can only watch up to 4 streams at a time.`);
        }
        this.viewerStreamsWatching.set(viewerId, currentWatching + 1);
        const viewerInfo: ViewerInfo = {
            id: viewerId,
            socket: viewerSocket,
            transport: {
                id: '',
                type: 'webrtc',
                transport: null as any,
                consumers: new Map(),
            },
            streamId,
        };

        console.log(
            `[SERVICE] Viewer ${viewerId} is now watching ${currentWatching + 1} streams. `,
        );
        stream.viewers.set(viewerId, viewerInfo);
        this.logger.log(`Viewer ${viewerId} added to stream ${streamId}`);
        return viewerInfo;
    }

    async removeViewer(streamId: string, viewerId: string): Promise<void> {
        const stream = this.streams.get(streamId);
        if (!stream) {
            return;
        }

        const viewer = stream.viewers.get(viewerId);
        if (viewer) {
            // Close all consumers
            const currentWatching = this.viewerStreamsWatching.get(viewerId) || 0;
            this.viewerStreamsWatching.set(viewerId, currentWatching - 1);
            console.log(
                `[SERVICE] Viewer ${viewerId} is now watching ${currentWatching - 1} streams.`,
            );
            for (const consumer of viewer.transport.consumers.values()) {
                consumer.close();
            }
            viewer.transport.consumers.clear();

            // Close transport
            if (viewer.transport.transport) {
                viewer.transport.transport.close();
            }

            stream.viewers.delete(viewerId);
            this.logger.log(`Viewer ${viewerId} removed from stream ${streamId}`);
        }
    }

    async closeStream(streamId: string): Promise<void> {
        const stream = this.streams.get(streamId);
        if (!stream) {
            return;
        }

        // Bereken en sla satoshis op
        const reward = this.transparencyRewards.get(stream.streamer.id);
        if (reward) {
            try {
                await this.userService.updateSatoshis(stream.streamer.id, reward.totalEarned);
                this.logger.log(`Saved ${reward.totalEarned} satoshis for ${stream.streamer.username}`);
            } catch (error) {
                this.logger.error(`Error saving satoshis: ${error.message}`);
            }
            this.transparencyRewards.delete(stream.streamer.id);
        }

        // Close all viewers
        for (const viewerId of stream.viewers.keys()) {
            await this.removeViewer(streamId, viewerId);
        }

        // Close all streamer producers
        for (const producer of stream.streamer.producers.values()) {
            producer.close();
        }
        stream.streamer.producers.clear();

        // Close streamer transport
        if (stream.streamer.transport.transport) {
            stream.streamer.transport.transport.close();
        }

        this.streams.delete(streamId);
        this.logger.log(`Stream ${streamId} closed`);
    }

    private async closeAllStreams(): Promise<void> {
        for (const streamId of this.streams.keys()) {
            await this.closeStream(streamId);
        }
    }

    async getActiveStreams(): Promise<
        {
            streamId: string;
            streamerName: string | undefined;
            tags: string[] | undefined;
            viewerCount: number | undefined;
        }[]
    > {
        // Return an array of objects with streamId and streamerName
        return Array.from(this.streams.values()).map((stream) => ({
            streamId: stream.streamId,
            streamerName: stream.streamer.username,
            tags: stream.tags,
            viewerCount: stream.viewerCount,
        }));
    }

    async getStreamInfo(streamId: string): Promise<StreamInfo | null> {
        return this.streams.get(streamId) || null;
    }

    async getRtpCapabilities(streamId: string): Promise<any> {
        const stream = this.streams.get(streamId);
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }

        return stream.router.rtpCapabilities;
    }

    async setTransparency(streamId: string, transparent: boolean): Promise<void> {
        const stream = this.streams.get(streamId);
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }

        stream.streamer.isTransparent = transparent;
        this.logger.log(`Transparency set to ${transparent} for stream ${streamId}`);

        // Reset reward tracking when turning off transparency
        if (!transparent) {
            const reward = this.transparencyRewards.get(stream.streamer.id);
            if (reward) {
                reward.currentHourlyRate = 1;
                reward.consecutiveHours = 1;
            }
        }
    }
}
