import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    Play,
    Square,
    Pause,
    RotateCcw,
    Camera,
    Mic,
    MicOff,
    Video,
    VideoOff,
    Eye,
    Settings,
    Monitor,
    MessageSquare, // New Icon
    Send,           // New Icon
} from 'lucide-react';

// WebSocket URL configuration
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

// --- Helper Component for Styled Buttons ---
const ControlButton = ({ onClick, children, className = '', ...props }) => (
    <button
        onClick={onClick}
        className={`p-3 rounded-2xl backdrop-blur-lg transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 ${className}`}
        {...props}
    >
        {children}
    </button>
);

// --- Mock Data for Chat Panel ---
const mockChatMessages = [
    { user: 'Alice', color: 'text-pink-400', message: 'This stream is awesome! 🔥' },
    { user: 'Bob', color: 'text-blue-400', message: 'What game is this?' },
    { user: 'Charlie', color: 'text-green-400', message: 'Loving the energy! Keep it up!' },
    { user: 'Diana', color: 'text-yellow-400', message: 'Can you show the settings you are using?' },
    { user: 'Eve', color: 'text-purple-400', message: 'Great quality stream! Looks so smooth.' },
    { user: 'Frank', color: 'text-orange-400', message: 'lol that was a close one' },
];


const StreamerPage = () => {
    // ... all state and refs remain the same
    const [isStreaming, setIsStreaming] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [currentCamera, setCurrentCamera] = useState('user');
    const [viewerCount, setViewerCount] = useState(0);
    const [streamDuration, setStreamDuration] = useState(0);

    const localVideoRef = useRef(null);
    const socketRef = useRef(null);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const localStreamRef = useRef(null);
    const peersRef = useRef(new Map());
    const blankTracksRef = useRef({ video: null, audio: null });
    const streamStartTime = useRef(null);
    const durationInterval = useRef(null);

    const streamerId = useRef(uuidv4()).current;

    // (All useEffect and handler functions remain the same)
    const createBlankTracks = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const videoStream = canvas.captureStream();
        blankTracksRef.current.video = videoStream.getVideoTracks()[0];

        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const dst = oscillator.connect(audioCtx.createMediaStreamDestination());
        oscillator.start();
        const audioTrack = dst.stream.getAudioTracks()[0];
        audioTrack.enabled = false;
        blankTracksRef.current.audio = audioTrack;
    };

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
            const msg = JSON.parse(event.data);
            switch (msg.event) {
                case 'viewer-joined': {
                    const { viewerId } = msg.data;
                    if (!viewerId) break;
                    const peer = new RTCPeerConnection();
                    peersRef.current.set(viewerId, peer);
                    setViewerCount(prev => prev + 1);
                    if (localStreamRef.current) {
                        localStreamRef.current.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current));
                    }
                    peer.onicecandidate = (e) => {
                        if (e.candidate) socket.send(JSON.stringify({ event: 'ice-candidate', data: { to: viewerId, candidate: e.candidate } }));
                    };
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);
                    socket.send(JSON.stringify({ event: 'offer', data: { to: viewerId, offer } }));
                    break;
                }
                case 'answer': {
                    const { from, answer } = msg.data;
                    const peer = peersRef.current.get(from);
                    if (peer) await peer.setRemoteDescription(new RTCSessionDescription(answer));
                    break;
                }
                case 'ice-candidate': {
                    const { from, candidate } = msg.data;
                    const peer = peersRef.current.get(from);
                    if (peer && candidate) await peer.addIceCandidate(new RTCIceCandidate(candidate));
                    break;
                }
                default: break;
            }
        };

        createBlankTracks();

        return () => {
            socket.close();
            if(localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
            clearInterval(durationInterval.current);
            peersRef.current.forEach(peer => peer.close());
        };
    }, []);

    useEffect(() => {
        if(isStreaming && !isPaused) {
            durationInterval.current = setInterval(() => {
                if (streamStartTime.current) {
                    setStreamDuration(Math.floor((Date.now() - streamStartTime.current) / 1000));
                }
            }, 1000);
        } else {
            clearInterval(durationInterval.current);
        }
        return () => clearInterval(durationInterval.current);
    }, [isStreaming, isPaused])


    const handleStartStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera }, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            const streamId = `stream-${streamerId}`;
            socketRef.current.send(JSON.stringify({ event: 'register', data: { id: streamerId, clientType: 'streamer', streamId } }));
            setIsStreaming(true);
            streamStartTime.current = Date.now();
        } catch (err) {
            console.error("Could not access camera/mic:", err);
            alert("Could not access camera/mic: " + err.message);
        }
    };

    const handleStopStream = () => {
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        peersRef.current.forEach(peer => peer.close());
        peersRef.current.clear();
        setIsStreaming(false);
        setIsPaused(false);
        setViewerCount(0);
        setStreamDuration(0);
        streamStartTime.current = null;
    };

    const handlePauseStream = () => {
        const nextPausedState = !isPaused;
        peersRef.current.forEach(peer => {
            peer.getSenders().forEach(sender => {
                if (sender.track?.kind === 'video') sender.replaceTrack(nextPausedState ? blankTracksRef.current.video : localStreamRef.current.getVideoTracks()[0]);
                if (sender.track?.kind === 'audio') sender.replaceTrack(nextPausedState ? blankTracksRef.current.audio : localStreamRef.current.getAudioTracks()[0]);
            });
        });
        setIsPaused(nextPausedState);
    };

    const handleFlipCamera = async () => {
        if (!isStreaming || !localStreamRef.current) return;
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if(currentVideoTrack) currentVideoTrack.stop();

        const newFacingMode = currentCamera === 'user' ? 'environment' : 'user';
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacingMode } });
            const newVideoTrack = newStream.getVideoTracks()[0];
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            localStreamRef.current = new MediaStream([newVideoTrack, audioTrack]);

            if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

            peersRef.current.forEach(peer => {
                const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(newVideoTrack);
            });
            setCurrentCamera(newFacingMode);
        } catch (err) {
            console.error("Could not flip camera:", err);
            if(currentVideoTrack) localStreamRef.current.addTrack(currentVideoTrack);
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
        <div
            className="h-[100dvh] w-screen text-slate-100 overflow-hidden bg-slate-900 relative"
        >
            <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />

            {/* --- OVERLAYS --- */}

            {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl transition-opacity duration-500">
                    <div className="text-center p-8">
                        <div className="w-24 h-24 bg-slate-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6"><Camera className="w-12 h-12 text-cyan-400" /></div>
                        <h3 className="text-2xl font-bold mb-2">Ready to Stream</h3>
                        <p className="text-slate-300 mb-6 max-w-sm">Press the button below or in the side panel to start.</p>
                        <button onClick={handleStartStream} disabled={!isWsConnected} className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 px-8 py-3 rounded-2xl font-semibold transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transform hover:scale-105 lg:hidden">{isWsConnected ? 'Start Stream' : 'Connecting...'}</button>
                    </div>
                </div>
            )}

            {isStreaming && (isPaused || isVideoOff) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl transition-opacity duration-500">
                    <div className="text-center p-8">
                        <div className="w-24 h-24 bg-slate-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">{isPaused ? <Pause className="w-12 h-12 text-slate-400" /> : <VideoOff className="w-12 h-12 text-slate-400" />}</div>
                        <h3 className="text-2xl font-bold mb-2">{isPaused ? 'Stream Paused' : 'Camera Off'}</h3>
                        <p className="text-slate-300 max-w-sm">{isPaused ? 'Your stream is currently paused for viewers.' : 'Your camera is currently disabled.'}</p>
                    </div>
                </div>
            )}

            {isStreaming && (
                <div className="absolute top-4 left-4 flex items-center space-x-4 text-sm bg-slate-900/30 backdrop-blur-xl p-2 pl-3 rounded-3xl border border-slate-100/10 shadow-lg">
                    <div className="flex items-center space-x-2 bg-red-500/90 px-3 py-1 rounded-full"><div className="w-2 h-2 bg-white rounded-full animate-ping absolute opacity-75"></div><div className="w-2 h-2 bg-white rounded-full"></div><span className="font-semibold uppercase tracking-wider text-xs">Live</span></div>
                    <div className="flex items-center space-x-2 text-slate-200 pr-2"><Eye className="w-5 h-5" /><span className="font-medium">{viewerCount}</span></div>
                    <div className="text-slate-200 font-mono hidden sm:block bg-slate-800/50 px-3 py-1 rounded-lg">{formatDuration(streamDuration)}</div>
                </div>
            )}

            {isStreaming && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <div className="flex items-center space-x-3 bg-slate-900/30 backdrop-blur-xl p-2 rounded-3xl border border-slate-100/10 shadow-lg">
                        <ControlButton onClick={toggleMute} className={isMuted ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-slate-800/70 hover:bg-slate-700/90 text-slate-200'}>{isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}</ControlButton>
                        <ControlButton onClick={toggleVideo} className={isVideoOff ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-slate-800/70 hover:bg-slate-700/90 text-slate-200'}>{isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}</ControlButton>
                        <ControlButton onClick={handleFlipCamera} className="bg-slate-800/70 hover:bg-slate-700/90 text-slate-200"><RotateCcw className="w-6 h-6" /></ControlButton>
                        <div className="w-px h-8 bg-slate-100/10 mx-2"></div>
                        <ControlButton onClick={handlePauseStream} className={isPaused ? 'bg-green-500/80 hover:bg-green-500 text-white' : 'bg-yellow-500/80 hover:bg-yellow-500 text-slate-900'}>{isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}</ControlButton>
                        <ControlButton onClick={handleStopStream} className="bg-red-500/80 hover:bg-red-500 text-white"><Square className="w-6 h-6" /></ControlButton>
                    </div>
                </div>
            )}

            <div className="absolute top-4 right-4 w-80 space-y-4 hidden lg:flex flex-col max-h-[calc(100vh-2rem)]">
                <div className="bg-slate-900/50 backdrop-blur-lg border border-slate-100/10 p-4 rounded-2xl">
                    <h3 className="font-semibold mb-4 flex items-center text-lg"><Monitor className="w-5 h-5 mr-3 text-cyan-400" />Stream Info</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center"><span className="text-slate-400">Status</span><span className={`font-semibold px-2 py-0.5 rounded-md text-xs ${isStreaming ? (isPaused ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300') : 'bg-slate-700 text-slate-300'}`}>{isStreaming ? (isPaused ? 'Paused' : 'Live') : 'Offline'}</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-400">Camera</span><span className="capitalize">{currentCamera === 'user' ? 'Front' : 'Back'}</span></div>
                    </div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-lg border border-slate-100/10 p-4 rounded-2xl">
                    <h3 className="font-semibold mb-4 flex items-center text-lg"><Settings className="w-5 h-5 mr-3 text-cyan-400" />Quick Controls</h3>
                    {!isStreaming ? (
                        <button onClick={handleStartStream} disabled={!isWsConnected} className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ease-in-out flex items-center justify-center space-x-2 transform hover:scale-105 active:scale-100"><Play className="w-5 h-5" /><span>{isWsConnected ? 'Start Stream' : 'Connecting...'}</span></button>
                    ) : (
                        <div className="space-y-3">
                            <button onClick={handlePauseStream} className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2 ${isPaused ? 'bg-green-500/80 hover:bg-green-500 text-white' : 'bg-yellow-500/80 hover:bg-yellow-500 text-slate-900'}`}>{isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}<span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span></button>
                            <button onClick={handleStopStream} className="w-full bg-red-500/80 hover:bg-red-500 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"><Square className="w-5 h-5" /><span>End Stream</span></button>
                        </div>
                    )}
                </div>

                {/* --- NEW CHAT PANEL --- */}
                <div className="bg-slate-900/50 backdrop-blur-lg border border-slate-100/10 rounded-2xl p-4 flex flex-col flex-1">
                    <h3 className="font-semibold mb-4 flex items-center text-lg"><MessageSquare className="w-5 h-5 mr-3 text-cyan-400" />Live Chat</h3>
                    {/* Message List */}
                    <div className="flex-1 space-y-4 pr-2 overflow-y-auto">
                        {mockChatMessages.map((msg, index) => (
                            <div key={index} className="flex flex-col items-start text-sm">
                                <span className={`font-bold ${msg.color}`}>{msg.user}</span>
                                <p className="bg-slate-800/50 p-2 rounded-lg rounded-tl-none mt-1">{msg.message}</p>
                            </div>
                        ))}
                    </div>
                    {/* Chat Input */}
                    <div className="mt-4 flex items-center space-x-2">
                        <input
                            type="text"
                            placeholder="Send a message..."
                            className="flex-1 bg-slate-800/60 border border-slate-600 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none"
                        />
                        <button className="p-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors">
                            <Send className="w-5 h-5 text-slate-900" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StreamerPage;