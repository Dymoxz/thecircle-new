// src/events/events.gateway.ts
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

interface Client {
    id: string;
    socket: WebSocket;
    type: 'streamer' | 'viewer';
    streamId?: string;
}

interface Stream {
    streamerSocket: WebSocket;
    streamerId: string;
    viewers: Set<string>;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private clients: Client[] = [];
    private streams = new Map<string, Stream>();

    handleConnection(client: WebSocket) {
        console.log('[WS] New connection established');
    }

    handleDisconnect(client: WebSocket) {
        const clientIndex = this.clients.findIndex((c) => c.socket === client);
        if (clientIndex === -1) return;

        const disconnectedClient = this.clients[clientIndex];
        const { id, type, streamId } = disconnectedClient;

        console.log(`[WS] Connection closed for clientId=${id}`);

        if (type === 'streamer' && streamId) {
            const stream = this.streams.get(streamId);
            if (stream) {
                stream.viewers.forEach(viewerId => {
                    const viewer = this.clients.find(c => c.id === viewerId);
                    if (viewer) {
                        // *** FIX: Send message in NestJS format ***
                        viewer.socket.send(JSON.stringify({
                            event: 'stream-ended',
                            data: { streamId }
                        }));
                    }
                });
                this.streams.delete(streamId);
                console.log(`[CLEANUP] Streamer ${id} disconnected, streamId=${streamId} removed`);
            }
        } else if (type === 'viewer' && streamId) {
            const stream = this.streams.get(streamId);
            if (stream) {
                stream.viewers.delete(id);
                console.log(`[CLEANUP] Viewer ${id} disconnected from streamId=${streamId}`);
            }
        }

        this.clients.splice(clientIndex, 1);
    }

    @SubscribeMessage('register')
    handleRegister(
        @MessageBody() data: { id: string; clientType: string; streamId: string },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const { id, clientType, streamId } = data;
        this.clients.push({ id, socket, type: clientType as any, streamId });

        console.log(`[REGISTER] ${clientType} registered with id=${id}, streamId=${streamId}`);

        if (clientType === 'streamer' && streamId) {
            this.streams.set(streamId, {
                streamerSocket: socket,
                streamerId: id,
                viewers: new Set(),
            });
            console.log(`[STREAMS] Streamer registered streamId=${streamId}`);
        } else if (clientType === 'viewer' && streamId) {
            const stream = this.streams.get(streamId);
            if (stream) {
                stream.viewers.add(id);
                console.log(`[STREAMS] Viewer ${id} joined streamId=${streamId}`);

                // *** FIX: Send message in NestJS format ***
                stream.streamerSocket.send(
                    JSON.stringify({
                        event: 'viewer-joined',
                        data: { viewerId: id }
                    }),
                );
            }
        }
    }

    @SubscribeMessage('get-streams')
    handleGetStreams(@ConnectedSocket() socket: WebSocket) {
        console.log('[STREAMS] get-streams requested');
        const activeStreams = Array.from(this.streams.entries())
            .filter(([, streamData]) => streamData.streamerSocket.readyState === WebSocket.OPEN)
            .map(([streamId]) => streamId);

        // *** FIX: Send message in NestJS format ***
        socket.send(JSON.stringify({
            event: 'streams',
            data: { streams: activeStreams }
        }));
        console.log('[STREAMS] Stream list sent:', activeStreams);
    }

    @SubscribeMessage('offer')
    handleOffer(
        @MessageBody() data: { to: string; offer: any },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const senderClient = this.clients.find(c => c.socket === socket);
        if (!senderClient) return;

        const { to, offer } = data;
        const targetClient = this.clients.find((c) => c.id === to);
        if (targetClient) {
            // *** FIX: Send message in NestJS format ***
            targetClient.socket.send(JSON.stringify({
                event: 'offer',
                data: { from: senderClient.id, offer }
            }));
            console.log(`[SIGNAL] Offer sent from ${senderClient.id} to ${to}`);
        }
    }

    @SubscribeMessage('answer')
    handleAnswer(
        @MessageBody() data: { to: string; answer: any },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const senderClient = this.clients.find(c => c.socket === socket);
        if (!senderClient) return;

        const { to, answer } = data;
        const targetClient = this.clients.find((c) => c.id === to);
        if (targetClient) {
            // *** FIX: Send message in NestJS format ***
            targetClient.socket.send(JSON.stringify({
                event: 'answer',
                data: { from: senderClient.id, answer }
            }));
            console.log(`[SIGNAL] Answer sent from ${senderClient.id} to ${to}`);
        }
    }

    @SubscribeMessage('ice-candidate')
    handleIceCandidate(
        @MessageBody() data: { to: string; candidate: any },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const senderClient = this.clients.find(c => c.socket === socket);
        if (!senderClient) return;

        const { to, candidate } = data;
        const targetClient = this.clients.find((c) => c.id === to);
        if (targetClient) {
            // *** FIX: Send message in NestJS format ***
            targetClient.socket.send(JSON.stringify({
                event: 'ice-candidate',
                data: { from: senderClient.id, candidate }
            }));
        }
    }

    @SubscribeMessage('end-stream')
    handleEndStream(
        @MessageBody() data: { id: string; streamId: string },
        @ConnectedSocket() socket: WebSocket,
    ) {
        const { id, streamId } = data;
        const stream = this.streams.get(streamId);
        if (stream && stream.streamerId === id) {
            stream.viewers.forEach(viewerId => {
                const viewer = this.clients.find(c => c.id === viewerId);
                if (viewer) {
                    viewer.socket.send(JSON.stringify({
                        event: 'stream-ended',
                        data: { streamId }
                    }));
                }
            });
            this.streams.delete(streamId);
            console.log(`[END-STREAM] Streamer ${id} ended streamId=${streamId}`);
        }
    }
}