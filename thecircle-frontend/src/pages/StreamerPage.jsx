// src/pages/StreamerPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// --- START OF FIX ---
// No longer hardcoded. This will use the same hostname as the browser's address bar.
// e.g., if you access at https://192.168.1.10:8080, it will connect to wss://192.168.1.10:3001
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;
// --- END OF FIX ---

const StreamerPage = () => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const localVideoRef = useRef(null);
    const socketRef = useRef(null);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const localStreamRef = useRef(null);
    const peersRef = useRef(new Map());
    const blankTracksRef = useRef({ video: null, audio: null });

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

    useEffect(() => {
        socketRef.current = new WebSocket(WS_URL);
        const socket = socketRef.current;

        socket.onopen = () => {
            console.log(`[WS] Streamer WebSocket connected to ${WS_URL}`);
            setIsWsConnected(true);
        };

        socket.onclose = () => {
            console.log('[WS] Streamer WebSocket disconnected');
            setIsWsConnected(false);
        };
        socket.onerror = (err) => console.error('[WS] Streamer WebSocket error:', err);

        socket.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            console.log('[WS] Streamer received:', msg);

            switch (msg.event) {
                case 'viewer-joined': {
                    const { viewerId } = msg.data;
                    console.log(`[PEER] Creating peer connection for new viewer: ${viewerId}`);

                    if (!viewerId) {
                        console.error("viewer-joined message received without a viewerId!");
                        break;
                    }

                    const peer = new RTCPeerConnection();
                    peersRef.current.set(viewerId, peer);

                    localStreamRef.current.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current));

                    peer.onicecandidate = (e) => {
                        if (e.candidate) {
                            socket.send(JSON.stringify({
                                event: 'ice-candidate',
                                data: { to: viewerId, candidate: e.candidate }
                            }));
                        }
                    };

                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);

                    socket.send(JSON.stringify({
                        event: 'offer',
                        data: { to: viewerId, offer }
                    }));
                    break;
                }
                case 'answer': {
                    const { from, answer } = msg.data;
                    const peer = peersRef.current.get(from);
                    if (peer) {
                        await peer.setRemoteDescription(new RTCSessionDescription(answer));
                    }
                    break;
                }
                case 'ice-candidate': {
                    const { from, candidate } = msg.data;
                    const peer = peersRef.current.get(from);
                    if (peer && candidate) {
                        await peer.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                    break;
                }
                default:
                    break;
            }
        };

        createBlankTracks();

        return () => {
            if (socket) socket.close();
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            peersRef.current.forEach(peer => peer.close());
        };
    }, []);

    const streamerId = useRef(uuidv4()).current;

    const handleStartStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const streamId = `stream-${streamerId}`;
            socketRef.current.send(JSON.stringify({
                event: 'register',
                data: { id: streamerId, clientType: 'streamer', streamId }
            }));
            setIsStreaming(true);
        } catch (err) {
            console.error("Could not access camera/mic:", err);
            alert("Could not access camera/mic: " + err.message);
        }
    };

    const handleStopStream = () => {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;

        peersRef.current.forEach(peer => peer.close());
        peersRef.current.clear();
        setIsStreaming(false);
        setIsPaused(false);
        // You might want to notify the server that the stream ended
    };

    const handlePauseStream = () => {
        const nextPausedState = !isPaused;
        peersRef.current.forEach(peer => {
            peer.getSenders().forEach(sender => {
                if (sender.track.kind === 'video') {
                    sender.replaceTrack(nextPausedState ? blankTracksRef.current.video : localStreamRef.current.getVideoTracks()[0]);
                }
                if (sender.track.kind === 'audio') {
                    sender.replaceTrack(nextPausedState ? blankTracksRef.current.audio : localStreamRef.current.getAudioTracks()[0]);
                }
            });
        });
        setIsPaused(nextPausedState);
    };

    return (
        <div className="container">
            <h1>Streamer Page</h1>
            <div className="controls">
                <button onClick={handleStartStream} disabled={isStreaming || !isWsConnected}>
                    {isWsConnected ? 'Start Stream' : 'Connecting...'}
                </button>
                <button onClick={handleStopStream} disabled={!isStreaming}>Stop Stream</button>
                <button onClick={handlePauseStream} disabled={!isStreaming}>
                    {isPaused ? 'Resume Stream' : 'Pause Stream'}
                </button>
            </div>
            <div className="video-container">
                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%' }}></video>
                {isPaused && <div className="pause-overlay">Stream Paused</div>}
            </div>
        </div>
    );
};

export default StreamerPage;