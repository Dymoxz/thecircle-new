import React, { useEffect, useState, useRef } from "react";

// Props: streamId (room), username, wsUrl (e.g. wss://yourserver)
const Chat = ({ streamId, username, wsUrl }) => {
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const wsRef = useRef(null);
	const messagesEndRef = useRef(null);

	useEffect(() => {
		// Connect to backend WebSocket
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			// Register as viewer for this stream
			ws.send(
				JSON.stringify({
					event: "register",
					data: { id: username, clientType: "viewer", streamId },
				})
			);
		};

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				if (
					msg.event === "chat-message" &&
					msg.data.streamId === streamId
				) {
					setMessages((prev) => [
						...prev,
						{
							user: msg.data.senderId,
							text: msg.data.message,
							timestamp: new Date().toISOString(),
						},
					]);
				}
			} catch (e) {}
		};

		return () => {
			ws.close();
		};
	}, [streamId, username, wsUrl]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const sendMessage = (e) => {
		e.preventDefault();
		if (input.trim() && wsRef.current && wsRef.current.readyState === 1) {
			wsRef.current.send(
				JSON.stringify({
					event: "chat-message",
					data: { streamId, senderId: username, message: input },
				})
			);
			setInput("");
		}
	};

	return (
		<div
			style={{
				background: "#18181c",
				borderRadius: 12,
				boxShadow: "0 2px 12px #0008",
				padding: 16,
				width: 340,
				height: 420,
				display: "flex",
				flexDirection: "column",
				color: "#f1f1f1",
			}}
		>
			<div style={{ flex: 1, overflowY: "auto", marginBottom: 8 }}>
				{messages.map((msg, idx) => (
					<div
						key={idx}
						style={{
							marginBottom: 8,
							padding: 6,
							borderRadius: 6,
							background:
								msg.user === username ? "#23232b" : "#202024",
						}}
					>
						<span style={{ fontWeight: "bold", color: "#7dd3fc" }}>
							{msg.user}
						</span>
						<span style={{ marginLeft: 8 }}>{msg.text}</span>
						<span
							style={{
								float: "right",
								fontSize: 10,
								color: "#888",
							}}
						>
							{new Date(msg.timestamp).toLocaleTimeString()}
						</span>
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<form onSubmit={sendMessage} style={{ display: "flex", gap: 8 }}>
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Type a message..."
					style={{
						flex: 1,
						background: "#23232b",
						color: "#f1f1f1",
						border: "none",
						borderRadius: 6,
						padding: "8px 12px",
						outline: "none",
					}}
				/>
				<button
					type="submit"
					disabled={!input.trim()}
					style={{
						background: "#7dd3fc",
						color: "#18181c",
						border: "none",
						borderRadius: 6,
						padding: "8px 16px",
						fontWeight: "bold",
						cursor: "pointer",
					}}
				>
					Send
				</button>
			</form>
		</div>
	);
};

export default Chat;
