import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { MediasoupService } from './mediasoup.service';
import { StreamService } from '../stream/stream.service';
import { Types } from 'mongoose';
import { Actor } from '../stream/stream.interface';

interface Client {
    id: string;
    socket: WebSocket;
    type: 'streamer' | 'viewer';
    streamId?: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class MediasoupGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(MediasoupGateway.name);
    private clients = new Map<string, Client>();

    constructor(private readonly mediasoupService: MediasoupService, private readonly streamService: StreamService) {
    }

    handleConnection(client: WebSocket) {
        this.logger.log('[WS] New connection established');
    }

    handleDisconnect(client: WebSocket) {
        const clientId = this.findClientIdBySocket(client);
        if (!clientId) return;

        const clientInfo = this.clients.get(clientId);
        if (!clientInfo) return;

        this.logger.log(`[WS] Connection closed for clientId=${clientId}`);

        if (clientInfo.type === 'streamer' && clientInfo.streamId) {
            this.handleStreamerDisconnect(clientInfo.streamId, clientId);
        } else if (clientInfo.type === 'viewer' && clientInfo.streamId) {
            this.handleViewerDisconnect(clientInfo.streamId, clientId);
        }

        this.clients.delete(clientId);
    }

    private findClientIdBySocket(socket: WebSocket): string | null {
        for (const [clientId, client] of this.clients.entries()) {
            if (client.socket === socket) {
                return clientId;
            }
        }
        return null;
    }

    private async handleStreamerDisconnect(streamId: string, streamerId: string) {
        try {
            // Get stream info for tags
            const stream = await this.mediasoupService.getStreamInfo(streamId);
            const tags = stream?.tags || [];
            // Log the stream-ended event
            const streamerObjectId = new Types.ObjectId(streamerId);
            await this.streamService.createEvent(
                streamerObjectId,
                {
                    id: streamerObjectId,
                    actor: Actor.STREAMER,
                    tags,
                    event: 'stream-ended',
                }
            );
            await this.mediasoupService.closeStream(streamId);

            // Notify all viewers that stream ended
            this.server.clients.forEach((clientSocket) => {
                if (clientSocket.readyState === WebSocket.OPEN) {
                    clientSocket.send(
                        JSON.stringify({
                            event: 'stream-ended',
                            data: {streamId},
                        }),
                    );
                }
            });
            await this.broadcastStreamListUpdate(); // Re-broadcast the list after a stream ends


            this.logger.log(
                `[CLEANUP] Streamer ${streamerId} disconnected, streamId=${streamId} removed`,
            );
        } catch (error) {
            this.logger.error(`Error handling streamer disconnect: ${error.message}`);
        }
    }

    private async handleViewerDisconnect(streamId: string, viewerId: string) {
        // Remove viewer from the stream
        const stream = await this.mediasoupService.getStreamInfo(streamId);

        if (stream) {
            const streamer = stream.streamer;
            streamer.socket.send(
                JSON.stringify({
                    event: 'viewer-left',
                    data: {viewerId},
                }),
            );

            try {
                const tags = stream?.tags || [];
                const streamerObjectId = new Types.ObjectId(streamId);
                const viewerObjectId = new Types.ObjectId(viewerId);
                await this.streamService.createEvent(
                    streamerObjectId,
                    {
                        id: viewerObjectId,
                        actor: Actor.VIEWER,
                        tags,
                        event: 'viewer-left',
                    }
                );
            } catch (error) {
                this.logger.error(`Error logging stream-paused event: ${error.message}`);
            }

        }

        try {
            await this.mediasoupService.removeViewer(streamId, viewerId);
            this.logger.log(
                `[CLEANUP] Viewer ${viewerId} disconnected from streamId=${streamId}`,
            );
        } catch (error) {
            this.logger.error(`Error handling viewer disconnect: ${error.message}`);
        }
    }

