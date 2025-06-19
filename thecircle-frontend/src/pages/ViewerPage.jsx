import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Calendar, Play, Users, Pause, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import * as mediasoupClient from 'mediasoup-client';
import { useNavigate, useParams } from 'react-router-dom';
import Chat from '../component/chat';

// WebSocket URL configuration
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

const ViewerPage = () => {
	const { streamId } = useParams();
	const navigate = useNavigate();

	const [isWsConnected, setIsWsConnected] = useState(false);
	const [showPauseOverlay, setShowPauseOverlay] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [volume, setVolume] = useState(1.0);
	const [previousVolume, setPreviousVolume] = useState(1.0);
	const [showVolumeSlider, setShowVolumeSlider] = useState(false);
	const [currentStreamInfo, setCurrentStreamInfo] = useState(null);

	const remoteVideoRef = useRef(null);
	const socketRef = useRef(null);
	const volumeSliderTimeoutRef = useRef(null);
	const viewerId = useRef(uuidv4()).current;
	const streamIdRef = useRef(streamId);
	const username = useRef('Viewer_' + viewerId.slice(0, 8)).current;

	const deviceRef = useRef(null);
	const recvTransportRef = useRef(null);
	const consumersRef = useRef(new Map());

	useEffect(() => {
		document.title = 'StreamHub - Watching Stream';
		return () => {
			document.title = 'StreamHub';
		};
	}, []);

	useEffect(() => {
		// If streamId changes (which it shouldn't in this new model without a page reload),
		// reset the player state.
		setIsPaused(false);
		setIsMuted(false);
		setVolume(1.0);
		setPreviousVolume(1.0);
		setCurrentStreamInfo(null);
	}, [streamId]);

	useEffect(() => {
		if (!streamId) {
			console.error("No stream ID provided in URL.");
			navigate('/');
			return;
		}
		streamIdRef.current = streamId;

		socketRef.current = new WebSocket(WS_URL);
		const socket = socketRef.current;

		socket.onopen = () => {
			setIsWsConnected(true);
			handleConnectToStream(streamId);
		};
		socket.onclose = () => setIsWsConnected(false);
		socket.onerror = (err) => console.error('[WS] Error:', err);

		socket.onmessage = async (event) => {
			const msg = JSON.parse(event.data);
			console.log('[WS MESSAGE]', msg);
			switch (msg.event) {
				case 'streams': {
					const info = msg.data.streams.find(s => s.streamId === streamId);
					if (info) {
						setCurrentStreamInfo(info);
					} else {
						console.warn(`Stream ${streamId} not found in the list. It may have ended.`);
						alert('The stream is no longer available.');
						navigate('/');
					}
					break;
				}
				case 'rtp-capabilities': {
					const { rtpCapabilities } = msg.data;
					if (deviceRef.current) {
						await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });
					}
					break;
				}
				case 'transport-created': {
					const { transport } = msg.data;
					await createRecvTransport(transport, streamIdRef.current);
					await consumeTracks(streamIdRef.current);
					break;
				}
				case 'transport-connected': {
					console.log('Transport connected');
					break;
				}
				case 'consumed': {
					const { consumer } = msg.data;
					await handleConsumer(consumer);
					break;
				}
				case 'stream-ended': {
					if (msg.data.streamId === streamId) {
						alert(`The stream has ended.`);
						handleStopWatching();
					}
					break;
				}
				case 'stream-paused':
					setShowPauseOverlay(true);
					if (remoteVideoRef.current) remoteVideoRef.current.pause();
					break;
				case 'stream-resumed':
					setShowPauseOverlay(false);
					if (remoteVideoRef.current) remoteVideoRef.current.play();
					break;
				case 'error':
					console.error('Server error:', msg.data.message);
					break;
				default:
					break;
			}
		};

		return () => {
			socket.close();
			if (recvTransportRef.current) recvTransportRef.current.close();
			consumersRef.current.forEach(consumer => consumer.close());
			consumersRef.current.clear();
			if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
		};
	}, [streamId, navigate]);

	const handleConnectToStream = async (streamIdToConnect) => {
		console.log('Connecting to stream:', streamIdToConnect);
		if (recvTransportRef.current) recvTransportRef.current.close();
		consumersRef.current.forEach(consumer => consumer.close());
		consumersRef.current.clear();

		try {
			const socket = socketRef.current;
			socket.send(JSON.stringify({ event: 'register', data: { id: viewerId, clientType: 'viewer', streamId: streamIdToConnect } }));
			socket.send(JSON.stringify({ event: 'create-transport', data: { streamId: streamIdToConnect, isStreamer: false } }));
			socket.send(JSON.stringify({ event: 'get-streams', data: {} }));
		} catch (error) {
			console.error('Error connecting to stream:', error);
		}
	};

	const handleStopWatching = () => {
		console.log('Stopping watching');
		if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.close();
		if (recvTransportRef.current) recvTransportRef.current.close();
		consumersRef.current.forEach(consumer => consumer.close());
		if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
		navigate('/');
	};

	const ChatPanel = () => (
		<Chat
			streamId={streamId}
			username={username}
			socket={socketRef.current}
			myStream={false}
		/>
	);

	// Mediasoup and player control functions (createRecvTransport, handleConsumer, handlePause, etc.)
	// remain largely the same as in your original file. I'm omitting them here for brevity
	// as their internal logic doesn't need to change, only how they are called.
	// Make sure to include all of them from your original file.
	// ... createRecvTransport, getRtpCapabilities, connectTransport, consume, handleConsumer ...
	// ... handlePause, handleMute, handleVolumeChange, and related useEffects ...

	return (
		<div className="h-[100dvh] w-screen text-neutral-100 overflow-hidden bg-neutral-900 flex">
			{/* Main Content Area (Video) */}
			<div className="flex-grow h-full relative bg-black">
				<video
					ref={remoteVideoRef}
					autoPlay
					playsInline
					className="absolute inset-0 w-full h-full object-contain"
					onPlay={() => setIsPaused(false)}
					onPause={() => setIsPaused(true)}
				/>

				{showPauseOverlay && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-20">
						<div className="text-center p-8">
							<div className="w-24 h-24 bg-neutral-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
								<Play className="w-12 h-12 text-neutral-400" />
							</div>
							<h3 className="text-2xl font-bold mb-2">Stream Paused</h3>
							<p className="text-neutral-300">The streamer has paused the broadcast.</p>
						</div>
					</div>
				)}

				{isPaused && !showPauseOverlay && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-20" />
				)}

				<button
					onClick={handleStopWatching}
					className="absolute top-4 left-4 z-30 bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-full p-3 shadow-lg text-neutral-100 hover:bg-neutral-800/50 transition-colors"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>

				<div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
					{/* Your Bottom Controls Bar JSX here, it can stay the same */}
				</div>
			</div>

			{/* Right Sidebar for Info and Chat */}
			<div className="w-80 lg:w-96 flex-shrink-0 h-full bg-neutral-900/60 backdrop-blur-xl border-l border-neutral-700/50 flex flex-col">
				{currentStreamInfo ? (
					<>
						<div className="p-4 border-b border-neutral-700/50 flex-shrink-0">
							<h2 className="text-lg font-bold mb-3">{currentStreamInfo.title || 'Untitled Stream'}</h2>
							<div className="flex items-center space-x-3 mb-4">
								<div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-800 rounded-full flex-shrink-0 flex items-center justify-center">
                                    <span className="text-xs font-bold">
                                        {(currentStreamInfo.streamerName || 'S').slice(0,2).toUpperCase()}
                                    </span>
								</div>
								<div className="text-sm">
									<p className="font-semibold text-white">{currentStreamInfo.streamerName}</p>
									<p className="text-neutral-400">{currentStreamInfo.category}</p>
								</div>
							</div>
							<div className="text-xs text-neutral-300 space-y-2">
								<div className="flex items-center space-x-2"><Users className="w-4 h-4 text-teal-400"/><span>{currentStreamInfo.viewers || 0} viewers</span></div>
							</div>
							<div className="flex flex-wrap gap-2 mt-4">
								{(Array.isArray(currentStreamInfo.tags) ? currentStreamInfo.tags : (currentStreamInfo.tags || '').split(',')).filter(Boolean).map(tag => (
									<span key={tag} className="bg-neutral-700/50 px-3 py-1 rounded-full text-xs">{tag}</span>
								))}
							</div>
						</div>
						<div className="flex-grow overflow-y-auto">
							<ChatPanel />
						</div>
					</>
				) : (
					<div className="flex items-center justify-center h-full text-neutral-400">
						<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
						<span className="ml-3">Loading Stream Info...</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default ViewerPage;