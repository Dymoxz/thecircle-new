import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { MediasoupService } from './mediasoup.service';
import { v4 as uuidv4 } from 'uuid';

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
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MediasoupGateway.name);
  private clients = new Map<string, Client>();

  constructor(private readonly mediasoupService: MediasoupService) {}

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
      await this.mediasoupService.closeStream(streamId);

      // Notify all viewers that stream ended
      const stream = await this.mediasoupService.getStreamInfo(streamId);
      if (stream) {
        for (const viewer of stream.viewers.values()) {
          viewer.socket.send(
            JSON.stringify({
              event: 'stream-ended',
              data: { streamId },
            }),
          );
        }
      }

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
        const streamer = stream.streamer
          streamer.socket.send(
            JSON.stringify({
              event: 'viewer-left',
              data: { viewerId },
            }),
          );
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
    },
    @ConnectedSocket() socket: WebSocket,
  ) {
    const { id, clientType, streamId, streamerId, username } = data;

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
        await this.mediasoupService.createStream(id, effectiveStreamId, socket, username);
        this.logger.log(
          `[STREAMS] Streamer registered streamId=${effectiveStreamId}`,
        );
        // Send confirmation to streamer
        socket.send(
          JSON.stringify({
            event: 'registered',
            data: { streamId: effectiveStreamId, clientType: 'streamer' },
          }),
        );
      } catch (error) {
        this.logger.error(`Error creating stream: ${error.message}`);
        socket.send(
          JSON.stringify({
            event: 'error',
            data: { message: 'Failed to create stream' },
          }),
        );
      }
    } else if (clientType === 'viewer' && effectiveStreamId) {
      try {
        console.log(
          `[STREAMS] Viewer ${id} joining streamId=${effectiveStreamId}`,)
        await this.mediasoupService.addViewer(effectiveStreamId, id, socket);
        this.logger.log(
          `[STREAMS] Viewer ${id} joined streamId=${effectiveStreamId}`,
        );

        // Send confirmation to viewer
        socket.send(
          JSON.stringify({
            event: 'registered',
            data: { streamId: effectiveStreamId, clientType: 'viewer' },
          }),
        );

        // Notify streamer about new viewer
        const stream =
          await this.mediasoupService.getStreamInfo(effectiveStreamId);
        if (stream) {
          stream.streamer.socket.send(
            JSON.stringify({
              event: 'viewer-joined',
              data: { viewerId: id },
            }),
          );
          // If the stream is currently paused, notify the new viewer
          if (stream.streamer.isStreaming === false) {
            socket.send(
              JSON.stringify({
                event: 'stream-paused',
                data: { streamId: effectiveStreamId },
              }),
            );
          }
        }
      } catch (error) {
        this.logger.error(`Error adding viewer: ${error.message}`);
        socket.send(
          JSON.stringify({
            event: 'error',
            data: { message: 'Failed to join stream' },
          }),
        );
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
          data: { streams: activeStreams },
        }),
      );
      this.logger.log('[STREAMS] Stream list sent:', activeStreams);
    } catch (error) {
      this.logger.error(`Error getting streams: ${error.message}`);
      socket.send(
        JSON.stringify({
          event: 'error',
          data: { message: 'Failed to get streams' },
        }),
      );
    }
  }

  @SubscribeMessage('get-rtp-capabilities')
  async handleGetRtpCapabilities(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() socket: WebSocket,
  ) {
    console.log('Getting RTP capabilities with streamId:', data.streamId);
    const { streamId } = data;
    try {
      const rtpCapabilities =
        await this.mediasoupService.getRtpCapabilities(streamId);
      socket.send(
        JSON.stringify({
          event: 'rtp-capabilities',
          data: { rtpCapabilities },
        }),
      );
    } catch (error) {
      this.logger.error(`Error getting RTP capabilities: ${error.message}`);
      socket.send(
        JSON.stringify({
          event: 'error',
          data: { message: 'Failed to get RTP capabilities' },
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
    const { streamId, isStreamer, streamerId } = data;
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
          data: { transport },
        }),
      );
    } catch (error) {
      this.logger.error(`Error creating transport: ${error.message}`);
      socket.send(
        JSON.stringify({
          event: 'error',
          data: { message: 'Failed to create transport' },
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
    const { streamId, transportId, dtlsParameters, isStreamer } = data;
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
          data: { transportId },
        }),
      );
    } catch (error) {
      this.logger.error(`Error connecting transport: ${error.message}`);
      socket.send(
        JSON.stringify({
          event: 'error',
          data: { message: 'Failed to connect transport' },
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
    const { streamId, transportId, kind, rtpParameters } = data;
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
          data: { producer },
        }),
      );
    } catch (error) {
      this.logger.error(`Error creating producer: ${error.message}`);
      socket.send(
        JSON.stringify({
          event: 'error',
          data: { message: 'Failed to create producer' },
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
    const { streamId, transportId, rtpCapabilities } = data;
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
          data: { message: 'Client not found' },
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
          data: { consumer: consumers },
        }),
      );
    } catch (error) {
      this.logger.error(`Error creating consumer: ${error.message}`);
      console.log('[CONSUME] Error creating consumer:', error);
      socket.send(
        JSON.stringify({
          event: 'error',
          data: { message: 'Failed to create consumer' },
        }),
      );
    }
  }

  @SubscribeMessage('resume-consumer')
  async handleResumeConsumer(
    @MessageBody() data: { streamId: string; consumerId: string },
    @ConnectedSocket() socket: WebSocket,
  ) {
    const { streamId, consumerId } = data;
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
            data: { consumerId },
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
    const { streamId } = data;
    const clientId = this.findClientIdBySocket(socket);
    if (!clientId) return;

    try {
      await this.mediasoupService.closeStream(streamId);
      this.logger.log(
        `[END-STREAM] Streamer ${clientId} ended streamId=${streamId}`,
      );
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
      message: string;
      timestamp: Date;
      signature: string;
      publicKey: string;
    },
    @ConnectedSocket() socket: WebSocket,
  ) {
    const { streamId, senderId, message, timestamp, signature, publicKey } =
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
              message,
              timestamp,
              signature,
              publicKey,
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
    const { streamId } = data;
    // Notify all viewers of this stream
    const stream = await this.mediasoupService.getStreamInfo(streamId);
    if (stream) {
      for (const viewer of stream.viewers.values()) {
        viewer.socket.send(
          JSON.stringify({
            event: 'stream-paused',
            data: { streamId },
          }),
        );
      }
    }
    // Optionally, notify the streamer as well (for confirmation)
    socket.send(
      JSON.stringify({
        event: 'stream-paused',
        data: { streamId },
      }),
    );
    this.logger.log(`[PAUSE] Stream ${streamId} paused`);
  }

  @SubscribeMessage('resume-stream')
  async handleResumeStream(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() socket: WebSocket,
  ) {
    const { streamId } = data;
    // Notify all viewers of this stream
    const stream = await this.mediasoupService.getStreamInfo(streamId);
    if (stream) {
      for (const viewer of stream.viewers.values()) {
        viewer.socket.send(
          JSON.stringify({
            event: 'stream-resumed',
            data: { streamId },
          }),
        );
      }
    }
    // Optionally, notify the streamer as well (for confirmation)
    socket.send(
      JSON.stringify({
        event: 'stream-resumed',
        data: { streamId },
      }),
    );
    this.logger.log(`[RESUME] Stream ${streamId} resumed`);
  }
}