    @SubscribeMessage('register')
    async handleRegister(
        @MessageBody()
        data: {
            id: string;
            clientType: string;
            streamId: string;
            streamerId?: string;
            username: string;
            tags?: string[];
            viewerCount?: number;
        },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {
            id,
            clientType,
            streamId,
            streamerId,
            username,
            tags,
            viewerCount,
        } = data;

        // If streamerId is provided (for viewers), use it as the stream owner reference
        const effectiveStreamId = streamerId || streamId;

        const client: Client = {
            id,
            socket,
            type: clientType as 'streamer' | 'viewer',
            streamId: effectiveStreamId,
        };

        this.clients.set(id, client);
        this.logger.log(
            `[REGISTER] ${clientType} registered with id=${id}, streamId=${effectiveStreamId}`,
        );

        if (clientType === 'streamer' && effectiveStreamId) {
            try {
                await this.mediasoupService.createStream(
                    id,
                    effectiveStreamId,
                    socket,
                    username,
                    tags,
                    0,
                );

                // Check if stream already exists for this streamer
                const streamerObjectId = new Types.ObjectId(id);
                const streamExists = await this.streamService.doesStreamExist(streamerObjectId);

                if (streamExists) {
                    // Just create a "stream-started" event for the existing stream (by streamerId)
                    await this.streamService.createEvent(
                        streamerObjectId,
                        {
                            id: streamerObjectId,
                            actor: Actor.STREAMER,
                            tags: tags || [],
                            event: 'stream-started',
                        }
                    );
                } else {
                    // Create the stream as before
                    await this.streamService.createStream({
                        streamerId: streamerObjectId,
                        events: [
                            {
                                id: streamerObjectId,
                                actor: Actor.STREAMER,
                                tags: tags || [],
                                event: 'stream-started',
                                timeStamp: new Date(),
                            },
                        ],
                    });
                }

                this.logger.log(
                    `[STREAMS] Streamer registered streamId=${effectiveStreamId}`,
                );
                // Send confirmation to streamer
                socket.send(
                    JSON.stringify({
                        event: 'registered',
                        data: {streamId: effectiveStreamId, clientType: 'streamer'},
                    }),
                );
            } catch (error) {
                this.logger.error(`Error creating stream: ${error.message}`);
                socket.send(
                    JSON.stringify({
                        event: 'error',
                        data: {message: 'Failed to create stream'},
                    }),
                );
            }
        } else if (clientType === 'viewer' && effectiveStreamId) {
            try {
                console.log(
                    `[STREAMS] Viewer ${id} joining streamId=${effectiveStreamId}`,
                );
                await this.mediasoupService.addViewer(effectiveStreamId, id, socket);

                // Log the viewer-joined event
                try {
                    const stream = await this.mediasoupService.getStreamInfo(streamId);
                    const tags = stream?.tags || [];
                    const streamerObjectId = new Types.ObjectId(effectiveStreamId);
                    const viewerObjectId = new Types.ObjectId(id);
                    await this.streamService.createEvent(
                        streamerObjectId,
                        {
                            id: viewerObjectId,
                            actor: Actor.VIEWER,
                            tags,
                            event: 'viewer-joined',
                        }
                    );
                } catch (error) {
                    this.logger.error(`Error logging stream-paused event: ${error.message}`);
                }

                this.logger.log(
                    `[STREAMS] Viewer ${id} joined streamId=${effectiveStreamId}`,
                );

                // Send confirmation to viewer
                socket.send(
                    JSON.stringify({
                        event: 'registered',
                        data: {streamId: effectiveStreamId, clientType: 'viewer'},
                    }),
                );
                // Send current video rotation and mirroring state to the viewer
                const stream = await this.mediasoupService.getStreamInfo(effectiveStreamId);
                if (stream) {
                    socket.send(
                        JSON.stringify({
                            event: 'video-rotation',
                            data: { streamId: effectiveStreamId, rotation: stream.streamer.videoRotation ?? 0 },
                        })
                    );
                    socket.send(
                        JSON.stringify({
                            event: 'video-mirror',
                            data: { streamId: effectiveStreamId, mirrored: !!stream.streamer.videoMirrored },
                        })
                    );
                }
                // Notify streamer about new viewer
                if (stream) {
                    stream.streamer.socket.send(
                        JSON.stringify({
                            event: 'viewer-joined',
                            data: {viewerId: id},
                        }),
                    );
                    // If the stream is currently paused, notify the new viewer
                    if (!stream.streamer.isStreaming) {
                        socket.send(
                            JSON.stringify({
                                event: 'stream-paused',
                                data: {streamId: effectiveStreamId},
                            }),
                        );
                    }
                }
            } catch (error) {
                this.logger.error(`Error adding viewer: ${error.message}`);
                if (error.message === 'You can only watch up to 4 streams at a time.') {
                    console.log(
                        `[STREAMS] Viewer ${id} reached max streams limit for streamId=${effectiveStreamId}`,
                    );
                    socket.send(
                        JSON.stringify({
                            event: 'maxStreamsReached',
                            data: {message: error.message},
                        }),
                    );
                } else {
                    socket.send(
                        JSON.stringify({
                            event: 'error',
                            data: {message: 'Failed to join stream'},
                        }),
                    );
                }
            }
        }
    }

