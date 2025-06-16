import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Play, Users, Eye, Clock, Calendar, MessageCircle, Send, RefreshCw, X, LayoutGrid } from 'lucide-react';

// WebSocket URL configuration
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

// Mock Data for Chat Panel
const mockChatMessages = [
    { user: 'Alice', color: 'text-pink-400', message: 'This stream is awesome! 🔥' },
    { user: 'Bob', color: 'text-blue-400', message: 'What game is this?' },
    { user: 'Charlie', color: 'text-green-400', message: 'Loving the energy! Keep it up!' },
    { user: 'Diana', color: 'text-yellow-400', message: 'Can you show the settings you are using?' },
    { user: 'Eve', color: 'text-purple-400', message: 'Great quality stream! Looks so smooth.' },
];

const ViewerPage = () => {
    const [streams, setStreams] = useState([]);
    const [currentStreamId, setCurrentStreamId] = useState(null);
    const [chatMessage, setChatMessage] = useState('');
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [isStreamListOpen, setIsStreamListOpen] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    const remoteVideoRef = useRef(null);
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const viewerId = useRef(uuidv4()).current;

    const streamInfo = {
        streamerName: "CodeMaster_Dev",
        title: "Building a React Streaming App - Live Coding Session",
        viewers: 247,
        startTime: "2:34:12",
        category: "Programming",
        tags: ["React", "JavaScript", "WebRTC", "Live Coding"]
    };

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
                        if (peerRef.current) peerRef.current.close();
                        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
                        setCurrentStreamId(null);
                        alert(`Stream ${msg.data.streamId} has ended.`);
                    }
                    socket.send(JSON.stringify({ event: 'get-streams', data: {} }));
                    break;
                }
                default: break;
            }
        };

        return () => {
            socket.close();
            if (peerRef.current) peerRef.current.close();
        };
    }, [currentStreamId]);

    const handleConnectToStream = (streamId) => {
        if (peerRef.current) peerRef.current.close();
        setCurrentStreamId(streamId);
        socketRef.current.send(JSON.stringify({ event: 'register', data: { id: viewerId, clientType: 'viewer', streamId } }));
        setIsStreamListOpen(false); // Close mobile list on selection
    };

    const handleRefresh = () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ event: 'get-streams', data: {} }));
        }
    };

    // UI Render Helper for the Stream List
    const StreamListPanel = () => (
        <div className="p-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-cyan-400">Live Streams</h2>
                <button onClick={handleRefresh} disabled={!isWsConnected} className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 transition-colors"><RefreshCw className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 -mr-2 pr-2">
                {streams.length > 0 ? (
                    streams.map((streamId) => (
                        <div key={streamId} onClick={() => handleConnectToStream(streamId)} className={`p-3 rounded-2xl cursor-pointer transition-all duration-200 border-2 ${streamId === currentStreamId ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400' : 'bg-slate-800/60 border-transparent hover:border-slate-500'}`}>
                            <div className="flex items-center space-x-3"><div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0"><Play className="w-5 h-5 text-white" /></div><div><h3 className="font-semibold text-sm truncate">Stream {streamId.slice(-8)}</h3><p className="text-xs text-slate-400">CodeMaster_Dev</p></div></div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-slate-400"><div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4"><Play className="w-8 h-8 text-slate-500" /></div><p className="text-sm">No streams available</p></div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-[100dvh] w-screen text-slate-100 overflow-hidden bg-slate-900 relative">
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full" />

            {/* --- Overlays & Floating Panels --- */}
            {!currentStreamId && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl z-10">
                    <div className="text-center p-8">
                        <div className="w-24 h-24 bg-cyan-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6"><Play className="w-12 h-12 text-cyan-400" /></div>
                        <h3 className="text-2xl font-bold mb-2">Select a Stream</h3>
                        <p className="text-slate-300">Choose a live stream to start watching</p>
                    </div>
                </div>
            )}

            {/* --- Left Side: Mobile Button & Stream List --- */}
            <button onClick={() => setIsStreamListOpen(true)} className="absolute top-4 left-4 z-30 bg-slate-900/50 backdrop-blur-lg border border-slate-100/10 rounded-full p-3 shadow-lg lg:hidden"><LayoutGrid className="w-6 h-6 text-slate-100" /></button>
            <div className={`absolute top-4 left-4 max-h-[calc(100vh-2rem)] w-80 bg-slate-900/50 backdrop-blur-lg border border-slate-100/10 rounded-2xl z-20 hidden lg:flex flex-col`}><StreamListPanel /></div>
            {isStreamListOpen && <div className="absolute inset-0 z-40 bg-slate-900/80 backdrop-blur-2xl lg:hidden"><StreamListPanel /></div>}


            {/* --- Right Side: Info, Chat Button & Chat Panels --- */}
            <div className="absolute top-4 right-4 max-h-[calc(100vh-2rem)] w-80 space-y-4 flex flex-col z-20">
                {currentStreamId && (
                    <>
                        {/* Stream Info Panel (Desktop) */}
                        <div className="bg-slate-900/50 backdrop-blur-lg border border-slate-100/10 rounded-2xl p-4 hidden lg:block">
                            <h2 className="text-lg font-bold mb-3">{streamInfo.title}</h2>
                            <div className="flex items-center space-x-3 mb-4"><div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex-shrink-0 flex items-center justify-center"><span className="text-xs font-bold">CM</span></div><div className="text-sm"><p className="font-semibold text-white">{streamInfo.streamerName}</p><p className="text-slate-400">{streamInfo.category}</p></div></div>
                            <div className="text-xs text-slate-300 space-y-2 border-t border-slate-700 pt-3"><div className="flex items-center space-x-2"><Calendar className="w-4 h-4 text-cyan-400" /><span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span></div><div className="flex items-center space-x-2"><Users className="w-4 h-4 text-cyan-400" /><span>{streamInfo.viewers} viewers</span></div></div>
                            <div className="flex flex-wrap gap-2 mt-4">{streamInfo.tags.map(tag => <span key={tag} className="bg-slate-700/50 px-3 py-1 rounded-full text-xs">{tag}</span>)}</div>
                        </div>

                        {/* Desktop Chat Panel */}
                        <div className="bg-slate-900/50 backdrop-blur-lg border border-slate-100/10 rounded-2xl p-4 hidden lg:flex flex-col flex-1">
                            <h3 className="font-semibold mb-4 flex items-center text-lg"><MessageCircle className="w-5 h-5 mr-3 text-cyan-400" />Live Chat</h3>
                            <div className="flex-1 space-y-4 pr-2 overflow-y-auto">{mockChatMessages.map((msg, index) => <div key={index} className="flex flex-col items-start text-sm"><span className={`font-bold ${msg.color}`}>{msg.user}</span><p className="bg-slate-800/50 p-2 rounded-lg rounded-tl-none mt-1">{msg.message}</p></div>)}</div>
                            <div className="mt-4 flex items-center space-x-2"><input type="text" placeholder="Send a message..." className="flex-1 bg-slate-800/60 border border-slate-600 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none" /><button className="p-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors"><Send className="w-5 h-5 text-slate-900" /></button></div>
                        </div>

                        {/* Mobile Chat Bubble */}
                        <button onClick={() => setIsMobileChatOpen(true)} className="bg-slate-900/50 backdrop-blur-lg border border-slate-100/10 rounded-full p-3 shadow-lg lg:hidden ml-auto"><MessageCircle className="w-6 h-6 text-slate-100" /></button>
                    </>
                )}
            </div>

            {/* Mobile Chat Overlay */}
            {isMobileChatOpen && (
                <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-2xl flex flex-col p-4 lg:hidden">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0"><h3 className="font-semibold flex items-center text-lg"><MessageCircle className="w-5 h-5 mr-3 text-cyan-400" />Live Chat</h3><button onClick={() => setIsMobileChatOpen(false)} className="p-2 -m-2"><X className="w-6 h-6 text-slate-300" /></button></div>
                    <div className="flex-1 space-y-4 pr-2 overflow-y-auto">{mockChatMessages.map((msg, index) => <div key={index} className="flex flex-col items-start text-sm"><span className={`font-bold ${msg.color}`}>{msg.user}</span><p className="bg-slate-800/50 p-2 rounded-lg rounded-tl-none mt-1">{msg.message}</p></div>)}</div>
                    <div className="mt-4 flex items-center space-x-2 flex-shrink-0"><input type="text" placeholder="Send a message..." className="flex-1 bg-slate-800/60 border border-slate-600 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none" /><button className="p-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors"><Send className="w-5 h-5 text-slate-900" /></button></div>
                </div>
            )}
        </div>
    );
};

export default ViewerPage;