import React, { useEffect, useState, useRef } from "react";

// Helper functions for key management and signing/verifying
const KEY_NAME = "chat_keypair";

async function generateKeyPair() {
	return window.crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"]
	);
}
// pub, priv

async function exportPublicKey(key) {
	const spki = await window.crypto.subtle.exportKey("spki", key);
	return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

async function importPublicKey(spkiB64) {
	const binary = Uint8Array.from(atob(spkiB64), (c) => c.charCodeAt(0));
	return window.crypto.subtle.importKey(
		"spki",
		binary,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		true,
		["verify"]
	);
}

async function exportPrivateKey(key) {
	const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", key);
	return btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
}

async function importPrivateKey(pkcs8B64) {
	const binary = Uint8Array.from(atob(pkcs8B64), (c) => c.charCodeAt(0));
	return window.crypto.subtle.importKey(
		"pkcs8",
		binary,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		true,
		["sign"]
	);
}

async function getOrCreateKeyPair() {
	let stored = localStorage.getItem(KEY_NAME);
	if (stored) {
		const { pub, priv } = JSON.parse(stored);
		return {
			publicKey: await importPublicKey(pub),
			privateKey: await importPrivateKey(priv),
			pubB64: pub,
		};
	} else {
		const keyPair = await generateKeyPair();
		const pub = await exportPublicKey(keyPair.publicKey);
		const priv = await exportPrivateKey(keyPair.privateKey);
		localStorage.setItem(KEY_NAME, JSON.stringify({ pub, priv }));
		return {
			publicKey: keyPair.publicKey,
			privateKey: keyPair.privateKey,
			pubB64: pub,
		};
	}
}

async function signMessage(privateKey, dataObj) {
	const enc = new TextEncoder();
	const dataStr = JSON.stringify(dataObj);
	const data = enc.encode(dataStr);
	const sig = await window.crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		privateKey,
		data
	);
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyMessage(publicKey, dataObj, signatureB64) {
	const enc = new TextEncoder();
	const dataStr = JSON.stringify(dataObj);
	const data = enc.encode(dataStr);
	const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
	return window.crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		publicKey,
		sig,
		data
	);
}

// Props: streamId (room), username, wsUrl (e.g. wss://yourserver)
const Chat = ({ streamId, username, wsUrl }) => {
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const wsRef = useRef(null);
	const messagesEndRef = useRef(null);
	const keyPairRef = useRef(null);

	useEffect(() => {
		// Generate or load keypair on mount
		getOrCreateKeyPair().then((kp) => {
			keyPairRef.current = kp;
		});
	}, []);

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

		ws.onmessage = async (event) => {
			try {
				const msg = JSON.parse(event.data);
				if (
					msg.event === "chat-message" &&
					msg.data.streamId === streamId
				) {
					console.log("[Chat] Received message:", msg.data);
					// Try to verify signature if present
					let verified = false;
					if (msg.data.signature && msg.data.publicKey) {
						try {
							const pubKey = await importPublicKey(
								msg.data.publicKey
							);
							const dataObj = {
								streamId: msg.data.streamId,
								senderId: msg.data.senderId,
								message: msg.data.message,
								timestamp: msg.data.timestamp,
							};
							console.log(
								"[Chat] Verifying with publicKey:",
								msg.data.publicKey
							);
							console.log(
								"[Chat] Verifying signature:",
								msg.data.signature
							);
							verified = await verifyMessage(
								pubKey,
								dataObj,
								msg.data.signature
							);
						} catch (err) {
							console.error(
								"[Chat] Signature verification error:",
								err
							);
						}
					}
					setMessages((prev) => [
						...prev,
						{
							user: msg.data.senderId,
							text: msg.data.message,
							timestamp: msg.data.timestamp,
							verified,
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

	const sendMessage = async (e) => {
		e.preventDefault();
		if (
			input.trim() &&
			wsRef.current &&
			wsRef.current.readyState === 1 &&
			keyPairRef.current
		) {
			const timestamp = new Date().toISOString();
			const dataObj = {
				streamId,
				senderId: username,
				message: input,
				timestamp,
			};
			const signature = await signMessage(
				keyPairRef.current.privateKey,
				dataObj
			);
			console.log("[Chat] viewerId:", username);
			console.log("[Chat] streamId:", streamId);

			console.log("[Chat] Sending message:", dataObj);
			console.log("[Chat] Public Key (b64):", keyPairRef.current.pubB64);
			console.log("[Chat] Signature (b64):", signature);
			wsRef.current.send(
				JSON.stringify({
					event: "chat-message",
					data: {
						...dataObj,
						signature,
						publicKey: keyPairRef.current.pubB64,
					},
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
						{msg.verified !== undefined && (
							<span
								style={{
									marginLeft: 8,
									fontSize: 10,
									color: msg.verified ? "#22c55e" : "#ef4444",
								}}
							>
								{msg.verified ? "✔️ verified" : "❌ unverified"}
							</span>
						)}
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