    @SubscribeMessage('get-streams')
    async handleGetStreams(@ConnectedSocket() socket: WebSocket) {
        this.logger.log('[STREAMS] get-streams requested');
        try {
            const activeStreams = await this.mediasoupService.getActiveStreams();
            socket.send(
                JSON.stringify({
                    event: 'streams',
                    data: {streams: activeStreams},
                }),
            );
            this.logger.log('[STREAMS] Stream list sent:', activeStreams);
        } catch (error) {
            this.logger.error(`Error getting streams: ${error.message}`);
            socket.send(
                JSON.stringify({
                    event: 'error',
                    data: {message: 'Failed to get streams'},
                }),
            );
        }
    }

    private async broadcastStreamListUpdate() {
        try {
            const activeStreams = await this.mediasoupService.getActiveStreams();
            this.server.clients.forEach((clientSocket) => {
                if (clientSocket.readyState === WebSocket.OPEN) {
                    clientSocket.send(
                        JSON.stringify({
                            event: 'streams',
                            data: {streams: activeStreams},
                        }),
                    );
                }
            });
            this.logger.log('[BROADCAST] Updated stream list sent to all clients.');
        } catch (error) {
            this.logger.error(
                `Error broadcasting stream list update: ${error.message}`,
            );
        }
    }

  @SubscribeMessage('stream')
  async sendStream(
    @MessageBody()
    data: {
      streamId: string,
      streamerName: string,
      tags: string[] | undefined,
      viewerCount: string,
    },
    @ConnectedSocket() socket: WebSocket,
  ) {

    const { streamId, streamerName, tags, viewerCount } = data;

    const stream = await this.mediasoupService.getStreamInfo(streamId);
    if (!stream) return;

    for (const [viewerId, viewer] of stream.viewers.entries()) {
      if (viewer.socket.readyState === WebSocket.OPEN) {
        viewer.socket.send(
          JSON.stringify({
            event: 'stream',
            data: { streamId, streamerName, tags, viewerCount },
          }),
        );
      }
    }
    console.log('[STREAMS] send stream');
  }

