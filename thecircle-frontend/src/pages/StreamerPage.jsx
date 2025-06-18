import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
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
	Send, // New Icon
} from "lucide-react";
import Chat from "../component/chat.jsx";

// WebSocket URL configuration
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

// --- Helper Component for Styled Buttons ---
const ControlButton = ({ onClick, children, className = "", ...props }) => (
	<button
		onClick={onClick}
		className={`p-3 rounded-2xl backdrop-blur-lg transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 ${className}`}
		{...props}
	>
		{children}
	</button>
);

const VIDEO_CONSTRAINTS = {
	width: { ideal: 1280 },
	height: { ideal: 720 },
	frameRate: { ideal: 30, max: 60 },
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

	const localVideoRef = useRef(null);
	const socketRef = useRef(null);
	const [isWsConnected, setIsWsConnected] = useState(false);
	const localStreamRef = useRef(null);
	const peersRef = useRef(new Map());
	const blankTracksRef = useRef({ video: null, audio: null });
	const streamStartTime = useRef(null);
	const durationInterval = useRef(null);

	const streamerId = useRef(uuidv4()).current;
	const streamId = `stream-${streamerId}`; // Define streamId here

	useEffect(() => {
		document.title = "StreamHub - Stream";
		return () => {
			document.title = "StreamHub";
		};
	}, []);

	const createBlankTracks = async () => {
		const canvas = document.createElement("canvas");
		canvas.width = 640;
		canvas.height = 480;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#000";
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
			return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
				.toString()
				.padStart(2, "0")}`;
		}
		return `${minutes}:${secs.toString().padStart(2, "0")}`;
	};

	useEffect(() => {
		socketRef.current = new WebSocket(WS_URL);
		const socket = socketRef.current;

		socket.onopen = () => setIsWsConnected(true);
		socket.onclose = () => setIsWsConnected(false);
		socket.onerror = (err) => console.error("[WS] Error:", err);

		socket.onmessage = async (event) => {
			const msg = JSON.parse(event.data);
			switch (msg.event) {
				case "viewer-joined": {
					const { viewerId } = msg.data;
					if (!viewerId) break;
					const peer = new RTCPeerConnection();
					peersRef.current.set(viewerId, peer);
					setViewerCount((prev) => prev + 1);
					if (localStreamRef.current) {
						localStreamRef.current.getTracks().forEach((track) => {
							const sender = peer.addTrack(
								track,
								localStreamRef.current
							);
							// Set higher max bitrate for video tracks
							if (
								track.kind === "video" &&
								sender.setParameters
							) {
								const params = sender.getParameters();
								if (!params.encodings) params.encodings = [{}];
								params.encodings[0].maxBitrate = 6000 * 1000; // 2.5 Mbps
								sender.setParameters(params);
							}
						});
					}
					peer.onicecandidate = (e) => {
						if (e.candidate)
							socket.send(
								JSON.stringify({
									event: "ice-candidate",
									data: {
										to: viewerId,
										candidate: e.candidate,
									},
								})
							);
					};
					const offer = await peer.createOffer();
					await peer.setLocalDescription(offer);
					socket.send(
						JSON.stringify({
							event: "offer",
							data: { to: viewerId, offer },
						})
					);
					break;
				}
				case "answer": {
					const { from, answer } = msg.data;
					const peer = peersRef.current.get(from);
					if (peer)
						await peer.setRemoteDescription(
							new RTCSessionDescription(answer)
						);
					break;
				}
				case "ice-candidate": {
					const { from, candidate } = msg.data;
					const peer = peersRef.current.get(from);
					if (peer && candidate)
						await peer.addIceCandidate(
							new RTCIceCandidate(candidate)
						);
					break;
				}
				default:
					break;
			}
		};

		createBlankTracks();

		return () => {
			socket.close();
			if (localStreamRef.current)
				localStreamRef.current
					.getTracks()
					.forEach((track) => track.stop());
			clearInterval(durationInterval.current);
			peersRef.current.forEach((peer) => peer.close());
		};
	}, []);

	useEffect(() => {
		if (isStreaming && !isPaused) {
			durationInterval.current = setInterval(() => {
				if (streamStartTime.current) {
					setStreamDuration(
						Math.floor(
							(Date.now() - streamStartTime.current) / 1000
						)
					);
				}
			}, 1000);
		} else {
			clearInterval(durationInterval.current);
		}
		return () => clearInterval(durationInterval.current);
	}, [isStreaming, isPaused]);

	const handleStartStream = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { ...VIDEO_CONSTRAINTS, facingMode: currentCamera },
				audio: AUDIO_CONSTRAINTS,
			});
			localStreamRef.current = stream;
			if (localVideoRef.current) localVideoRef.current.srcObject = stream;
			const streamId = `stream-${streamerId}`;
			socketRef.current.send(
				JSON.stringify({
					event: "register",
					data: { id: streamerId, clientType: "streamer", streamId },
				})
			);
			setIsStreaming(true);
			streamStartTime.current = Date.now();
		} catch (err) {
			console.error("Could not access camera/mic:", err);
			alert("Could not access camera/mic: " + err.message);
		}
	};

	const handleStopStream = () => {
		// Send end-stream event to backend before cleanup
		if (
			socketRef.current &&
			socketRef.current.readyState === WebSocket.OPEN
		) {
			socketRef.current.send(
				JSON.stringify({
					event: "end-stream",
					data: { id: streamerId, streamId: `stream-${streamerId}` },
				})
			);
		}
		if (localStreamRef.current)
			localStreamRef.current.getTracks().forEach((track) => track.stop());
		localStreamRef.current = null;
		if (localVideoRef.current) localVideoRef.current.srcObject = null;
		peersRef.current.forEach((peer) => peer.close());
		peersRef.current.clear();
		setIsStreaming(false);
		setIsPaused(false);
		setViewerCount(0);
		setStreamDuration(0);
		streamStartTime.current = null;
	};

	const handlePauseStream = () => {
		const nextPausedState = !isPaused;
		peersRef.current.forEach((peer) => {
			peer.getSenders().forEach((sender) => {
				if (sender.track?.kind === "video")
					sender.replaceTrack(
						nextPausedState
							? blankTracksRef.current.video
							: localStreamRef.current.getVideoTracks()[0]
					);
				if (sender.track?.kind === "audio")
					sender.replaceTrack(
						nextPausedState
							? blankTracksRef.current.audio
							: localStreamRef.current.getAudioTracks()[0]
					);
			});
		});
		setIsPaused(nextPausedState);
	};

	const handleFlipCamera = async () => {
		if (!isStreaming || !localStreamRef.current) return;
		const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
		if (currentVideoTrack) currentVideoTrack.stop();

		const newFacingMode = currentCamera === "user" ? "environment" : "user";
		try {
			const newStream = await navigator.mediaDevices.getUserMedia({
				video: { ...VIDEO_CONSTRAINTS, facingMode: newFacingMode },
			});
			const newVideoTrack = newStream.getVideoTracks()[0];
			const audioTrack = localStreamRef.current.getAudioTracks()[0];
			localStreamRef.current = new MediaStream([
				newVideoTrack,
				audioTrack,
			]);

			if (localVideoRef.current)
				localVideoRef.current.srcObject = localStreamRef.current;

			peersRef.current.forEach((peer) => {
				const sender = peer
					.getSenders()
					.find((s) => s.track?.kind === "video");
				if (sender) {
					sender.replaceTrack(newVideoTrack);
					// Set higher max bitrate for new video track
					if (sender.setParameters) {
						const params = sender.getParameters();
						if (!params.encodings) params.encodings = [{}];
						params.encodings[0].maxBitrate = 6000 * 1000;
						sender.setParameters(params);
					}
				}
			});
			setCurrentCamera(newFacingMode);
		} catch (err) {
			console.error("Could not flip camera:", err);
			if (currentVideoTrack)
				localStreamRef.current.addTrack(currentVideoTrack);
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
			<video
				ref={localVideoRef}
				autoPlay
				muted
				playsInline
				className="absolute inset-0 w-full h-full"
			/>

			{/* --- OVERLAYS --- */}

			{!isStreaming && (
				<div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl transition-opacity duration-500">
					<div className="text-center p-8">
						<div className="w-24 h-24 bg-neutral-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
							<Camera className="w-12 h-12 text-teal-400" />
						</div>
						<h3 className="text-2xl font-bold mb-2">
							Ready to Stream
						</h3>
						<p className="text-neutral-300 mb-6 max-w-sm">
							Press the button below or in the side panel to
							start.
						</p>
						<button
							onClick={handleStartStream}
							disabled={!isWsConnected}
							className="bg-teal-500 hover:bg-teal-600 disabled:bg-neutral-600 disabled:cursor-not-allowed text-neutral-900 px-8 py-3 rounded-2xl font-semibold transition-all duration-300 ease-in-out shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 transform hover:scale-105 lg:hidden"
						>
							{isWsConnected ? "Start Stream" : "Connecting..."}
						</button>
					</div>
				</div>
			)}

			{isStreaming && (isPaused || isVideoOff) && (
				<div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl transition-opacity duration-500">
					<div className="text-center p-8">
						<div className="w-24 h-24 bg-neutral-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
							{isPaused ? (
								<Pause className="w-12 h-12 text-neutral-400" />
							) : (
								<VideoOff className="w-12 h-12 text-neutral-400" />
							)}
						</div>
						<h3 className="text-2xl font-bold mb-2">
							{isPaused ? "Stream Paused" : "Camera Off"}
						</h3>
						<p className="text-neutral-300 max-w-sm">
							{isPaused
								? "Your stream is currently paused for viewers."
								: "Your camera is currently disabled."}
						</p>
					</div>
				</div>
			)}

			{isStreaming && (
				<div className="absolute top-4 left-4 flex items-center space-x-4 text-sm bg-neutral-900/30 backdrop-blur-xl p-2 pl-3 rounded-3xl border border-neutral-100/10 shadow-lg">
					<div className="flex items-center space-x-2 bg-red-500/90 px-3 py-1 rounded-full">
						<div className="w-2 h-2 bg-white rounded-full animate-ping absolute opacity-75"></div>
						<div className="w-2 h-2 bg-white rounded-full"></div>
						<span className="font-semibold uppercase tracking-wider text-xs">
							Live
						</span>
					</div>
					<div className="flex items-center space-x-2 text-neutral-200 pr-2">
						<Eye className="w-5 h-5" />
						<span className="font-medium">{viewerCount}</span>
					</div>
					<div className="text-neutral-200 font-mono hidden sm:block bg-neutral-800/50 px-3 py-1 rounded-lg">
						{formatDuration(streamDuration)}
					</div>
				</div>
			)}

			{isStreaming && (
				<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
					<div className="flex items-center space-x-3 bg-neutral-900/30 backdrop-blur-xl p-2 rounded-3xl border border-neutral-100/10 shadow-lg">
						<ControlButton
							onClick={toggleMute}
							className={
								isMuted
									? "bg-red-500/80 hover:bg-red-500 text-white"
									: "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"
							}
						>
							{isMuted ? (
								<MicOff className="w-6 h-6" />
							) : (
								<Mic className="w-6 h-6" />
							)}
						</ControlButton>
						<ControlButton
							onClick={toggleVideo}
							className={
								isVideoOff
									? "bg-red-500/80 hover:bg-red-500 text-white"
									: "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"
							}
						>
							{isVideoOff ? (
								<VideoOff className="w-6 h-6" />
							) : (
								<Video className="w-6 h-6" />
							)}
						</ControlButton>
						<ControlButton
							onClick={handleFlipCamera}
							className="bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"
						>
							<RotateCcw className="w-6 h-6" />
						</ControlButton>
						<div className="w-px h-8 bg-neutral-100/10 mx-2"></div>
						<ControlButton
							onClick={handlePauseStream}
							className={
								isPaused
									? "bg-teal-500/80 hover:bg-teal-500 text-white"
									: "bg-yellow-500/80 hover:bg-yellow-500 text-neutral-900"
							}
						>
							{isPaused ? (
								<Play className="w-6 h-6" />
							) : (
								<Pause className="w-6 h-6" />
							)}
						</ControlButton>
						<ControlButton
							onClick={handleStopStream}
							className="bg-red-500/80 hover:bg-red-500 text-white"
						>
							<Square className="w-6 h-6" />
						</ControlButton>
					</div>
				</div>
			)}

			<div className="absolute top-4 right-4 w-80 space-y-4 hidden lg:flex flex-col max-h-[calc(100vh-2rem)]">
				<div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 p-4 rounded-2xl">
					<h3 className="font-semibold mb-4 flex items-center text-lg">
						<Monitor className="w-5 h-5 mr-3 text-teal-400" />
						Stream Info
					</h3>
					<div className="space-y-3 text-sm">
						<div className="flex justify-between items-center">
							<span className="text-neutral-400">Status</span>
							<span
								className={`font-semibold px-2 py-0.5 rounded-md text-xs ${
									isStreaming
										? isPaused
											? "bg-yellow-500/20 text-yellow-300"
											: "bg-teal-500/20 text-teal-300"
										: "bg-neutral-700 text-neutral-300"
								}`}
							>
								{isStreaming
									? isPaused
										? "Paused"
										: "Live"
									: "Offline"}
							</span>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-neutral-400">Camera</span>
							<span className="capitalize">
								{currentCamera === "user" ? "Front" : "Back"}
							</span>
						</div>
					</div>
				</div>
				<div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 p-4 rounded-2xl">
					<h3 className="font-semibold mb-4 flex items-center text-lg">
						<Settings className="w-5 h-5 mr-3 text-teal-400" />
						Quick Controls
					</h3>
					{!isStreaming ? (
						<button
							onClick={handleStartStream}
							disabled={!isWsConnected}
							className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-neutral-600 disabled:cursor-not-allowed text-neutral-900 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ease-in-out flex items-center justify-center space-x-2 transform hover:scale-105 active:scale-100"
						>
							<Play className="w-5 h-5" />
							<span>
								{isWsConnected
									? "Start Stream"
									: "Connecting..."}
							</span>
						</button>
					) : (
						<div className="space-y-3">
							<button
								onClick={handlePauseStream}
								className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2 ${
									isPaused
										? "bg-teal-500/80 hover:bg-teal-500 text-white"
										: "bg-yellow-500/80 hover:bg-yellow-500 text-neutral-900"
								}`}
							>
								{isPaused ? (
									<Play className="w-5 h-5" />
								) : (
									<Pause className="w-5 h-5" />
								)}
								<span>
									{isPaused
										? "Resume Stream"
										: "Pause Stream"}
								</span>
							</button>
							<button
								onClick={handleStopStream}
								className="w-full bg-red-500/80 hover:bg-red-500 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
							>
								<Square className="w-5 h-5" />
								<span>End Stream</span>
							</button>
						</div>
					)}
				</div>

				{/* --- NEW CHAT PANEL --- */}
				<Chat
					streamId={streamId} // make sure streamId is defined in your component
					username={streamerId} // or whatever variable holds the streamer's username/id
					wsUrl={WS_URL}
					myStream={true}
				/>
			</div>
		</div>
	);
};

export default StreamerPage;
