import React, {useEffect, useRef, useState} from "react";
import {
    ArrowLeft,
    Eye,
    FlipHorizontal,
    Mic,
    MicOff,
    Monitor,
    Pause,
    Play,
    RotateCcw,
    Square,
    SwitchCamera,
    Video,
    VideoOff,
    ArrowUp,
    MoreHorizontal,
    ArrowDown
} from "lucide-react";
import * as mediasoupClient from "mediasoup-client";
import Chat from "../component/chat";
import {jwtDecode} from "jwt-decode";
import {TagDialog} from "../component/tagDialog.jsx";
import Toast from "../component/Toast";
// WebSocket URL configuration
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

// --- Helper Component for Styled Buttons ---
const ControlButton = ({onClick, children, className = "", ...props}) => (
    <button
        onClick={onClick}
        className={`p-3 rounded-2xl backdrop-blur-lg transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 ${className}`}
        {...props}
    >
        {children}
    </button>
);

const VIDEO_CONSTRAINTS = {
    width: {ideal: 1280},
    height: {ideal: 720},
    frameRate: {ideal: 30, max: 60},
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
    const [currentCamera, setCurrentCamera] = useState("user");
    const [viewerCount, setViewerCount] = useState(0);
    const [streamDuration, setStreamDuration] = useState(0);
    const [showPauseOverlay, setShowPauseOverlay] = useState(false);
    const [videoRotation, setVideoRotation] = useState(0);
    const [user, setUser] = useState({});
    const [isTransparent, setIsTransparent] = useState(true);
    const [transparencyReward, setTransparencyReward] = useState({
        currentRate: 0,
        totalEarned: 0,
        consecutiveMinutes: 0
    });
    const [isMirrored, setIsMirrored] = useState(false);
    const localVideoRef = useRef(null);
    const socketRef = useRef(null);
    const localStreamRef = useRef(null);
    const streamStartTime = useRef(null);
    const durationInterval = useRef(null);

    // Mediasoup refs
    const deviceRef = useRef(null);
    const sendTransportRef = useRef(null);
    const audioProducerRef = useRef(null);
    const videoProducerRef = useRef(null);

    const token = localStorage.getItem("jwt_token");
    const userfromjwt = jwtDecode(token);
    const streamerId = userfromjwt.sub;
    const streamId = streamerId;
    const [username, setUsername] = useState("streamer");
    const [streamTags, setStreamTags] = useState([]);
    const [showTagDialog, setShowTagDialog] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [availableCameras, setAvailableCameras] = useState([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    const [showMobileOverlay, setShowMobileOverlay] = useState(false);
    const [mobileOverlayVisible, setMobileOverlayVisible] = useState(false); // for animation

    useEffect(() => {
        // Fetch user data from localStorage or API
        fetch(`https://localhost:3002/api/user/${streamerId}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        })
            .then((response) => response.json())
            .then((data) => {
                console.log("Fetched user data:", data);
                if (data && data.userName) {
                    setUser(data);
                    setUsername(data.userName);
                } else {
                    setUser({});
                    setUsername("streamer");
                    console.error("User data missing or malformed:", data);
                }
            });
    }, [streamerId]);

    useEffect(() => {
        document.title = "StreamHub - Stream";
        return () => {
            document.title = "StreamHub";
        };
    }, []);

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

        socket.onopen = () => {
            console.log("WebSocket connection opened");
        };
        socket.onclose = () => {
            console.log("WebSocket connection closed");
        };
        socket.onerror = (err) => console.error("[WS] Error:", err);

        socket.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data);
                switch (msg.event) {
                    case "viewer-joined": {
                        const {viewerId} = msg.data;
                        if (viewerId) {
                            setViewerCount((prev) => prev + 1);
                        }
                        break;
                    }
                    case "viewer-left": {
                        const {viewerId} = msg.data;
                        if (viewerId) {
                            setViewerCount((prev) => Math.max(prev - 1, 0));
                            console.log(viewerCount);
                        }
                        break;
                    }
                    case "rtp-capabilities": {
                        const {rtpCapabilities} = msg.data;
                        if (deviceRef.current) {
                            deviceRef.current.load({
                                routerRtpCapabilities: rtpCapabilities,
                            });
                        }
                        break;
                    }
                    case "transport-created": {
                        const {transport} = msg.data;
                        await createSendTransport(transport);
                        // After transport is created, produce the tracks
                        await produceTracks();
                        break;
                    }
                    case "transport-connected": {
                        console.log("Transport connected");
                        break;
                    }
                    case "produced": {
                        const {producer} = msg.data;
                        console.log("Producer created:", producer);
                        break;
                    }
                    case "error": {
                        console.error("Server error:", msg.data.message);
                        break;
                    }
                    case "stream-paused": {
                        setShowPauseOverlay(true);
                        setIsPaused(true);
                        if (localVideoRef.current) {
                            localVideoRef.current.pause();
                        }
                        break;
                    }
                    case "stream-resumed": {
                        setShowPauseOverlay(false);
                        setIsPaused(false);
                        if (localVideoRef.current) {
                            localVideoRef.current.play();
                        }
                        break;
                    }
                    case "transparency-reward": {
                        console.log("Received transparency reward:", msg.data);
                        setTransparencyReward(prev => ({
                            ...prev,
                            currentRate: msg.data.currentRate,
                            totalEarned: msg.data.totalEarned,
                            consecutiveMinutes: msg.data.consecutiveMinutes
                        }));
                        break;
                    }
                    case "transparency-set": {
                        setIsTransparent(msg.data.transparent);
                        break;
                    }
                    default:
                        break;
                }
            } catch (err) {
                console.error("WebSocket message handling error:", err);
            }
        };

        return () => {
            socket.close();
            if (localStreamRef.current) {
                localStreamRef.current
                    .getTracks()
                    .forEach((track) => track.stop());
            }
            clearInterval(durationInterval.current);
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

    const produceTracks = async () => {
        try {
            if (!localStreamRef.current || !sendTransportRef.current) {
                console.error("No local stream or transport available");
                return;
            }

            const stream = localStreamRef.current;
            const sendTransport = sendTransportRef.current;

            // Produce video track
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                console.log("Producing video track");
                const videoProducer = await sendTransport.produce({
                    track: videoTrack,
                });
                videoProducerRef.current = videoProducer;
                console.log("Video producer created:", videoProducer.id);
            }

            // Produce audio track
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                console.log("Producing audio track");
                const audioProducer = await sendTransport.produce({
                    track: audioTrack,
                });
                audioProducerRef.current = audioProducer;
                console.log("Audio producer created:", audioProducer.id);
            }
        } catch (error) {
            console.error("Error producing tracks:", error);
        }
    };

    const createSendTransport = async (transportOptions) => {
        try {
            const device = new mediasoupClient.Device();
            deviceRef.current = device;

            // Load device with router RTP capabilities
            const rtpCapabilities = await getRtpCapabilities();
            await device.load({routerRtpCapabilities: rtpCapabilities});

            const sendTransport = device.createSendTransport(transportOptions);
            sendTransportRef.current = sendTransport;

            sendTransport.on(
                "connect",
                async ({dtlsParameters}, callback, errback) => {
                    try {
                        await connectTransport(dtlsParameters);
                        callback();
                    } catch (error) {
                        errback(error);
                    }
                }
            );

            sendTransport.on(
                "produce",
                async ({kind, rtpParameters}, callback, errback) => {
                    try {
                        const producer = await produce(kind, rtpParameters);
                        callback({id: producer.id});
                    } catch (error) {
                        errback(error);
                    }
                }
            );

            return sendTransport;
        } catch (error) {
            console.error("Error creating send transport:", error);
            throw error;
        }
    };

    const getRtpCapabilities = async () => {
        socketRef.current.send(
            JSON.stringify({
                event: "get-rtp-capabilities",
                data: {streamId: streamerId},
            })
        );

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Timeout getting RTP capabilities")),
                5000
            );

            const originalOnMessage = socketRef.current.onmessage;
            socketRef.current.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.event === "rtp-capabilities") {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    resolve(msg.data.rtpCapabilities);
                }
            };
        });
    };

    const connectTransport = async (dtlsParameters) => {
        socketRef.current.send(
            JSON.stringify({
                event: "connect-transport",
                data: {
                    streamId: streamerId,
                    transportId: sendTransportRef.current.id,
                    dtlsParameters,
                    isStreamer: true,
                },
            })
        );

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Timeout connecting transport")),
                5000
            );

            const originalOnMessage = socketRef.current.onmessage;
            socketRef.current.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.event === "transport-connected") {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    resolve();
                } else if (msg.event === "error") {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    reject(new Error(msg.data.message));
                }
            };
        });
    };

    const produce = async (kind, rtpParameters) => {
        const streamId = `stream-${streamerId}`;
        socketRef.current.send(
            JSON.stringify({
                event: "produce",
                data: {
                    streamId: streamerId,
                    transportId: sendTransportRef.current.id,
                    kind,
                    rtpParameters,
                },
            })
        );

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Timeout producing")),
                5000
            );

            const originalOnMessage = socketRef.current.onmessage;
            socketRef.current.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.event === "produced") {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    resolve(msg.data.producer);
                } else if (msg.event === "error") {
                    clearTimeout(timeout);
                    socketRef.current.onmessage = originalOnMessage;
                    reject(new Error(msg.data.message));
                }
            };
        });
    };

    const handleStartStream = async (tags) => {
        try {
            const tagArr = Array.isArray(tags)
                ? tags.filter(Boolean)
                : tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);

            setStreamTags(tagArr);


            const stream = await navigator.mediaDevices.getUserMedia({
                video: {...VIDEO_CONSTRAINTS, facingMode: currentCamera},
                audio: AUDIO_CONSTRAINTS,
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const streamId = `stream-${streamerId}`;
            // Send register event
            socketRef.current.send(
                JSON.stringify({
                    event: "register",
                    data: {
                        id: streamerId,
                        clientType: "streamer",
                        streamId,
                        streamerId: streamerId,
                        username: username || "streamer",
                        tags: tagArr,
                    },
                })
            );

            // Wait for 'registered' confirmation before creating transport
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(
                    () =>
                        reject(
                            new Error(
                                "Timeout waiting for registration confirmation"
                            )
                        ),
                    5000
                );
                const originalOnMessage = socketRef.current.onmessage;
                socketRef.current.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (
                            msg.event === "registered" &&
                            msg.data?.clientType === "streamer"
                        ) {
                            clearTimeout(timeout);
                            socketRef.current.onmessage = originalOnMessage;
                            resolve();
                        } else if (msg.event === "error") {
                            clearTimeout(timeout);
                            socketRef.current.onmessage = originalOnMessage;
                            reject(new Error(msg.data.message));
                        }
                    } catch (err) {
                        // Ignore parse errors
                    }
                };
            });

            // Now create transport
            socketRef.current.send(
                JSON.stringify({
                    event: "create-transport",
                    data: {streamId, isStreamer: true, streamerId},
                })
            );

            setIsStreaming(true);
            streamStartTime.current = Date.now();
        } catch (err) {
            console.error("Could not access camera/mic:", err);
            alert("Could not access camera/mic: " + err.message);
        }


        console.log("Toggling transparency to: true");
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(
                JSON.stringify({
                    event: "set-transparency",
                    data: {
                        streamId: streamerId,
                        transparent: true
                    }
                })
            );
        }
    };

    const handleStopStream = async () => {
        try {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(
                    JSON.stringify({
                        event: "end-stream",
                        data: {streamId: streamerId},
                    })
                );
            }

            // Show earned satoshis confirmation as toast
            if (transparencyReward.totalEarned > 0) {
                setToastMessage(`Stream ended! You earned ${transparencyReward.totalEarned} satoshis.`);
                setShowToast(true);
            }

            // Reset reward state
            setTransparencyReward({
                currentRate: 0,
                totalEarned: 0,
                consecutiveMinutes: 0
            });

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => track.stop());
            }
            localStreamRef.current = null;

            if (localVideoRef.current) localVideoRef.current.srcObject = null;

            // Close mediasoup resources
            if (audioProducerRef.current) {
                audioProducerRef.current.close();
                audioProducerRef.current = null;
            }
            if (videoProducerRef.current) {
                videoProducerRef.current.close();
                videoProducerRef.current = null;
            }
            if (sendTransportRef.current) {
                sendTransportRef.current.close();
                sendTransportRef.current = null;
            }
            if (deviceRef.current) {
                deviceRef.current = null;
            }

            setIsStreaming(false);
            setIsPaused(false);
            setViewerCount(0);
            setStreamDuration(0);
            streamStartTime.current = null;
        } catch (error) {
            console.error("Error stopping stream:", error);
        }
    };

    function captureFrame(videoElement) {
        const canvas = document.createElement("canvas");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    async function getFrameHash(canvas) {
        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png")
        );
        const arrayBuffer = await blob.arrayBuffer();
        const hashBuffer = await window.crypto.subtle.digest(
            "SHA-256",
            arrayBuffer
        );
        return new Uint8Array(hashBuffer);
    }

    async function signFrameHash(privateKey, frameHash) {
        const signature = await window.crypto.subtle.sign(
            {name: "RSASSA-PKCS1-v1_5"},
            privateKey,
            frameHash
        );
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
    }

    const keyPairRef = useRef(null);

    useEffect(() => {
        async function loadKeyPair() {
            if (!keyPairRef.current) {
                const pair = await window.crypto.subtle.generateKey(
                    {
                        name: "RSASSA-PKCS1-v1_5",
                        modulusLength: 2048,
                        publicExponent: new Uint8Array([1, 0, 1]),
                        hash: "SHA-256",
                    },
                    true,
                    ["sign", "verify"]
                );
                keyPairRef.current = pair;
            }
        }

        loadKeyPair();
    }, []);

    useEffect(() => {
        let intervalId;

        async function sendFrameHashMediasoup() {
            if (
                isStreaming &&
                localVideoRef.current &&
                !isPaused &&
                !isVideoOff &&
                socketRef.current &&
                socketRef.current.readyState === WebSocket.OPEN
            ) {
                const canvas = captureFrame(localVideoRef.current);
                const frameHash = getDownscaledFrameHash(canvas, 8);
                const timestamp = new Date().toISOString();
                socketRef.current.send(
                    JSON.stringify({
                        event: "frame-hash",
                        data: {
                            streamId,
                            senderId: streamerId,
                            frameHash: frameHash,
                            timestamp,
                        },
                    })
                );
                console.log(
                    "[Streamer] Sent frame hash via mediasoup event:",
                    frameHash
                );
            }
        }

        if (isStreaming) {
            intervalId = setInterval(sendFrameHashMediasoup, 1000);
        }
        return () => clearInterval(intervalId);
    }, [isStreaming, isPaused, isVideoOff]);



        useEffect(() => {
            let intervalId;

            async function sendStreamerData() {
                if (
                    isStreaming &&
                    localVideoRef.current &&
                    socketRef.current &&
                    socketRef.current.readyState === WebSocket.OPEN
                ) {
                    socketRef.current.send(
                        JSON.stringify({
                            event: "stream",
                            data: {
                                streamId: streamerId,
                                streamerName: username,
                                tags: streamTags,
                                viewerCount: viewerCount,
                            },
                        })
                    );
                    console.log(
                        "[Streamer] Sent stream data to viewer client with wviewr count" + viewerCount,
                    );
                }
            }

            if (isStreaming) {
                intervalId = setInterval(sendStreamerData, 5000);
            }
            return () => clearInterval(intervalId);
        }, [isStreaming, viewerCount]);

        const extractFramefromStream = (stream) => {
            if (!stream || !stream.getVideoTracks().length) {
                console.error("No video track found in the stream");
                return null;
            }

            const videoTrack = stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(videoTrack);

            return imageCapture;
        };

        const createDigitalSignature = async (stream) => {
            if (!stream || !stream.getVideoTracks().length) {
                console.error("No video track found in the stream");
                return null;
            }
            const imageCapture = extractFramefromStream(stream);
            if (!imageCapture) {
                console.error("Could not extract frame from stream");
                return null;
            }
            try {
                const frame = await imageCapture.grabFrame();
                const canvas = document.createElement("canvas");
                canvas.width = frame.width;
                canvas.height = frame.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(frame, 0, 0, frame.width, frame.height);
                const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
                const data = imageData.data;
                const hashBuffer = await crypto.subtle.digest(
                    "SHA-256",
                    new Uint8Array(data)
                );
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
                return hashHex;
            } catch (error) {
                console.error("Error creating digital signature:", error);
                return null;
            }
        };

        const handlePauseStream = () => {
            if (!localStreamRef.current) return;

            const nextPausedState = !isPaused;
            setIsPaused(nextPausedState);

            if (nextPausedState) {
                setShowPauseOverlay(true);
            } else {
                setShowPauseOverlay(false);
            }

            const tracks = localStreamRef.current.getTracks();
            tracks.forEach(track => {
                track.enabled = !nextPausedState;
            });

            if (
                socketRef.current &&
                socketRef.current.readyState === WebSocket.OPEN
            ) {
                const streamId = `stream-${streamerId}`;
                if (nextPausedState) {
                    socketRef.current.send(
                        JSON.stringify({
                            event: "pause-stream",
                            data: {streamId: streamerId},
                        })
                    );
                } else {
                    socketRef.current.send(
                        JSON.stringify({
                            event: "resume-stream",
                            data: {streamId: streamerId},
                        })
                    );
                }
            }
        };

        const handleFlipCamera = async () => {
            if (!isStreaming || !localStreamRef.current) return;
            if (availableCameras.length <= 1) {
                setToastMessage('No other camera available to switch.');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 4000); // Hide after 4 seconds
                return;
            }
            // Desktop: cycle through all video input devices
            let nextIndex = (currentCameraIndex + 1) % availableCameras.length;
            const nextDeviceId = availableCameras[nextIndex]?.deviceId;
            try {
                const constraints = {
                    video: {...VIDEO_CONSTRAINTS, deviceId: {exact: nextDeviceId}},
                    audio: AUDIO_CONSTRAINTS,
                };
                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                const newVideoTrack = newStream.getVideoTracks()[0];
                const audioTrack = localStreamRef.current.getAudioTracks()[0];
                // Replace video track in local stream
                const newLocalStream = new MediaStream([
                    newVideoTrack,
                    audioTrack,
                ]);
                localStreamRef.current = newLocalStream;
                if (localVideoRef.current) localVideoRef.current.srcObject = newLocalStream;
                // Replace video producer if it exists
                if (videoProducerRef.current && sendTransportRef.current) {
                    await videoProducerRef.current.replaceTrack({track: newVideoTrack});
                }
                setCurrentCameraIndex(nextIndex);
                setCurrentCamera(availableCameras[nextIndex].label.toLowerCase().includes('back') ? 'environment' : 'user');
            } catch {
                setToastMessage('Failed to switch camera.');
                setShowToast(true);
                // Try to revert to previous camera if possible
                try {
                    const prevDeviceId = availableCameras[currentCameraIndex]?.deviceId;
                    const constraints = {
                        video: {...VIDEO_CONSTRAINTS, deviceId: {exact: prevDeviceId}},
                        audio: AUDIO_CONSTRAINTS,
                    };
                    const prevStream = await navigator.mediaDevices.getUserMedia(constraints);
                    const prevVideoTrack = prevStream.getVideoTracks()[0];
                    const audioTrack = localStreamRef.current.getAudioTracks()[0];
                    const prevLocalStream = new MediaStream([
                        prevVideoTrack,
                        audioTrack,
                    ]);
                    localStreamRef.current = prevLocalStream;
                    if (localVideoRef.current) localVideoRef.current.srcObject = prevLocalStream;
                    if (videoProducerRef.current && sendTransportRef.current) {
                        await videoProducerRef.current.replaceTrack({track: prevVideoTrack});
                    }
                } catch {
                    // If revert fails, do nothing but keep the stream running
                }
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

        const handleToggleTransparency = () => {
            const newTransparencyState = !isTransparent;
            setIsTransparent(newTransparencyState);


        };

        useEffect(() => {
            // Enumerate cameras on mount
            navigator.mediaDevices.enumerateDevices().then((devices) => {
                const videoInputs = devices.filter((d) => d.kind === 'videoinput');
                setAvailableCameras(videoInputs);
                // Set current camera index if possible
                if (videoInputs.length > 0) {
                    setCurrentCameraIndex(0);
                }
            });
        }, []);

        // Handle overlay mount/unmount for animation
        useEffect(() => {
            if (showMobileOverlay) {
                setMobileOverlayVisible(true);
            }
        }, [showMobileOverlay]);

        return (
            <div className="h-[100dvh] w-screen text-neutral-100 overflow-hidden bg-neutral-900 relative">
                {/* Back Button - Top Left, only when not streaming */}
                {!isStreaming && (
                    <button
                        onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')}
                        className="absolute top-4 left-4 z-30 bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-full p-3 shadow-lg text-neutral-100 hover:bg-neutral-800/50 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6"/>
                    </button>
                )}
                {/* Toast notification */}
                <Toast message={toastMessage} show={showToast} onClose={() => setShowToast(false)}/>
                {/* --- VIDEO + OVERLAY CONTAINER --- */}
                <div className="absolute inset-0 w-full h-full z-0">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full"
                        style={{
                            transform: `${
                                isMirrored ? "scaleX(-1) " : ""
                            }rotate(${videoRotation}deg)`,
                        }}
                    />
                    {isStreaming && showPauseOverlay && (
                        <div
                            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl transition-opacity duration-500 z-0 pointer-events-none">
                            <div className="text-center p-8 select-none">
                                <div
                                    className="w-24 h-24 bg-neutral-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <Pause className="w-12 h-12 text-neutral-400"/>
                                </div>
                                <h3 className="text-2xl font-bold mb-2">
                                    Stream Paused
                                </h3>
                                <p className="text-neutral-300 max-w-sm">
                                    Your stream is currently paused for viewers.
                                    We'll be back soon!
                                </p>

                                <p className="text-orange-200 max-w-md text-xs mt-4">
                                    If paused for more than 1.5 hours, your reward rate will reset to 1 sat/hour.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Start Stream Button (only when not streaming) */}
                {!isStreaming && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full flex justify-center z-20 px-2">
                        <button
                            onClick={() => setShowTagDialog(true)}
                            className="bg-[#800000] hover:bg-[#a00000] mb-4 disabled:bg-neutral-600 disabled:cursor-not-allowed text-white py-3 px-8 rounded-2xl font-semibold transition-all duration-300 ease-in-out flex items-center justify-center space-x-2 transform hover:scale-105 active:scale-100 shadow-lg z-10"
                        >
                            <Play className="w-6 h-6 "/>
                            <span>Start Stream</span>
                        </button>
                    </div>
                )}

                <TagDialog
                    open={showTagDialog}
                    onClose={() => setShowTagDialog(false)}
                    onSave={(tags) => handleStartStream(tags)}
                />

                {/* --- CONTROLS AND INFO --- */}
                {isStreaming && (
                    <div
                        className="absolute top-4 left-4 flex items-center space-x-4 text-sm bg-neutral-900/30 backdrop-blur-xl p-2 pl-3 rounded-3xl border border-neutral-100/10 shadow-lg z-10">
                        <div className="flex items-center space-x-2 bg-red-500/90 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full animate-ping absolute opacity-75"></div>
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            <span className="font-semibold uppercase tracking-wider text-xs">
                            Live
                        </span>
                        </div>
                        <div className="flex items-center space-x-2 text-neutral-200 pr-2">
                            <Eye className="w-5 h-5"/>
                            <span className="font-medium">{viewerCount}</span>
                        </div>
                        <div
                            className="text-neutral-200 font-mono hidden sm:block bg-neutral-800/50 px-3 py-1 rounded-lg">
                            {formatDuration(streamDuration)}
                        </div>
                    </div>
                )}

                {isStreaming && (
                    <>
                        {/* Desktop/Tablet Controls */}
                        <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 items-center space-x-3 bg-neutral-900/30 backdrop-blur-xl p-2 rounded-3xl border border-neutral-100/10 shadow-lg z-10">
                            {/* Camera/Mic/Flip/Mirror/Rotate Controls */}
                            <ControlButton onClick={toggleMute} className={isMuted ? "bg-red-500/80 hover:bg-red-500 text-white" : "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"}>
                                {isMuted ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
                            </ControlButton>
                            <ControlButton onClick={toggleVideo} className={isVideoOff ? "bg-red-500/80 hover:bg-red-500 text-white" : "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"}>
                                {isVideoOff ? <VideoOff className="w-6 h-6"/> : <Video className="w-6 h-6"/>}
                            </ControlButton>
                            <ControlButton onClick={handleFlipCamera} className="bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200">
                                <SwitchCamera className="w-6 h-6"/>
                            </ControlButton>
                            <ControlButton onClick={() => setIsMirrored((m) => {
                                const newMirrored = !m;
                                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                                    socketRef.current.send(JSON.stringify({event: "video-mirror", data: {streamId: streamerId, mirrored: newMirrored}}));
                                }
                                return newMirrored;
                            })} className={isMirrored ? "bg-teal-500/80 hover:bg-teal-500 text-white" : "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"}>
                                <FlipHorizontal className="w-6 h-6"/>
                            </ControlButton>
                            <ControlButton onClick={() => {
                                setVideoRotation((r) => {
                                    const newRotation = (r + 90) % 360;
                                    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                                        socketRef.current.send(JSON.stringify({event: "video-rotation", data: {streamId: streamerId, rotation: newRotation}}));
                                    }
                                    return newRotation;
                                });
                            }} className={videoRotation !== 0 ? "bg-teal-500/80 hover:bg-teal-500 text-white" : "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"}>
                                <RotateCcw className="w-6 h-6"/>
                            </ControlButton>
                            <div className="w-px h-8 bg-neutral-100/10 mx-2"></div>
                            {/* Pause/Stop Controls */}
                            <ControlButton onClick={handlePauseStream} className={isPaused ? "bg-teal-500/80 hover:bg-teal-500 text-white" : "bg-yellow-500/80 hover:bg-yellow-500 text-neutral-900"}>
                                {isPaused ? <Play className="w-6 h-6"/> : <Pause className="w-6 h-6"/>}
                            </ControlButton>
                            <ControlButton onClick={handleStopStream} className="bg-red-500/80 hover:bg-red-500 text-white">
                                <Square className="w-6 h-6"/>
                            </ControlButton>
                        </div>
                        {/* Mobile Controls */}
                        <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 space-y-2">
                            {/* Row 1: Camera/Mic/Mirror/Rotate Controls */}
                            <div className="flex items-center justify-center space-x-3 bg-neutral-900/30 backdrop-blur-xl p-2 rounded-3xl border border-neutral-100/10 shadow-lg max-w-xs">
                                <ControlButton onClick={toggleMute} className={isMuted ? "bg-red-500/80 hover:bg-red-500 text-white" : "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"}>
                                    {isMuted ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
                                </ControlButton>
                                <ControlButton onClick={toggleVideo} className={isVideoOff ? "bg-red-500/80 hover:bg-red-500 text-white" : "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"}>
                                    {isVideoOff ? <VideoOff className="w-6 h-6"/> : <Video className="w-6 h-6"/>}
                                </ControlButton>
                                <ControlButton onClick={handleFlipCamera} className="bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200">
                                    <SwitchCamera className="w-6 h-6"/>
                                </ControlButton>
                                <ControlButton onClick={() => setIsMirrored((m) => {
                                    const newMirrored = !m;
                                    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                                        socketRef.current.send(JSON.stringify({event: "video-mirror", data: {streamId: streamerId, mirrored: newMirrored}}));
                                    }
                                    return newMirrored;
                                })} className={isMirrored ? "bg-teal-500/80 hover:bg-teal-500 text-white" : "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"}>
                                    <FlipHorizontal className="w-6 h-6"/>
                                </ControlButton>
                                <ControlButton onClick={() => {
                                    setVideoRotation((r) => {
                                        const newRotation = (r + 90) % 360;
                                        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                                            socketRef.current.send(JSON.stringify({event: "video-rotation", data: {streamId: streamerId, rotation: newRotation}}));
                                        }
                                        return newRotation;
                                    });
                                }} className={videoRotation !== 0 ? "bg-teal-500/80 hover:bg-teal-500 text-white" : "bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200"}>
                                    <RotateCcw className="w-6 h-6"/>
                                </ControlButton>
                            </div>
                            {/* Row 2: Pause/Stop and ArrowUp (ArrowUp in separate box) */}
                            <div className="flex justify-between w-screen px-7">
                                <div className="flex items-center space-x-3 bg-neutral-900/30 backdrop-blur-xl p-2 rounded-3xl border border-neutral-100/10 shadow-lg max-w-xs">
                                    <ControlButton onClick={handlePauseStream} className={isPaused ? "bg-teal-500/80 hover:bg-teal-500 text-white" : "bg-yellow-500/80 hover:bg-yellow-500 text-neutral-900"}>
                                        {isPaused ? <Play className="w-6 h-6"/> : <Pause className="w-6 h-6"/>}
                                    </ControlButton>
                                    <ControlButton onClick={handleStopStream} className="bg-red-500/80 hover:bg-red-500 text-white">
                                        <Square className="w-6 h-6"/>
                                    </ControlButton>
                                </div>
                                <div className="flex items-center bg-neutral-900/30 backdrop-blur-xl p-2 rounded-3xl border border-neutral-100/10 shadow-lg ml-2">
                                    <ControlButton onClick={() => setShowMobileOverlay(true)} className="bg-neutral-800/70 hover:bg-neutral-700/90 text-neutral-200">
                                        <ArrowUp className="w-6 h-6"/>
                                    </ControlButton>
                                </div>
                            </div>
                        </div>
                        {/* Mobile Overlay for Stream Info + Chat */}
                        {(showMobileOverlay || mobileOverlayVisible) && (
                            <div
                                className={`fixed inset-0 z-50 flex flex-col items-center justify-start bg-black/90 pt-8 px-2 transition-all duration-500
                                    ${showMobileOverlay ? 'animate-mobile-overlay-in' : 'animate-mobile-overlay-out pointer-events-none'}`}
                                onAnimationEnd={() => {
                                    if (!showMobileOverlay) setMobileOverlayVisible(false);
                                }}
                            >
                                <button onClick={() => setShowMobileOverlay(false)} className="mb-4 p-2 rounded-full bg-neutral-800/80 text-white text-xl self-center">
                                    <ArrowDown className="w-7 h-7"/>
                                </button>
                                <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-4">
                                    <div className="bg-neutral-900/80 border border-neutral-100/10 p-4 rounded-2xl w-full">
                                        <h3 className="font-semibold mb-4 flex items-center text-lg justify-center">
                                            <Monitor className="w-5 h-5 mr-3 text-[#800000]"/>
                                            Stream Info
                                        </h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-neutral-400">Status</span>
                                                <span className={`font-semibold px-2 py-0.5 rounded-md text-xs ${isStreaming ? isPaused ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-400" : "bg-neutral-700 text-neutral-300"}`}>
                                                    {isStreaming ? isPaused ? "Paused" : "Online" : "Offline"}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-neutral-400">Camera</span>
                                                <span className="capitalize">{currentCamera === "user" ? "Front" : "Back"}</span>
                                            </div>
                                            <div>
                                                <span className="text-neutral-400">Tags</span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {streamTags?.length ? (
                                                        streamTags.map((tag, i) => (
                                                            <span key={i} className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs">{tag}</span>
                                                        ))
                                                    ) : (
                                                        <span className="text-neutral-500 text-xs">No tags</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Make chat scrollable on mobile */}
                                    <div className="w-full flex-1 max-h-[40vh] min-h-[180px] overflow-y-auto">
                                        <Chat streamId={streamId} username={username} userId={streamerId} socket={socketRef.current} myStream={true}/>
                                    </div>
                                </div>
                                <style>{`
                                    @keyframes mobile-overlay-in {
                                        0% { opacity: 0; transform: translateY(48px) scale(0.98); }
                                        100% { opacity: 1; transform: translateY(0) scale(1); }
                                    }
                                    @keyframes mobile-overlay-out {
                                        0% { opacity: 1; transform: translateY(0) scale(1); }
                                        100% { opacity: 0; transform: translateY(48px) scale(0.98); }
                                    }
                                    .animate-mobile-overlay-in {
                                        animation: mobile-overlay-in 0.45s cubic-bezier(0.4,0,0.2,1);
                                    }
                                    .animate-mobile-overlay-out {
                                        animation: mobile-overlay-out 0.35s cubic-bezier(0.4,0,0.2,1);
                                    }
                                `}</style>
                            </div>
                        )}
                    </>
                )}

                <div
                    className="absolute top-4 right-4 w-80 space-y-4 hidden md:flex flex-col max-h-[calc(100vh-2rem)] z-20">
                    <div className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 p-4 rounded-2xl">
                        <h3 className="font-semibold mb-4 flex items-center text-lg">
                            <Monitor className="w-5 h-5 mr-3 text-[#800000]"/>
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
                                                : "bg-red-500/20 text-red-400"
                                            : "bg-neutral-700 text-neutral-300"
                                    }`}
                                >
								{isStreaming
                                    ? isPaused
                                        ? "Paused"
                                        : "Online"
                                    : "Offline"
                                }
							</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-neutral-400">Camera</span>
                                <span className="capitalize">
								{currentCamera === "user" ? "Front" : "Back"}
							</span>
                            </div>
                            <div>
                                <span className="text-neutral-400">Tags</span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {streamTags?.length ? (
                                        streamTags.map((tag, i) => (
                                            <span
                                                key={i}
                                                className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs"
                                            >
											{tag}
										</span>
                                        ))
                                    ) : (
                                        <span className="text-neutral-500 text-xs">
										No tags
									</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- CHAT PANEL --- */}
                    <Chat
                        streamId={streamId}
                        username={username}
                        userId={streamerId}
                        socket={socketRef.current}
                        myStream={true}
                    />
                </div>
            </div>
        );
    };



export default StreamerPage;


function getDownscaledFrameHash(canvas, size = 8) {
    const downCanvas = document.createElement("canvas");
    downCanvas.width = size;
    downCanvas.height = size;
    const ctx = downCanvas.getContext("2d");
    ctx.drawImage(canvas, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size).data;
    let hash = "";
    let total = 0;
    const grays = [];
    for (let i = 0; i < size * size; i++) {
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        grays.push(gray);
        total += gray;
    }
    const avg = total / (size * size);
    for (let i = 0; i < grays.length; i++) {
        hash += grays[i] > avg ? "1" : "0";
    }
    return hash;
}