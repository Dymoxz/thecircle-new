import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Play, Users, Calendar, MessageCircle, Send, RefreshCw, X, LayoutGrid, StopCircle } from 'lucide-react';

// WebSocket URL configuration
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

// Mock Data for Chat Panel
const mockChatMessages = [
    { user: 'Alice', color: 'text-pink-400', message: 'This stream is awesome! 🔥' },
    { user: 'Bob', color: 'text-blue-400', message: 'What game is this?' },
    { user: 'Charlie', color: 'text-teal-400', message: 'Loving the energy! Keep it up!' },
    { user: 'Diana', color: 'text-yellow-400', message: 'Can you show the settings you are using?' },
    { user: 'Eve', color: 'text-purple-400', message: 'Great quality stream! Looks so smooth.' },
];

const VIDEO_CONSTRAINTS = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 60 }
};

const ViewerPage = () => {
    const [streams, setStreams] = useState([]);
    const [currentStreamId, setCurrentStreamId] = useState(null);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [isStreamListOpen, setIsStreamListOpen] = useState(false);

    const remoteVideoRef = useRef(null);
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const viewerId = useRef(uuidv4()).current;

    const streamInfo = {
        streamerName: "CodeMaster_Dev",
        title: "Building a React Streaming App - Live Coding Session",
        viewers: 247,
        category: "Programming",
        tags: ["React", "JavaScript", "WebRTC", "Live Coding"]
    };

    useEffect(() => {
        document.title = 'StreamHub - Watch';
        return () => {
            document.title = 'StreamHub';
        };
    }, []);

    useEffect(() => {
        socketRef.current = new WebSocket(WS_URL);
        const socket = socketRef.current;

        socket.onopen = () => {
            setIsWsConnected(true);
            socket.send(JSON.stringify({ event: 'get-streams', data: {} }));
        };
        socket.onclose = () => setIsWsConnected(false);
        socket.onerror = (err) => console.error('[WS] Error:', err);

        socket.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.event) {
                case 'streams': setStreams(msg.data.streams); break;
                case 'offer': {
                    const { from, offer } = msg.data;
                    const peer = new RTCPeerConnection();
                    peerRef.current = peer;
                    peer.ontrack = (e) => {
                        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
                    };
                    peer.onicecandidate = (e) => {
                        if (e.candidate) socket.send(JSON.stringify({ event: 'ice-candidate', data: { to: from, candidate: e.candidate } }));
                    };
                    await peer.setRemoteDescription(new RTCSessionDescription(offer));
                    // Set preferred video bitrate if possible
                    peer.getTransceivers().forEach(transceiver => {
                        if (transceiver.receiver && transceiver.receiver.track && transceiver.receiver.track.kind === 'video') {
                            const receiver = transceiver.receiver;
                            if (receiver && receiver.getParameters) {
                                const params = receiver.getParameters();
                                if (params.encodings && params.encodings.length > 0) {
                                    params.encodings[0].maxBitrate = 2500 * 1000; // 2.5 Mbps
                                    receiver.setParameters(params);
                                }
                            }
                        }
                    });
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    socket.send(JSON.stringify({ event: 'answer', data: { to: from, answer } }));
                    break;
                }
                case 'ice-candidate': {
                    if (peerRef.current && msg.data.candidate) {
                        await peerRef.current.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
                    }
                    break;
                }
                case 'stream-ended': {
                    if (msg.data.streamId === currentStreamId) {
                        handleStopWatching();
                        alert(`Stream ${msg.data.streamId} has ended.`);
                    }
                    // Always refresh stream list on stream-ended
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current.send(JSON.stringify({ event: 'get-streams', data: {} }));
                    }
                    break;
                }
                default: break;
            }
        };

        return () => {
            socket.close();
            if (peerRef.current) peerRef.current.close();
        };
    }, []);

    const handleConnectToStream = (streamId) => {
        if (peerRef.current) {
            peerRef.current.close();
        }
        setCurrentStreamId(streamId);
        // Send preferred video constraints to backend (optional, for future use)
        socketRef.current.send(JSON.stringify({
            event: 'register',
            data: { id: viewerId, clientType: 'viewer', streamId, video: VIDEO_CONSTRAINTS }
        }));
        setIsStreamListOpen(false); // Close mobile list on selection
    };

    const handleStopWatching = () => {
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        setCurrentStreamId(null);
        // The backend's `handleDisconnect` will manage cleanup.
    };

    const handleRefresh = () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ event: 'get-streams', data: {} }));
        }
    };

    const StreamListPanel = () => (
        <div className="p-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-teal-400">Live Streams</h2>
                <button onClick={handleRefresh} disabled={!isWsConnected} className="p-2 rounded-lg bg-neutral-700/50 hover:bg-neutral-600/50 disabled:opacity-50 transition-colors"><RefreshCw className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 -mr-2 pr-2">
                {streams.length > 0 ? streams.map((streamId) => (
                    <div key={streamId} onClick={() => handleConnectToStream(streamId)} className={`p-3 rounded-2xl cursor-pointer transition-all duration-200 border-2 ${streamId === currentStreamId ? 'bg-teal-500/20 border-teal-400 ring-2 ring-teal-400' : 'bg-neutral-800/60 border-transparent hover:border-neutral-500'}`}>
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-800 rounded-full flex items-center justify-center flex-shrink-0"><Play className="w-5 h-5 text-white" /></div>
                            <div>
                                <h3 className="font-semibold text-sm truncate">Stream {streamId.slice(-8)}</h3>
                                <p className="text-xs text-neutral-400">CodeMaster_Dev</p>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-8 text-neutral-400">
                        <div className="w-16 h-16 bg-neutral-800/50 rounded-full flex items-center justify-center mx-auto mb-4"><Play className="w-8 h-8 text-neutral-500" /></div>
                        <p className="text-sm">No streams available</p>
                    </div>
                )}
            </div>
        </div>
    );

    const ChatPanelContent = () => (
        <>
            <h3 className="font-semibold mb-4 flex items-center text-lg flex-shrink-0"><MessageCircle className="w-5 h-5 mr-3 text-teal-400" />Live Chat</h3>
            <div className="flex-1 space-y-4 pr-2 overflow-y-auto">
                {mockChatMessages.map((msg, index) => (
                    <div key={index} className="flex flex-col items-start text-sm">
                        <span className={`font-bold ${msg.color}`}>{msg.user}</span>
                        <p className="bg-neutral-800/50 p-2 rounded-lg rounded-tl-none mt-1">{msg.message}</p>
                    </div>
                ))}
            </div>
            <div className="mt-4 flex items-center space-x-2 flex-shrink-0">
                <input type="text" placeholder="Send a message..." className="flex-1 bg-neutral-800/60 border border-neutral-600 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none" />
                <button className="p-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"><Send className="w-5 h-5 text-neutral-900" /></button>
            </div>
        </>
    );

    return (
        <div className="h-[100dvh] w-screen text-neutral-100 overflow-hidden bg-neutral-900 relative">
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full" />

            {!currentStreamId && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl z-10">
                    <div className="text-center p-8">
                        <h3 className="text-2xl font-bold mb-2">Select a Stream</h3>
                        <p className="text-neutral-300">Choose a live stream to start watching</p>
                    </div>
                </div>
            )}

            {/* Left Side: Mobile Button & Stream List */}
            <button onClick={() => setIsStreamListOpen(true)} className="absolute top-4 left-4 z-30 bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-full p-3 shadow-lg lg:hidden"><LayoutGrid className="w-6 h-6 text-neutral-100" /></button>
            <div className="absolute top-4 left-4 max-h-[calc(100vh-2rem)] w-80 bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-2xl z-20 hidden lg:flex flex-col"><StreamListPanel /></div>
            {isStreamListOpen && (
                <div className="absolute inset-0 z-40 bg-neutral-900/80 backdrop-blur-2xl lg:hidden">
                    <button onClick={() => setIsStreamListOpen(false)} className="absolute top-4 right-4 z-50 p-2"><X className="w-6 h-6" /></button>
                    <StreamListPanel />
                </div>
            )}

            {/* Right Side Panels (Desktop) */}
            <div className="absolute top-4 right-4 max-h-[calc(100vh-2rem)] w-80 space-y-4 hidden lg:flex flex-col z-20">
                {currentStreamId && (
                    <>
                        <div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-2xl p-4">
                            <h2 className="text-lg font-bold mb-3">{streamInfo.title}</h2>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-800 rounded-full flex-shrink-0 flex items-center justify-center"><span className="text-xs font-bold">CM</span></div>
                                <div className="text-sm">
                                    <p className="font-semibold text-white">{streamInfo.streamerName}</p>
                                    <p className="text-neutral-400">{streamInfo.category}</p>
                                </div>
                            </div>
                            <div className="text-xs text-neutral-300 space-y-2 border-t border-neutral-700 pt-3">
                                <div className="flex items-center space-x-2"><Calendar className="w-4 h-4 text-teal-400" /><span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span></div>
                                <div className="flex items-center space-x-2"><Users className="w-4 h-4 text-teal-400" /><span>{streamInfo.viewers} viewers</span></div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">{streamInfo.tags.map(tag => <span key={tag} className="bg-neutral-700/50 px-3 py-1 rounded-full text-xs">{tag}</span>)}</div>
                        </div>
                        <div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-2xl p-4 flex flex-col flex-1"><ChatPanelContent /></div>
                        <div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-2xl p-3">
                            <button
                                onClick={handleStopWatching}
                                className="flex items-center justify-center w-full px-4 py-3 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm rounded-xl text-white font-semibold transition-colors"
                            >
                                <StopCircle className="w-5 h-5 mr-2" />
                                Stop Watching
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* --- Persistent Mobile UI --- */}
            {currentStreamId && (
                <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col z-30 lg:hidden">
                    <div className="mb-4">
                        <button
                            onClick={handleStopWatching}
                            className="flex items-center justify-center w-full px-4 py-3 bg-red-600/80 hover:bg-red-700/80 backdrop-blur-sm rounded-xl text-white font-semibold transition-colors"
                        >
                            <StopCircle className="w-5 h-5 mr-2" />
                            Stop Watching
                        </button>
                    </div>
                    <div className="h-[40dvh] bg-neutral-900/80 backdrop-blur-2xl rounded-2xl p-4 flex flex-col">
                        <ChatPanelContent />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewerPage;
