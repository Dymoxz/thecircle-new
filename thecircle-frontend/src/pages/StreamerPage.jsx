import React, {useEffect, useRef, useState} from 'react';
import {v4 as uuidv4} from 'uuid';
import {
    Camera,
    Eye,
    MessageSquare,
    Mic,
    MicOff,
    Monitor,
    Pause,
    Play,
    RotateCcw,
    Send,
    Settings,
    Square,
    Video,
    VideoOff,
} from 'lucide-react';
import * as mediasoupClient from 'mediasoup-client';
import Chat from '../component/chat';
import { jwtDecode } from 'jwt-decode';

// WebSocket URL configuration
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

// --- Helper Component for Styled Buttons ---
const ControlButton = ({onClick, children, className = '', ...props}) => (
    <button
        onClick={onClick}
        className={`p-3 rounded-2xl backdrop-blur-lg transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 ${className}`}
        {...props}
    >
        {children}
    </button>
);

// --- Mock Data for Chat Panel ---


const VIDEO_CONSTRAINTS = {
    width: {ideal: 1280},
    height: {ideal: 720},
    frameRate: {ideal: 30, max: 60}
};
const AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 48000,
};

const StreamerPage = () => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [currentCamera, setCurrentCamera] = useState('user');
    const [viewerCount, setViewerCount] = useState(0);
    const [streamDuration, setStreamDuration] = useState(0);
    const [showPauseOverlay, setShowPauseOverlay] = useState(false); // <-- FIXED: add missing state

    const localVideoRef = useRef(null);
    const socketRef = useRef(null);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const localStreamRef = useRef(null);
    const streamStartTime = useRef(null);
    const durationInterval = useRef(null);

    // Mediasoup refs
    const deviceRef = useRef(null);
    const sendTransportRef = useRef(null);
    const audioProducerRef = useRef(null);
    const videoProducerRef = useRef(null);


    const token = localStorage.getItem('jwt_token');
    const user = jwtDecode(token);
    const streamerId = user._id
    const streamId = streamerId;
    const username = user.username || `Streamer-${streamerId.substring(0, 6)}`;

    useEffect(() => {
        document.title = "StreamHub - Stream";
        return () => {
            document.title = "StreamHub";
        };
    }, []);

    const formatDuration = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        socketRef.current = new WebSocket(WS_URL);
        const socket = socketRef.current;

        socket.onopen = () => setIsWsConnected(true);
        socket.onclose = () => setIsWsConnected(false);
        socket.onerror = (err) => console.error('[WS] Error:', err);

        socket.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data);
                switch (msg.event) {
                    case 'viewer-joined': {
                        const {viewerId} = msg.data;
                        if (viewerId) {
                            setViewerCount(prev => prev + 1);
                        }
                        break;
                    }
                    case 'rtp-capabilities': {
                        const {rtpCapabilities} = msg.data;
                        if (deviceRef.current) {
                            deviceRef.current.load({routerRtpCapabilities: rtpCapabilities});
                        }
                        break;
                    }
                    case 'transport-created': {
                        const {transport} = msg.data;
                        await createSendTransport(transport);
                        // After transport is created, produce the tracks
                        await produceTracks();
                        break;
                    }
                    case 'transport-connected': {
                        console.log('Transport connected');
                        break;
                    }
                    case 'produced': {
                        const {producer} = msg.data;
                        console.log('Producer created:', producer);
                        break;
                    }
                    case 'error': {
                        console.error('Server error:', msg.data.message);
                        break;
                    }
                    case 'stream-paused': {
                        setShowPauseOverlay(true);
                        setIsPaused(true);
                        if (localVideoRef.current) {
                            localVideoRef.current.pause();
                        }
                        break;
                    }
                    case 'stream-resumed': {
                        setShowPauseOverlay(false);
                        setIsPaused(false);
                        if (localVideoRef.current) {
                            localVideoRef.current.play();
                        }
                        break;
                    }
                    default:
                        break;
                }
            } catch (err) {
                console.error('WebSocket message handling error:', err);
            }
        };

        return () => {
            socket.close();
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            clearInterval(durationInterval.current);
        };
    }, []);

    useEffect(() => {
        if (isStreaming && !isPaused) {
            durationInterval.current = setInterval(() => {
                if (streamStartTime.current) {
                    setStreamDuration(Math.floor((Date.now() - streamStartTime.current) / 1000));
                }
            }, 1000);
        } else {
            clearInterval(durationInterval.current);
        }
        return () => clearInterval(durationInterval.current);
    }, [isStreaming, isPaused]);

    const produceTracks = async () => {
        try {
            if (!localStreamRef.current || !sendTransportRef.current) {
                console.error('No local stream or transport available');
                return;
            }

            const stream = localStreamRef.current;
            const sendTransport = sendTransportRef.current;

            // Produce video track
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                console.log('Producing video track');
                const videoProducer = await sendTransport.produce({track: videoTrack});
                videoProducerRef.current = videoProducer;
                console.log('Video producer created:', videoProducer.id);
            }

            // Produce audio track
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                console.log('Producing audio track');
                const audioProducer = await sendTransport.produce({track: audioTrack});
                audioProducerRef.current = audioProducer;
                console.log('Audio producer created:', audioProducer.id);
            }

        } catch (error) {
            console.error('Error producing tracks:', error);
        }
    };

    const createSendTransport = async (transportOptions) => {
        try {
            const device = new mediasoupClient.Device();
            deviceRef.current = device;

            // Load device with router RTP capabilities
            const rtpCapabilities = await getRtpCapabilities();
            await device.load({routerRtpCapabilities: rtpCapabilities});

            const sendTransport = device.createSendTransport(transportOptions);
            sendTransportRef.current = sendTransport;

            sendTransport.on('connect', async ({dtlsParameters}, callback, errback) => {
                try {
                    await connectTransport(dtlsParameters);
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            sendTransport.on('produce', async ({kind, rtpParameters}, callback, errback) => {
                try {
                    const producer = await produce(kind, rtpParameters);
                    callback({id: producer.id});
                } catch (error) {
                    errback(error);
                }
            });

            return sendTransport;
        } catch (error) {
            console.error('Error creating send transport:', error);
            throw error;
        }
    };

    const getRtpCapabilities = async () => {
        socketRef.current.send(JSON.stringify({
            event: 'get-rtp-capabilities',
            data: {streamId: streamerId}
        }));

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout getting RTP capabilities')), 5000);

            const originalOnMessage = socketRef.current.onmessage;
            socketRef.current.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.event === 'rtp-capabilities') {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    resolve(msg.data.rtpCapabilities);
                }
            };
        });
    };

    const connectTransport = async (dtlsParameters) => {
        socketRef.current.send(JSON.stringify({
            event: 'connect-transport',
            data: {
                streamId: streamerId,
                transportId: sendTransportRef.current.id,
                dtlsParameters,
                isStreamer: true
            }
        }));

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout connecting transport')), 5000);

            const originalOnMessage = socketRef.current.onmessage;
            socketRef.current.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.event === 'transport-connected') {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    resolve();
                } else if (msg.event === 'error') {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    reject(new Error(msg.data.message));
                }
            };
        });
    };

    const produce = async (kind, rtpParameters) => {
        const streamId = `stream-${streamerId}`;
        socketRef.current.send(JSON.stringify({
            event: 'produce',
            data: {
                streamId: streamerId,
                transportId: sendTransportRef.current.id,
                kind,
                rtpParameters
            }
        }));

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout producing')), 5000);

            const originalOnMessage = socketRef.current.onmessage;
            socketRef.current.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.event === 'produced') {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    resolve(msg.data.producer);
                } else if (msg.event === 'error') {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    reject(new Error(msg.data.message));
                }
            };
        });
    };

    const handleStartStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {...VIDEO_CONSTRAINTS, facingMode: currentCamera},
                audio: AUDIO_CONSTRAINTS
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const streamId = `stream-${streamerId}`;
            // Send register event
            socketRef.current.send(JSON.stringify({
                event: 'register',
                data: {id: streamerId, clientType: 'streamer', streamId, streamerId: streamerId}
            }));

            // Wait for 'registered' confirmation before creating transport
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout waiting for registration confirmation')), 5000);
                const originalOnMessage = socketRef.current.onmessage;
                socketRef.current.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.event === 'registered' && msg.data?.clientType === 'streamer') {
                            clearTimeout(timeout);
                            socketRef.current.onmessage = originalOnMessage;
                            resolve();
                        } else if (msg.event === 'error') {
                            clearTimeout(timeout);
                            socketRef.current.onmessage = originalOnMessage;
                            reject(new Error(msg.data.message));
                        }
                    } catch (err) {
                        // Ignore parse errors
                    }
                };
            });

            // Now create transport
            socketRef.current.send(JSON.stringify({
                event: 'create-transport',
                data: {streamId, isStreamer: true, streamerId}
            }));

            setIsStreaming(true);
            streamStartTime.current = Date.now();
        } catch (err) {
            console.error("Could not access camera/mic:", err);
            alert("Could not access camera/mic: " + err.message);
        }
    };

    const handleStopStream = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                event: 'end-stream',
                data: {streamId:streamerId}
            }));
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        localStreamRef.current = null;

        if (localVideoRef.current) localVideoRef.current.srcObject = null;

        // Close mediasoup resources
        if (audioProducerRef.current) {
            audioProducerRef.current.close();
            audioProducerRef.current = null;
        }
        if (videoProducerRef.current) {
            videoProducerRef.current.close();
            videoProducerRef.current = null;
        }
        if (sendTransportRef.current) {
            sendTransportRef.current.close();
            sendTransportRef.current = null;
        }
        if (deviceRef.current) {
            deviceRef.current = null;
        }

        setIsStreaming(false);
        setIsPaused(false);
        setViewerCount(0);
        setStreamDuration(0);
        streamStartTime.current = null;
    };

    const handlePauseStream = () => {
        if (!localStreamRef.current) return;

        const nextPausedState = !isPaused;
        const tracks = localStreamRef.current.getTracks();

        tracks.forEach(track => {
            track.enabled = !nextPausedState;
        });

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            const streamId = `stream-${streamerId}`;
            if (nextPausedState) {
                socketRef.current.send(JSON.stringify({
                    event: 'pause-stream',
                    data: { streamId:streamerId }
                }));
            } else {
                socketRef.current.send(JSON.stringify({
                    event: 'resume-stream',
                    data: { streamId:streamerId }
                }));
            }
        }
    };

    const handleFlipCamera = async () => {
        if (!isStreaming || !localStreamRef.current) return;

        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack) currentVideoTrack.stop();

        const newFacingMode = currentCamera === 'user' ? 'environment' : 'user';
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {...VIDEO_CONSTRAINTS, facingMode: newFacingMode}
            });
            const newVideoTrack = newStream.getVideoTracks()[0];
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            localStreamRef.current = new MediaStream([newVideoTrack, audioTrack]);

            // Replace video producer if it exists
            if (videoProducerRef.current && sendTransportRef.current) {
                videoProducerRef.current.replaceTrack({track: newVideoTrack});
            }

            setCurrentCamera(newFacingMode);
        } catch (err) {
            console.error("Could not flip camera:", err);
            if (currentVideoTrack) localStreamRef.current.addTrack(currentVideoTrack);
        }
    };
        const toggleMute = () => {
        if (!localStreamRef.current) return;
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = isMuted;
            setIsMuted(!isMuted);
        }
    };

        const toggleVideo = () => {
        if (!localStreamRef.current) return;
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = isVideoOff;
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <div className="h-[100dvh] w-screen text-neutral-100 overflow-hidden bg-neutral-900 relative">
            {/* --- VIDEO + OVERLAY CONTAINER --- */}
            <div className="absolute inset-0 w-full h-full z-0">
                <video ref={localVideoRef}
                       autoPlay
                       playsInline
                       muted
                       className="w-full h-full"/>
                {isStreaming && showPauseOverlay && (
                    <div
                        className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl transition-opacity duration-500 z-0 pointer-events-none">
                        <div className="text-center p-8 select-none">
                            <div
                                className="w-24 h-24 bg-neutral-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Pause className="w-12 h-12 text-neutral-400"/>
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Stream Paused</h3>
                            <p className="text-neutral-300 max-w-sm">
                                Your stream is currently paused for viewers. We'll be back soon!
                            </p>
                        </div>
                    </div>
                )}
            </div>
            {/* --- CONTROLS AND INFO --- */}
            {/* All UI controls and overlays below should have z-10 or higher to be above the video/blur */}
            {isStreaming && (
                <div
                    className="absolute top-4 left-4 flex items-center space-x-4 text-sm bg-neutral-900/30 backdrop-blur-xl p-2 pl-3 rounded-3xl border border-neutral-100/10 shadow-lg z-10">
                    <div className="flex items-center space-x-2 bg-red-500/90 px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping absolute opacity-75"></div>
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        <span className="font-semibold uppercase tracking-wider text-xs">Live</span>
                    </div>
                    <div className="flex items-center space-x-2 text-neutral-200 pr-2">
                        <Eye className="w-5 h-5"/>
                        <span className="font-medium">{viewerCount}</span>
                    </div>
                    <div className="text-neutral-200 font-mono hidden sm:block bg-neutral-800/50 px-3 py-1 rounded-lg">
                        {formatDuration(streamDuration)}
                    </div>
                </div>
            )}

            {isStreaming && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <div
                        className="flex items-center space-x-3 bg-neutral-900/30 backdrop-blur-xl p-2 rounded-3xl border border-neutral-100/10 shadow-lg z-10">
                        <ControlButton
                            onClick={toggleMute}
                            className={isMuted ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200'}
                        >
                            {isMuted ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
                        </ControlButton>
                        <ControlButton
                            onClick={toggleVideo}
                            className={isVideoOff ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200'}
                        >
                            {isVideoOff ? <VideoOff className="w-6 h-6"/> : <Video className="w-6 h-6"/>}
                        </ControlButton>
                        <ControlButton
                            onClick={handleFlipCamera}
                            className="bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"
                        >
                            <RotateCcw className="w-6 h-6"/>
                        </ControlButton>
                        <div className="w-px h-8 bg-neutral-100/10 mx-2"></div>
                        <ControlButton
                            onClick={handlePauseStream}
                            className={isPaused ? 'bg-teal-500/80 hover:bg-teal-500 text-white' : 'bg-yellow-500/80 hover:bg-yellow-500 text-neutral-900'}
                        >
                            {isPaused ? <Play className="w-6 h-6"/> : <Pause className="w-6 h-6"/>}
                        </ControlButton>
                        <ControlButton
                            onClick={handleStopStream}
                            className="bg-red-500/80 hover:bg-red-500 text-white"
                        >
                            <Square className="w-6 h-6"/>
                        </ControlButton>
                    </div>
                </div>
            )}

            <div className="absolute top-4 right-4 w-80 space-y-4 hidden lg:flex flex-col max-h-[calc(100vh-2rem)] z-20">
                <div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 p-4 rounded-2xl">
                    <h3 className="font-semibold mb-4 flex items-center text-lg">
                        <Monitor className="w-5 h-5 mr-3 text-teal-400"/>
                        Stream Info
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Status</span>
                            <span className={`font-semibold px-2 py-0.5 rounded-md text-xs ${
                                isStreaming ? (isPaused ? 'bg-yellow-500/20 text-yellow-300' : 'bg-teal-500/20 text-teal-300') : 'bg-neutral-700 text-neutral-300'
                            }`}>
                                {isStreaming ? (isPaused ? 'Paused' : 'Live') : 'Offline'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Camera</span>
                            <span className="capitalize">{currentCamera === 'user' ? 'Front' : 'Back'}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 p-4 rounded-2xl">
                    <h3 className="font-semibold mb-4 flex items-center text-lg">
                        <Settings className="w-5 h-5 mr-3 text-teal-400"/>
                        Quick Controls
                    </h3>
                    {!isStreaming ? (
                        <button
                            onClick={handleStartStream}
                            disabled={!isWsConnected}
                            className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-neutral-600 disabled:cursor-not-allowed text-neutral-900 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ease-in-out flex items-center justify-center space-x-2 transform hover:scale-105 active:scale-100"
                        >
                            <Play className="w-5 h-5"/>
                            <span>{isWsConnected ? 'Start Stream' : 'Connecting...'}</span>
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <button
                                onClick={handlePauseStream}
                                className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2 ${
                                    isPaused ? 'bg-teal-500/80 hover:bg-teal-500 text-white' : 'bg-yellow-500/80 hover:bg-yellow-500 text-neutral-900'
                                }`}
                            >
                                {isPaused ? <Play className="w-5 h-5"/> : <Pause className="w-5 h-5"/>}
                                <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
                            </button>
                            <button
                                onClick={handleStopStream}
                                className="w-full bg-red-500/80 hover:bg-red-500 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
                            >
                                <Square className="w-5 h-5"/>
                                <span>End Stream</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* --- CHAT PANEL --- */}
                <Chat
                streamId = {streamId}
                username={username}
                socket = {socketRef.current}
                myStream={true}
                />
            </div>
        </div>
    );
};

export default StreamerPage;