  private async broadcastStreamListUpdate() {
    try {
      const activeStreams = await this.mediasoupService.getActiveStreams();
      this.server.clients.forEach((clientSocket) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(
            JSON.stringify({
              event: 'streams',
              data: { streams: activeStreams },
            }),
          );
        }
      });
      this.logger.log('[BROADCAST] Updated stream list sent to all clients.');
    } catch (error) {
      this.logger.error(
        `Error broadcasting stream list update: ${error.message}`,
      );
    }
  }

    @SubscribeMessage('get-rtp-capabilities')
    async handleGetRtpCapabilities(
        @MessageBody() data: { streamId: string },
        @ConnectedSocket() socket: WebSocket,
    ) {
        console.log('Getting RTP capabilities with streamId:', data.streamId);
        const {streamId} = data;
        try {
            const rtpCapabilities =
                await this.mediasoupService.getRtpCapabilities(streamId);
            socket.send(
                JSON.stringify({
                    event: 'rtp-capabilities',
                    data: {rtpCapabilities},
                }),
            );
        } catch (error) {
            this.logger.error(`Error getting RTP capabilities: ${error.message}`);
            socket.send(
                JSON.stringify({
                    event: 'error',
                    data: {message: 'Failed to get RTP capabilities'},
                }),
            );
        }
    }

    @SubscribeMessage('create-transport')
    async handleCreateTransport(
        @MessageBody()
        data: { streamId: string; isStreamer: boolean; streamerId: string },
        @ConnectedSocket() socket: WebSocket,
    ) {
        console.log(
            'Creating transport with streamId:',
            data.streamId,
            'and isStreamer:',
            data.isStreamer,
            'for streamerId:',
            data.streamerId,
        );
        const {streamId, isStreamer, streamerId} = data;
        const clientId = this.findClientIdBySocket(socket);

        try {
            const transport = await this.mediasoupService.createWebRtcTransport(
                streamId,
                isStreamer,
                streamerId,
                clientId || undefined,
            );
            socket.send(
                JSON.stringify({
                    event: 'transport-created',
                    data: {transport},
                }),
            );
        } catch (error) {
            this.logger.error(`Error creating transport: ${error.message}`);
            socket.send(
                JSON.stringify({
                    event: 'error',
                    data: {message: 'Failed to create transport'},
                }),
            );
        }
    }

    @SubscribeMessage('connect-transport')
    async handleConnectTransport(
        @MessageBody()
        data: {
            streamId: string;
            transportId: string;
            dtlsParameters: any;
            isStreamer: boolean;
        },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId, transportId, dtlsParameters, isStreamer} = data;
        try {
            await this.mediasoupService.connectTransport(
                streamId,
                transportId,
                dtlsParameters,
                isStreamer,
            );
            socket.send(
                JSON.stringify({
                    event: 'transport-connected',
                    data: {transportId},
                }),
            );
        } catch (error) {
            this.logger.error(`Error connecting transport: ${error.message}`);
            socket.send(
                JSON.stringify({
                    event: 'error',
                    data: {message: 'Failed to connect transport'},
                }),
            );
        }
    }

    @SubscribeMessage('produce')
    async handleProduce(
        @MessageBody()
        data: {
            streamId: string;
            transportId: string;
            kind: 'audio' | 'video';
            rtpParameters: any;
        },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId, transportId, kind, rtpParameters} = data;
        try {
            const producer = await this.mediasoupService.createProducer(
                streamId,
                transportId,
                kind,
                rtpParameters,
            );
            socket.send(
                JSON.stringify({
                    event: 'produced',
                    data: {producer},
                }),
            );
            await this.broadcastStreamListUpdate();
        } catch (error) {
            this.logger.error(`Error creating producer: ${error.message}`);
            socket.send(
                JSON.stringify({
                    event: 'error',
                    data: {message: 'Failed to create producer'},
                }),
            );
        }
    }

    @SubscribeMessage('consume')
    async handleConsume(
        @MessageBody()
        data: { streamId: string; transportId: string; rtpCapabilities: any },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId, transportId, rtpCapabilities} = data;
        const clientId = this.findClientIdBySocket(socket);

        console.log('[CONSUME] Received consume request:', {
            streamId,
            transportId,
            clientId,
        });

        if (!clientId) {
            console.log('[CONSUME] Client not found for socket');
            socket.send(
                JSON.stringify({
                    event: 'error',
                    data: {message: 'Client not found'},
                }),
            );
            return;
        }

        this.logger.log(
            `[CONSUME] Viewer ${clientId} requesting to consume from stream ${streamId}`,
        );

        try {
            const consumers = await this.mediasoupService.createConsumer(
                streamId,
                clientId,
                transportId,
                rtpCapabilities,
            );
            this.logger.log(
                `[CONSUME] Created ${consumers.length} consumers for viewer ${clientId}`,
            );
            console.log(
                '[CONSUME] Sending consumed event with consumers:',
                consumers,
            );
            socket.send(
                JSON.stringify({
                    event: 'consumed',
                    data: {consumer: consumers},
                }),
            );
        } catch (error) {
            this.logger.error(`Error creating consumer: ${error.message}`);
            console.log('[CONSUME] Error creating consumer:', error);
            socket.send(
                JSON.stringify({
                    event: 'error',
                    data: {message: 'Failed to create consumer'},
                }),
            );
        }
    }

    @SubscribeMessage('resume-consumer')
    async handleResumeConsumer(
        @MessageBody() data: { streamId: string; consumerId: string },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId, consumerId} = data;
        const clientId = this.findClientIdBySocket(socket);
        if (!clientId) return;

        try {
            const stream = await this.mediasoupService.getStreamInfo(streamId);
            if (!stream) return;

            const viewer = stream.viewers.get(clientId);
            if (!viewer) return;

            const consumer = viewer.transport.consumers.get(consumerId);
            if (consumer) {
                await consumer.resume();
                socket.send(
                    JSON.stringify({
                        event: 'consumer-resumed',
                        data: {consumerId},
                    }),
                );
            }
        } catch (error) {
            this.logger.error(`Error resuming consumer: ${error.message}`);
        }
    }

    @SubscribeMessage('end-stream')
    async handleEndStream(
        @MessageBody() data: { streamId: string },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId} = data;
        const clientId = this.findClientIdBySocket(socket);
        if (!clientId) return;

        try {
            // Get stream info for tags
            const stream = await this.mediasoupService.getStreamInfo(streamId);
            const tags = stream?.tags || [];
            // Log the stream-ended event
            const streamerObjectId = new Types.ObjectId(clientId);
            await this.streamService.createEvent(
                streamerObjectId,
                {
                    id: streamerObjectId,
                    actor: Actor.STREAMER,
                    tags,
                    event: 'stream-ended',
                }
            );
            await this.mediasoupService.closeStream(streamId);
            this.logger.log(
                `[END-STREAM] Streamer ${clientId} ended streamId=${streamId}`,
            );
            await this.broadcastStreamListUpdate();
        } catch (error) {
            this.logger.error(`Error ending stream: ${error.message}`);
        }
    }

    @SubscribeMessage('chat-message')
    async handleChatMessage(
        @MessageBody()
        data: {
            streamId: string;
            senderId: string;
            sender: string;
            message: string;
            timestamp: Date;
            signature: string;
            deviceId: string;
        },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId, sender, senderId, message, timestamp, signature, deviceId} =
            data;

        // Get stream info from mediasoupService
        const stream = await this.mediasoupService.getStreamInfo(streamId);
        if (!stream) return;

        // Collect all client IDs in the room (streamer + viewers)
        const recipientIds = [
            stream.streamer.id,
            ...Array.from(stream.viewers.keys()),
        ];

        recipientIds.forEach((clientId) => {
            const client = this.clients.get(clientId);
            if (client && client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(
                    JSON.stringify({
                        event: 'chat-message',
                        data: {
                            streamId,
                            senderId,
                            sender,
                            message,
                            timestamp,
                            signature,
                            deviceId,
                        },
                    }),
                );
            }
        });

        this.logger.log(
            `[CHAT] Message from ${senderId} in stream ${streamId}: ${message}`,
        );
    }

    @SubscribeMessage('pause-stream')
    async handlePauseStream(
        @MessageBody() data: { streamId: string },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId} = data;

        const clientId = this.findClientIdBySocket(socket);
        if (!clientId) return;

        // Log the stream-paused event
        try {
            const stream = await this.mediasoupService.getStreamInfo(streamId);
            const tags = stream?.tags || [];
            const streamerObjectId = new Types.ObjectId(clientId);
            await this.streamService.createEvent(
                streamerObjectId,
                {
                    id: streamerObjectId,
                    actor: Actor.STREAMER,
                    tags,
                    event: 'stream-paused',
                }
            );
        } catch (error) {
            this.logger.error(`Error logging stream-paused event: ${error.message}`);
        }


        const stream = await this.mediasoupService.getStreamInfo(streamId);
        if (!stream) return;

        // Mark stream as paused
        stream.streamer.isStreaming = false;

        // Notify all viewers
        for (const viewer of stream.viewers.values()) {
            viewer.socket.send(
                JSON.stringify({
                    event: 'stream-paused',
                    data: {streamId},
                }),
            );
        }

        setTimeout(() => {
            if (!stream.streamer.isStreaming) {
                const reward = this.mediasoupService.getTransparencyReward(stream.streamer.id);
                if (reward) {
                    reward.currentHourlyRate = 1;
                    reward.consecutiveHours = 1;
                    this.logger.log(`Reset transparency reward for ${stream.streamer.username} after pause timeout`);
                }
            }
        }, 90 * 60 * 1000); // 1.5 uur in milliseconden

        this.logger.log(`Stream ${streamId} paused`);
    }

    @SubscribeMessage('resume-stream')
    async handleResumeStream(
        @MessageBody() data: { streamId: string },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId} = data;

        const clientId = this.findClientIdBySocket(socket);
        if (!clientId) return;

        // Log the stream-resumed event
        try {
            const stream = await this.mediasoupService.getStreamInfo(streamId);
            const tags = stream?.tags || [];
            const streamerObjectId = new Types.ObjectId(clientId);
            await this.streamService.createEvent(
                streamerObjectId,
                {
                    id: streamerObjectId,
                    actor: Actor.STREAMER,
                    tags,
                    event: 'stream-resumed',
                }
            );
        } catch (error) {
            this.logger.error(`Error logging stream-resumed event: ${error.message}`);
        }

        const stream = await this.mediasoupService.getStreamInfo(streamId);
        if (!stream) return;

        // Mark stream as resumed
        stream.streamer.isStreaming = true;

        // Notify all viewers
        for (const viewer of stream.viewers.values()) {
            viewer.socket.send(
                JSON.stringify({
                    event: 'stream-resumed',
                    data: {streamId},
                }),
            );
        }
        socket.send(
            JSON.stringify({
                event: 'stream-resumed',
                data: {streamId},
            }),
        );
    }

    @SubscribeMessage('frame-hash')
    async handleFrameHash(
        @MessageBody()
        data: {
            streamId: string;
            senderId: string;
            frameHash: string;
            timestamp: string;
        },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId, senderId, frameHash, timestamp} = data;
        // Get stream info from mediasoupService
        const stream = await this.mediasoupService.getStreamInfo(streamId);
        if (!stream) return;
        // Relay to all viewers (not streamer)
        for (const [viewerId, viewer] of stream.viewers.entries()) {
            if (viewer.socket.readyState === WebSocket.OPEN) {
                viewer.socket.send(
                    JSON.stringify({
                        event: 'frame-hash',
                        data: {streamId, senderId, frameHash, timestamp},
                    }),
                );
            }
        }
        // this.logger.log(
        //   `[FRAME-HASH] Relayed frame hash from ${senderId} in stream ${streamId}: ${frameHash}`,
        // );
    }

    @SubscribeMessage('set-transparency')
    async handleSetTransparency(
        @MessageBody() data: { streamId: string; transparent: boolean },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const {streamId, transparent} = data;
        try {
            await this.mediasoupService.setTransparency(streamId, transparent);
            this.logger.log(`[TRANSPARENCY] Set transparency to ${transparent} for streamId=${streamId}`);
            socket.send(
                JSON.stringify({
                    event: 'transparency-set',
                    data: {streamId, transparent},
                })
            );
        } catch (error) {
            this.logger.error(`Error setting transparency: ${error.message}`);
            socket.send(
                JSON.stringify({
                    event: 'error',
                    data: {message: 'Failed to set transparency'},
                })
            );
        }
    }

    @SubscribeMessage('video-rotation')
    async handleVideoRotation(
        @MessageBody() data: { streamId: string; rotation: number },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const { streamId, rotation } = data;
        // Get stream info from mediasoupService
        const stream = await this.mediasoupService.getStreamInfo(streamId);
        if (!stream) return;
        // Store the new rotation
        stream.streamer.videoRotation = rotation;
        stream.videoRotation = rotation;
        // Relay to all viewers (not streamer)
        for (const [viewerId, viewer] of stream.viewers.entries()) {
            if (viewer.socket.readyState === WebSocket.OPEN) {
                viewer.socket.send(
                    JSON.stringify({
                        event: 'video-rotation',
                        data: { streamId, rotation },
                    })
                );
            }
        }
    }

    @SubscribeMessage('video-mirror')
    async handleVideoMirror(
        @MessageBody() data: { streamId: string; mirrored: boolean },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const { streamId, mirrored } = data;
        // Get stream info from mediasoupService
        const stream = await this.mediasoupService.getStreamInfo(streamId);
        if (!stream) return;
        // Store the new mirroring state
        stream.streamer.videoMirrored = mirrored;
        stream.videoMirrored = mirrored;
        // Relay to all viewers (not streamer)
        for (const [viewerId, viewer] of stream.viewers.entries()) {
            if (viewer.socket.readyState === WebSocket.OPEN) {
                viewer.socket.send(
                    JSON.stringify({
                        event: 'video-mirror',
                        data: { streamId, mirrored },
                    })
                );
            }
        }
    }
}
