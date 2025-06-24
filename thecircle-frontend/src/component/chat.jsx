import React, { useEffect, useState, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";
import {
  getDevice,
  getDeviceName,
  setupDeviceKey,
} from "../services/keys.service";
import {
  importPublicKey,
} from "../services/keys.service";

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
  return window.crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, sig, data);
}

// Props: streamId (room), username (e.g. wss://yourserver)
const Chat = ({ streamId, userId, username, socket, myStream }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const streamerId = streamId; // Everything after 'stream-'
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
    fetch(`https://localhost:3002/api/chat/stream/${streamerId}`)
      .then((res) => res.json())
      .then((data) => {
        const mapped = data.map((chat) => ({
          sender: chat.sender,
          message: chat.message,
          timestamp: chat.timestamp,
          verified: chat.verified,
        }));
        setMessages(mapped);
      })
      .catch((err) => {
        console.error("Failed to fetch chat history", err);
      });
  }, [streamerId]);

  useEffect(() => {
    // Connect to backend WebSocket
    wsRef.current = socket;
    if (!socket) return;

    const onMessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "chat-message" && msg.data.streamId === streamId) {
          console.log("[Chat] Received message:", msg.data);
          // Try to verify signature if present
          let verified = false;
          if (msg.data.signature && msg.data.deviceId) {
            try {
              const fetchPubKeyBody = {
                deviceId: msg.data.deviceId,
                userId: msg.data.senderId,
              };

              const token = localStorage.getItem("jwt_token");

              const response = await fetch(
                `https://localhost:3002/api/user/getPublicKey`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(fetchPubKeyBody),
                }
              );

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                  errorData.message || "Failed to fetch subscriptions"
                );
              }

              const pubKeyObject = await response.json();
              const pubKey = await importPublicKey(pubKeyObject.publicKey); // call to api msg.data.devideId
              const dataObj = {
                streamId: msg.data.streamId,
				sender: msg.data.sender,
                senderId: msg.data.senderId,
                message: msg.data.message,
                timestamp: msg.data.timestamp,
              };
              console.log(
                "[Chat] Verifying with publicKey:",
                pubKeyObject.publicKey
              );
              console.log("[Chat] Verifying signature:", msg.data.signature);
              verified = await verifyMessage(
                pubKey,
                dataObj,
                msg.data.signature
              );
              console.log(verified);
            } catch (err) {
              console.error("[Chat] Signature verification error:", err);
            }
          }
          const chatObj = {
            sender: msg.data.sender,
            senderId: msg.data.senderId,
            message: msg.data.message,
            timestamp: msg.data.timestamp,
            streamer: streamId,
            verified,
            signature: msg.data.signature,
            streamId: msg.data.streamId,
            deviceId: msg.data.deviceId,
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
      socket.removeEventListener("message", onMessage);
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
      wsRef.current.readyState === 1
    ) {
      const timestamp = new Date().toISOString();
      const dataObj = {
        streamId,
        sender: username,
        senderId: userId,
        message: input,
        timestamp,
      };
	  const deviceId = await getDeviceName();
	  const privKeyObject = await getDevice(deviceId);
      const signature = await signMessage(
        privKeyObject.privateKey,
        dataObj
      ); // new signing with private key from localdb
      wsRef.current.send(
        JSON.stringify({
          event: "chat-message",
          data: {
            ...dataObj,
            signature,
            deviceId: deviceId,
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
      if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
    };
  }, []);

  return (
    <div
      className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-2xl p-4 flex flex-col flex-1 pr-4"
      style={{ minHeight: 0 }}
    >
      <h3 className="font-semibold mb-4 flex items-center text-lg">
        <MessageSquare className="w-5 h-5 mr-3 text-[#ff3333]" />
        Live Chat
      </h3>
      {/* Message List */}
      <div className="flex-1 space-y-4 overflow-y-auto min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className="flex flex-col items-start text-sm">
            <span
              className={`font-bold flex items-center ${
                msg.sender === username ? "text-red-500" : "text-white"
              }`}
            >
              {msg.verified && (
                <span className="text-green-500 mr-1" title="Verified">
                  {/* Small checkmark icon */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7 10.5L10 13.5L15 8.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              {msg.sender}
            </span>
            <p className="bg-neutral-800/50 p-2 rounded-lg rounded-tl-none mt-1">
              {msg.message}
              {msg.verified !== undefined && (
                <span
                  className={`ml-2 text-xs ${
                    msg.verified ? "text-green-500" : "text-red-500"
                  }`}
                />
              )}
              <span className="float-right text-xs text-neutral-400 ml-2">
                {msg.timestamp
                  ? new Date(msg.timestamp).toLocaleTimeString()
                  : ""}
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
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2 bg-[#800000] hover:bg-[#a00000] rounded-lg transition-colors"        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </form>
    </div>
  );
};

export default Chat;
