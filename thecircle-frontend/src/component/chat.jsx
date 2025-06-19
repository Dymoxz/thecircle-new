import React, { useEffect, useState, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";

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

// Props: streamId (room), username (e.g. wss://yourserver)
const Chat = ({ streamId, username, socket, myStream }) => {
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const wsRef = useRef(null);
	const messagesEndRef = useRef(null);
	const keyPairRef = useRef(null);
	const streamerId = streamId.substring(streamId.indexOf('-') + 1); // Everything after 'stream-'
	const INCOMING_BUFFER_KEY = `incoming_chat_buffer_${streamId}`;
	const timerRef = useRef(null);
	const incomingTimerRef = useRef(null);
		// Buffering logic for all incoming messages
	function saveIncomingBuffer(buffer) {
		if (myStream === true) {
			localStorage.setItem(INCOMING_BUFFER_KEY, JSON.stringify(buffer));
		}
	}
	function loadIncomingBuffer() {
		const raw = localStorage.getItem(INCOMING_BUFFER_KEY);
		return raw ? JSON.parse(raw) : [];
	}
	async function flushIncomingBuffer() {
    const buffer = loadIncomingBuffer();
    if (buffer.length > 0) {
        console.log("[Chat] Flushing incoming buffer:", JSON.stringify(buffer));
        // Remove buffer before sending to prevent race conditions
        localStorage.removeItem(INCOMING_BUFFER_KEY);
        // Send buffered messages to backend
        await fetch(`https://localhost:3002/api/chat/save/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(buffer),
        });
    }
}

	useEffect(() => {
		// Fetch old messages from backend (localhost:3002)
		fetch(`http://localhost:3002/api/chat/stream/${streamerId}`)
			.then((res) => res.json())
			.then((data) => {
				const mapped = data.map((chat) => ({
					sender: chat.sender,
					message: chat.message,
					timestamp: chat.timestamp,
					verified: chat.verified || true,
				}));
				setMessages(mapped);
			})
			.catch((err) => {
				console.error("Failed to fetch chat history", err);
			});
	}, [streamerId]);

	useEffect(() => {
		// Generate or load keypair on mount
		getOrCreateKeyPair().then((kp) => {
			keyPairRef.current = kp;
		});
	}, []);

	useEffect(() => {
		// Connect to backend WebSocket
		wsRef.current = socket
		if (!socket) return;

		const onMessage = async (event) => {
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
					const chatObj = {
						sender: msg.data.senderId,
						message: msg.data.message,
						timestamp: msg.data.timestamp,
						streamer: streamerId,
						verified,
					};
					setMessages((prev) => [...prev, chatObj]);

					// Buffering logic for all incoming messages
					let buffer = loadIncomingBuffer();
					buffer.push(chatObj);
					saveIncomingBuffer(buffer);
					if (!incomingTimerRef.current) {
						incomingTimerRef.current = setTimeout(() => {
							flushIncomingBuffer();
							incomingTimerRef.current = null;
						}, 5000);
					}
				}
			} catch (e) {}
		};

		socket.addEventListener("message", onMessage);

		return () => {
			socket.removeEventListener('message', onMessage);
		};
	}, [streamId, username, socket]);

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

	// Clear timer on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
			if (incomingTimerRef.current)
				clearTimeout(incomingTimerRef.current);
		};
	}, []);

	return (
		<div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-2xl p-4 flex flex-col flex-1 pr-4" style={{minHeight: 0}}>
			<h3 className="font-semibold mb-4 flex items-center text-lg">
				<MessageSquare className="w-5 h-5 mr-3 text-[#ff5a7c]" />Live Chat
			</h3>
			{/* Message List */}
			<div className="flex-1 space-y-4 overflow-y-auto min-h-0">
				{messages.map((msg, idx) => (
					<div key={idx} className="flex flex-col items-start text-sm">
						<span className={`font-bold flex items-center ${msg.sender === username ? 'text-[#7dd3fc]' : 'text-[#f1f1f1]'}`}>
							{msg.verified && (
								<span className="text-green-500 mr-1" title="Verified">
									{/* Small checkmark icon */}
									<svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M7 10.5L10 13.5L15 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									</svg>
								</span>
							)}
							{msg.sender}
						</span>
						<p className="bg-neutral-800/50 p-2 rounded-lg rounded-tl-none mt-1">
							{msg.message}
							{msg.verified !== undefined && (
								<span className={`ml-2 text-xs ${msg.verified ? 'text-green-500' : 'text-red-500'}`}/>
							)}
							<span className="float-right text-xs text-neutral-400 ml-2">
								{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
							</span>
						</p>
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			{/* Chat Input */}
			<form onSubmit={sendMessage} className="mt-4 flex items-center space-x-2">
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Send a message..."
					className="flex-1 bg-neutral-800/60 border border-[#be123c]/40 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-[#ff5a7c] focus:border-[#ff5a7c] transition-all outline-none"
				/>
				<button type="submit" disabled={!input.trim()} className="p-2 bg-gradient-to-r from-[#ff5a7c] to-[#be123c] hover:from-[#be123c] hover:to-[#ff5a7c] rounded-lg transition-colors">
					<Send className="w-5 h-5 text-neutral-900" />
				</button>
			</form>
		</div>
	);
};

export default Chat;
