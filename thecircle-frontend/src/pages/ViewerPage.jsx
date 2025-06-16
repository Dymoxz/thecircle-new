// src/pages/ViewerPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import Chat from "../component/chat";

// --- START OF FIX ---
// No longer hardcoded. This will use the same hostname as the browser's address bar.
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;
// --- END OF FIX ---

const ViewerPage = () => {
	const [streams, setStreams] = useState([]);
	const [currentStreamId, setCurrentStreamId] = useState(null);
	const remoteVideoRef = useRef(null);
	const socketRef = useRef(null);
	const [isWsConnected, setIsWsConnected] = useState(false);
	const peerRef = useRef(null);

	const viewerId = useRef(uuidv4()).current;

	useEffect(() => {
		socketRef.current = new WebSocket(WS_URL);
		const socket = socketRef.current;

		socket.onopen = () => {
			console.log(`[WS] Viewer WebSocket connected to ${WS_URL}`);
			setIsWsConnected(true);
			socket.send(JSON.stringify({ event: "get-streams", data: {} }));
		};

		socket.onclose = () => {
			console.log("[WS] Viewer WebSocket disconnected");
			setIsWsConnected(false);
		};
		socket.onerror = (err) =>
			console.error("[WS] Viewer WebSocket error:", err);

		socket.onmessage = async (event) => {
			const msg = JSON.parse(event.data);
			console.log("[WS] Viewer received:", msg);

			switch (msg.event) {
				case "streams":
					setStreams(msg.data.streams);
					break;
				case "offer": {
					const { from, offer } = msg.data;
					const peer = new RTCPeerConnection();
					peerRef.current = peer;

					peer.ontrack = (e) => {
						if (remoteVideoRef.current) {
							remoteVideoRef.current.srcObject = e.streams[0];
						}
					};

					peer.onicecandidate = (e) => {
						if (e.candidate) {
							socket.send(
								JSON.stringify({
									event: "ice-candidate",
									data: { to: from, candidate: e.candidate },
								})
							);
						}
					};

					await peer.setRemoteDescription(
						new RTCSessionDescription(offer)
					);
					const answer = await peer.createAnswer();
					await peer.setLocalDescription(answer);
					socket.send(
						JSON.stringify({
							event: "answer",
							data: { to: from, answer },
						})
					);
					break;
				}

				case "ice-candidate": {
					const { candidate } = msg.data;
					if (peerRef.current && candidate) {
						await peerRef.current.addIceCandidate(
							new RTCIceCandidate(candidate)
						);
					}
					break;
				}
				case "stream-ended": {
					const { streamId } = msg.data;
					if (streamId === currentStreamId) {
						if (peerRef.current) peerRef.current.close();
						if (remoteVideoRef.current)
							remoteVideoRef.current.srcObject = null;
						setCurrentStreamId(null);
						alert(`Stream ${streamId} has ended.`);
					}
					socket.send(
						JSON.stringify({ event: "get-streams", data: {} })
					);
					break;
				}
				default:
					break;
			}
		};

		return () => {
			if (socket) socket.close();
			if (peerRef.current) peerRef.current.close();
		};
	}, [currentStreamId]);

	const handleConnectToStream = (streamId) => {
		if (peerRef.current) {
			peerRef.current.close();
		}
		setCurrentStreamId(streamId);
		socketRef.current.send(
			JSON.stringify({
				event: "register",
				data: { id: viewerId, clientType: "viewer", streamId },
			})
		);
	};

	const handleRefresh = () => {
		if (
			socketRef.current &&
			socketRef.current.readyState === WebSocket.OPEN
		) {
			socketRef.current.send(
				JSON.stringify({ event: "get-streams", data: {} })
			);
		}
	};

	return (
		<div className="container">
			<h1>Viewer Page</h1>
			<div className="sidebar">
				<h2>Available Streams</h2>
				<button onClick={handleRefresh} disabled={!isWsConnected}>
					Refresh Streams
				</button>
				<ul>
					{streams.length > 0 ? (
						streams.map((s) => (
							<li
								key={s}
								onClick={() => handleConnectToStream(s)}
							>
								{s} {s === currentStreamId && "(Watching)"}
							</li>
						))
					) : (
						<p>No streams available.</p>
					)}
				</ul>
			</div>
			<div className="main">
				<video
					ref={remoteVideoRef}
					autoPlay
					playsInline
					controls
					style={{ width: "100%" }}
				></video>
			</div>
			<Chat
				streamId={currentStreamId}
				username={viewerId}
				wsUrl="wss://145.49.40.90:3001"
			/>
		</div>
	);
};

export default ViewerPage;
