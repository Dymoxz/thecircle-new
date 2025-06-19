import { types as mediasoupTypes } from 'mediasoup';

export interface MediasoupWorker {
  worker: mediasoupTypes.Worker;
  router: mediasoupTypes.Router;
  isActive: boolean;
}

export interface TransportInfo {
  id: string;
  type: 'webrtc' | 'plain';
  transport: mediasoupTypes.WebRtcTransport | mediasoupTypes.PlainTransport;
  producer?: mediasoupTypes.Producer;
  consumers: Map<string, mediasoupTypes.Consumer>;
}

export interface StreamerInfo {
  id: string;
  socket: any;
  transport: TransportInfo;
  streamId: string;
  streamerID: string;
  isStreaming: boolean;
  recordingProcess?: any; // FFmpeg process
  recordingPath?: string;
}

export interface ViewerInfo {
  id: string;
  socket: any;
  transport: TransportInfo;
  streamId: string;
}

export interface StreamInfo {
  streamId: string;
  streamer: StreamerInfo;
  viewers: Map<string, ViewerInfo>;
  router: mediasoupTypes.Router;
  recordingPath: string;
}

export interface RtpCapabilities {
  codecs: mediasoupTypes.RtpCodecCapability[];
  headerExtensions: mediasoupTypes.RtpHeaderExtension[];
}

export interface TransportOptions {
  listenIps: mediasoupTypes.TransportListenIp[];
  enableUdp: boolean;
  enableTcp: boolean;
  preferUdp: boolean;
  initialAvailableOutgoingBitrate: number;
}

export interface ProducerOptions {
  kind: 'audio' | 'video';
  rtpParameters: mediasoupTypes.RtpParameters;
  paused?: boolean;
  appData?: any;
}

export interface ConsumerOptions {
  producerId: string;
  rtpCapabilities: mediasoupTypes.RtpCapabilities;
  paused?: boolean;
  appData?: any;
}

export interface RecordingConfig {
  outputPath: string;
  videoCodec: string;
  audioCodec: string;
  videoBitrate: string;
  audioBitrate: string;
  format: string;
}

export interface MediasoupConfig {
  numWorkers: number;
  workerSettings: {
    logLevel: 'warn' | 'debug' | 'error' | 'info';
    logTags: string[];
    rtcMinPort: number;
    rtcMaxPort: number;
  };
  routerOptions: {
    mediaCodecs: mediasoupTypes.RtpCodecCapability[];
  };
  webRtcTransportOptions: {
    listenIps: mediasoupTypes.TransportListenIp[];
    enableUdp: boolean;
    enableTcp: boolean;
    preferUdp: boolean;
    initialAvailableOutgoingBitrate: number;
  };
  recordingOptions: RecordingConfig;
}

