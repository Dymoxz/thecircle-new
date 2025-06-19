import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
	Calendar,
	LayoutGrid,
	MessageCircle,
	Play,
	RefreshCw,
	Send,
	StopCircle,
	Users,
	X,
	ArrowLeft,
	Pause, Volume2, VolumeX,
} from "lucide-react";
import * as mediasoupClient from "mediasoup-client";
import Chat from "../component/chat";
import { jwtDecode } from "jwt-decode";

// WebSocket URL configuration
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

const VIDEO_CONSTRAINTS = {
	width: { ideal: 1280 },
	height: { ideal: 720 },
	frameRate: { ideal: 30, max: 60 },
};

const ViewerPage = () => {
	const [streams, setStreams] = useState([]);
	const [currentStreamId, setCurrentStreamId] = useState(null);
	const [isWsConnected, setIsWsConnected] = useState(false);
	const [isStreamListOpen, setIsStreamListOpen] = useState(false);
	const [showPauseOverlay, setShowPauseOverlay] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
	const [volume, setVolume] = useState(1.0);
    const [previousVolume, setPreviousVolume] = useState(1.0);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const volumeSliderTimeoutRef = useRef(null);

	const remoteVideoRef = useRef(null);
	const socketRef = useRef(null);
	const user = jwtDecode(localStorage.getItem("jwt_token") || "{}");
	const viewerId = user._id;
	const currentStreamIdRef = useRef(null);
	const username = useRef("Viewer_" + viewerId.slice(0, 8)).current; // Simple username based on viewer ID

	// Mediasoup refs
	const deviceRef = useRef(null);
	const recvTransportRef = useRef(null);
	const consumersRef = useRef(new Map());

	const streamInfo = {
		streamerName: "CodeMaster_Dev",
		title: "Building a React Streaming App - Live Coding Session",
		viewers: 247,
		category: "Programming",
		tags: ["React", "JavaScript", "WebRTC", "Live Coding"],
	};

	useEffect(() => {
		document.title = "StreamHub - Watch";
		return () => {
			document.title = "StreamHub";
		};
	}, []);

	// Debug video element state when stream changes
	useEffect(() => {
		if (currentStreamId && remoteVideoRef.current) {
			console.log("Stream changed, checking video element state:");
			console.log("Video element:", remoteVideoRef.current);
			console.log("Video srcObject:", remoteVideoRef.current.srcObject);
			console.log("Video readyState:", remoteVideoRef.current.readyState);
			console.log("Video paused:", remoteVideoRef.current.paused);
			console.log(
				"Video currentTime:",
				remoteVideoRef.current.currentTime
			);
			console.log("Video duration:", remoteVideoRef.current.duration);
		}
	}, [currentStreamId]);

	useEffect(() => {
		socketRef.current = new WebSocket(WS_URL);
		const socket = socketRef.current;

		socket.onopen = () => {
			setIsWsConnected(true);
			socket.send(JSON.stringify({ event: "get-streams", data: {} }));
		};
		socket.onclose = () => setIsWsConnected(false);
		socket.onerror = (err) => console.error("[WS] Error:", err);

		// Persistent resolver map for awaiting specific events

		socket.onmessage = async (event) => {
			const msg = JSON.parse(event.data);
			// If a resolver is waiting for this event, resolve it
			
			switch (msg.event) {
				case "streams":
					setStreams(msg.data.streams);
					break;
				case "rtp-capabilities": {
					const { rtpCapabilities } = msg.data;
					if (deviceRef.current) {
						deviceRef.current.load({
							routerRtpCapabilities: rtpCapabilities,
						});
					}
					break;
				}
				case "transport-created": {
					const { transport } = msg.data;
					await createRecvTransport(
						transport,
						currentStreamIdRef.current
					);
					await consumeTracks(currentStreamIdRef.current);
					break;
				}
				case "transport-connected": {
					console.log("Transport connected");
					break;
				}
				case "consumed": {
					const { consumer } = msg.data;
					await handleConsumer(consumer);
					break;
				}
				case "stream-ended": {
					if (msg.data.streamId === currentStreamId) {
						handleStopWatching();
						alert(`Stream ${msg.data.streamId} has ended.`);
					}
					// Always refresh stream list on stream-ended
					if (socketRef.current?.readyState === WebSocket.OPEN) {
						socketRef.current.send(
							JSON.stringify({ event: "get-streams", data: {} })
						);
					}
					break;
				}
				case "stream-paused": {
					setShowPauseOverlay(true);
					if (remoteVideoRef.current) {
						remoteVideoRef.current.pause();
					}
					break;
				}
				case "stream-resumed": {
					setShowPauseOverlay(false);
					if (remoteVideoRef.current) {
						remoteVideoRef.current.play();
					}
					break;
				}
				case "error": {
					console.error("Server error:", msg.data.message);
					break;
				}
				default:
					break;
			}
		};

		return () => {
			socket.close();
			if (recvTransportRef.current) {
				recvTransportRef.current.close();
			}
			consumersRef.current.forEach((consumer) => consumer.close());
			consumersRef.current.clear();
		};
	}, []);

	const createRecvTransport = async (transportOptions, streamId) => {
		try {
			const device = new mediasoupClient.Device();
			deviceRef.current = device;

			// Load device with router RTP capabilities
			const rtpCapabilities = await getRtpCapabilities(streamId);
			await device.load({ routerRtpCapabilities: rtpCapabilities });

			const recvTransport = device.createRecvTransport(transportOptions);
			recvTransportRef.current = recvTransport;

			console.log(
				"Created receive transport with options:",
				transportOptions
			);
			console.log(
				"Transport ICE candidates:",
				transportOptions.iceCandidates
			);
			console.log(
				"Transport ICE parameters:",
				transportOptions.iceParameters
			);

			// Add transport event listeners
			recvTransport.on(
				"connect",
				async ({ dtlsParameters }, callback, errback) => {
					console.log("Transport connect event triggered");
					console.log("DTLS Parameters:", dtlsParameters);
					try {
						await connectTransport(dtlsParameters, streamId);
						callback();
						console.log("Transport connected successfully");
					} catch (error) {
						console.error("Transport connect failed:", error);
						errback(error);
					}
				}
			);

			recvTransport.on(
				"consume",
				async ({ producerId, rtpCapabilities }, callback, errback) => {
					console.log(
						"Transport consume event triggered for producerId:",
						producerId
					);
					try {
						const consumer = await consume(
							producerId,
							rtpCapabilities,
							streamId
						);
						callback({ id: consumer.id });
						console.log("Transport consume successful");
					} catch (error) {
						console.error("Transport consume failed:", error);
						errback(error);
					}
				}
			);

			recvTransport.on("connectionstatechange", (connectionState) => {
				console.log(
					"Transport connection state changed:",
					connectionState
				);
				if (connectionState === "failed") {
					console.error(
						"Transport connection failed - this indicates ICE connectivity issues"
					);
					console.log("Transport ICE state:", recvTransport.iceState);
					console.log(
						"Transport DTLS state:",
						recvTransport.dtlsState
					);
				}
			});

			recvTransport.on("dtlsstatechange", (dtlsState) => {
				console.log("Transport DTLS state changed:", dtlsState);
			});

			recvTransport.on("icestatechange", (iceState) => {
				console.log("Transport ICE state changed:", iceState);
			});

			recvTransport.on("icegatheringstatechange", (iceGatheringState) => {
				console.log(
					"Transport ICE gathering state changed:",
					iceGatheringState
				);
			});

			return recvTransport;
		} catch (error) {
			console.error("Error creating recv transport:", error);
			throw error;
		}
	};

	const getRtpCapabilities = async (streamId) => {
		console.log("Getting RTP capabilities with streamId:", streamId);
		socketRef.current.send(
			JSON.stringify({
				event: "get-rtp-capabilities",
				data: { streamId },
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

	const connectTransport = async (dtlsParameters, streamId) => {
		console.log("connectTransport called with:", {
			streamId,
			transportId: recvTransportRef.current.id,
			dtlsParameters,
		});

		socketRef.current.send(
			JSON.stringify({
				event: "connect-transport",
				data: {
					streamId,
					transportId: recvTransportRef.current.id,
					dtlsParameters,
					isStreamer: false,
				},
			})
		);
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				console.error("Transport connection timeout");
				reject(new Error("Timeout connecting transport"));
			}, 5000);

			const originalOnMessage = socketRef.current.onmessage;
			socketRef.current.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				console.log("connectTransport received message:", msg);
				if (msg.event === "transport-connected") {
					clearTimeout(timeout);
					socketRef.current.onmessage = originalOnMessage;
					console.log("Transport connection resolved successfully");
					resolve();
				} else if (msg.event === "error") {
					clearTimeout(timeout);
					socketRef.current.onmessage = originalOnMessage;
					console.error(
						"Transport connection error:",
						msg.data.message
					);
					reject(new Error(msg.data.message));
				}
			};
		});
	};

	const consume = async (producerId, rtpCapabilities, streamId) => {
		socketRef.current.send(
			JSON.stringify({
				event: "consume",
				data: {
					streamId,
					transportId: recvTransportRef.current.id,
					rtpCapabilities,
				},
			})
		);
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error("Timeout consuming")),
				5000
			);

			const originalOnMessage = socketRef.current.onmessage;
			socketRef.current.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				if (msg.event === "consumed") {
					clearTimeout(timeout);
					socketRef.current.onmessage = originalOnMessage;
					resolve(msg.data.consumer);
				} else if (msg.event === "error") {
					clearTimeout(timeout);
					socketRef.current.onmessage = originalOnMessage;
					reject(new Error(msg.data.message));
				}
			};
		});
	};

	const handleConsumer = async (consumersData) => {
		try {
			console.log("Handling consumer data:", consumersData);
			// Handle array of consumers (audio and video)
			const consumers = Array.isArray(consumersData)
				? consumersData
				: [consumersData];

			// Collect all tracks first
			const tracks = [];

			for (const consumerData of consumers) {
				console.log("Creating consumer for:", consumerData);
				const consumer = await recvTransportRef.current.consume({
					id: consumerData.id,
					producerId: consumerData.producerId,
					kind: consumerData.kind,
					rtpParameters: consumerData.rtpParameters,
				});

				consumersRef.current.set(consumer.id, consumer);

				// Add event listeners to the consumer
				consumer.on("trackended", () => {
					console.log(`Consumer ${consumer.id} track ended`);
				});

				consumer.on("transportclose", () => {
					console.log(`Consumer ${consumer.id} transport closed`);
				});

				// Add event listeners to the track
				consumer.track.onended = () => {
					console.log(`Track ${consumer.track.id} ended`);
				};

				consumer.track.onmute = () => {
					console.log(`Track ${consumer.track.id} muted`);
				};

				consumer.track.onunmute = () => {
					console.log(`Track ${consumer.track.id} unmuted`);
				};

				console.log("Consumer created:", {
					id: consumer.id,
					kind: consumer.kind,
					track: {
						id: consumer.track.id,
						kind: consumer.track.kind,
						enabled: consumer.track.enabled,
						muted: consumer.track.muted,
						readyState: consumer.track.readyState,
						label: consumer.track.label,
					},
				});

				// Collect the track
				tracks.push(consumer.track);

				// Resume consumer
				await consumer.resume();
				console.log(
					`Consumer ${consumer.id} (${consumer.kind}) resumed`
				);
			}

			// Create a single MediaStream with all tracks
			if (tracks.length > 0) {
				const stream = new MediaStream(tracks);
				if (remoteVideoRef.current) {
					remoteVideoRef.current.srcObject = stream;
					console.log(
						"Set remote stream with tracks:",
						tracks.map((t) => ({ kind: t.kind, id: t.id }))
					);
					console.log(
						"Video element srcObject:",
						remoteVideoRef.current.srcObject
					);
					console.log(
						"Video element readyState:",
						remoteVideoRef.current.readyState
					);
					console.log(
						"Video element paused:",
						remoteVideoRef.current.paused
					);
					console.log(
						"Video element currentTime:",
						remoteVideoRef.current.currentTime
					);
					console.log(
						"Video element duration:",
						remoteVideoRef.current.duration
					);

					// Log track states
					tracks.forEach((track) => {
						console.log(
							`${track.kind} track enabled:`,
							track.enabled
						);
						console.log(
							`${track.kind} track readyState:`,
							track.readyState
						);
						console.log(`${track.kind} track muted:`, track.muted);
						console.log(`${track.kind} track id:`, track.id);
						console.log(`${track.kind} track label:`, track.label);
					});

					// Check for audio tracks specifically
					const audioTracks = tracks.filter(
						(track) => track.kind === "audio"
					);
					const videoTracks = tracks.filter(
						(track) => track.kind === "video"
					);
					console.log("Audio tracks found:", audioTracks.length);
					console.log("Video tracks found:", videoTracks.length);

					// Force play the video
					remoteVideoRef.current
						.play()
						.then(() => {
							console.log("Video play() resolved successfully");
							console.log(
								"Video muted state after play:",
								remoteVideoRef.current.muted
							);
							console.log(
								"Video volume after play:",
								remoteVideoRef.current.volume
							);
						})
						.catch((error) => {
							console.error("Video play() failed:", error);
							// If autoplay is blocked, try to enable audio on user interaction
							if (error.name === "NotAllowedError") {
								console.log(
									"Autoplay blocked, audio will be enabled on user interaction"
								);
								const enableAudio = () => {
									if (remoteVideoRef.current) {
										remoteVideoRef.current.muted = false;
										remoteVideoRef.current.volume = 1.0;
										console.log(
											"Audio enabled by user interaction"
										);
										console.log(
											"Video muted state:",
											remoteVideoRef.current.muted
										);
										console.log(
											"Video volume:",
											remoteVideoRef.current.volume
										);
									}
									document.removeEventListener(
										"click",
										enableAudio
									);
									document.removeEventListener(
										"touchstart",
										enableAudio
									);
								};
								document.addEventListener("click", enableAudio);
								document.addEventListener(
									"touchstart",
									enableAudio
								);
							}
						});

					// Add a timeout to check if video loads
					setTimeout(() => {
						if (remoteVideoRef.current) {
							console.log(
								"After 2 seconds - Video readyState:",
								remoteVideoRef.current.readyState
							);
							console.log(
								"After 2 seconds - Video paused:",
								remoteVideoRef.current.paused
							);
							console.log(
								"After 2 seconds - Video currentTime:",
								remoteVideoRef.current.currentTime
							);
							console.log(
								"After 2 seconds - Video duration:",
								remoteVideoRef.current.duration
							);
							console.log(
								"After 2 seconds - Video srcObject:",
								remoteVideoRef.current.srcObject
							);

							// Check track states again
							tracks.forEach((track) => {
								console.log(
									`After 2 seconds - ${track.kind} track enabled:`,
									track.enabled
								);
								console.log(
									`After 2 seconds - ${track.kind} track muted:`,
									track.muted
								);
								console.log(
									`After 2 seconds - ${track.kind} track readyState:`,
									track.readyState
								);
							});

							// Try to play again if not playing
							if (remoteVideoRef.current.paused) {
								console.log(
									"Video is still paused, trying to play again..."
								);
								remoteVideoRef.current
									.play()
									.then(() => {
										console.log(
											"Second play() attempt successful"
										);
									})
									.catch((error) => {
										console.error(
											"Second play() attempt failed:",
											error
										);
									});
							}
						}
					}, 2000);

					// Add a longer timeout to check if tracks become unmuted
					setTimeout(() => {
						tracks.forEach((track) => {
							console.log(
								`After 5 seconds - ${track.kind} track muted:`,
								track.muted
							);
							console.log(
								`After 5 seconds - ${track.kind} track readyState:`,
								track.readyState
							);
						});
						console.log(
							"After 5 seconds - Video readyState:",
							remoteVideoRef.current?.readyState
						);

						const mutedTracks = tracks.filter(
							(track) => track.muted
						);
						if (mutedTracks.length > 0) {
							console.log(
								"Some tracks are still muted after 5 seconds - this indicates no data is being received"
							);
						}
					}, 5000);
				}
			}
		} catch (error) {
			console.error("Error handling consumer:", error);
		}
	};

	const handleConnectToStream = async (streamId) => {
		console.log("Connecting to stream:", streamId);

		// Clean up any existing connections
		if (recvTransportRef.current) {
			recvTransportRef.current.close();
		}
		consumersRef.current.forEach((consumer) => consumer.close());
		consumersRef.current.clear();

		// Set the current stream ID in both state and ref
		setCurrentStreamId(streamId);
		currentStreamIdRef.current = streamId;
		console.log("Current stream ID after setting:", streamId);

		try {
			// Extract streamerId from streamId
			const streamerId = streamId.startsWith("stream-")
				? streamId.substring(7)
				: streamId;

			// Register as viewer
			socketRef.current.send(
				JSON.stringify({
					event: "register",
					data: {
						id: viewerId,
						clientType: "viewer",
						streamId,
						streamerId,
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
							msg.data?.clientType === "viewer"
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
					data: { streamId, isStreamer: false, streamerId },
				})
			);

			setIsStreamListOpen(false); // Close mobile list on selection
		} catch (error) {
			console.error("Error connecting to stream:", error);
		}
	};

	const handleStopWatching = () => {
		console.log("Stopping watching");
		if (recvTransportRef.current) {
			recvTransportRef.current.close();
			recvTransportRef.current = null;
		}
		consumersRef.current.forEach((consumer) => consumer.close());
		consumersRef.current.clear();
    

		if (remoteVideoRef.current) {
			remoteVideoRef.current.srcObject = null;
		}
		setCurrentStreamId(null);
		currentStreamIdRef.current = null;
            navigate('/');
	};

	const handleRefresh = () => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(
				JSON.stringify({ event: "get-streams", data: {} })
			);
		}
	};

	const consumeTracks = async (streamId) => {
		try {
			console.log("Consuming tracks for stream:", streamId);

			// Get device RTP capabilities for consuming
			const device = deviceRef.current;

			// Request to consume tracks
			socketRef.current.send(
				JSON.stringify({
					event: "consume",
					data: {
						streamId,
						transportId: recvTransportRef.current.id,
						rtpCapabilities: device.rtpCapabilities,
					},
				})
			);
		} catch (error) {
			console.error("Error consuming tracks:", error);
		}
	};

	const StreamListPanel = () => (
		<div className="p-4 flex flex-col h-full">
			<div className="flex items-center justify-between mb-4 flex-shrink-0">
				<h2 className="text-xl font-bold text-teal-400">
					Live Streams
				</h2>
				<button
					onClick={handleRefresh}
					disabled={!isWsConnected}
					className="p-2 rounded-lg bg-neutral-700/50 hover:bg-neutral-600/50 disabled:opacity-50 transition-colors"
				>
					<RefreshCw className="w-5 h-5" />
				</button>
			</div>
			<div className="flex-1 overflow-y-auto space-y-3 -mr-2 pr-2">
				{streams.length > 0 ? (
					streams.map((streamId) => (
						<div
							key={streamId}
							onClick={() => handleConnectToStream(streamId)}
							className={`p-3 rounded-2xl cursor-pointer transition-all duration-200 border-2 ${
								streamId === currentStreamId
									? "bg-teal-500/20 border-teal-400 ring-2 ring-teal-400"
									: "bg-neutral-800/60 border-transparent hover:border-neutral-500"
							}`}
						>
							<div className="flex items-center space-x-3">
								<div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-800 rounded-full flex items-center justify-center flex-shrink-0">
									<Play className="w-5 h-5 text-white" />
								</div>
								<div>
									<h3 className="font-semibold text-sm truncate">
										Stream {streamId.slice(-8)}
									</h3>
									<p className="text-xs text-neutral-400">
										CodeMaster_Dev
									</p>
								</div>
							</div>
						</div>
					))
				) : (
					<div className="text-center py-8 text-neutral-400">
						<div className="w-16 h-16 bg-neutral-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
							<Play className="w-8 h-8 text-neutral-500" />
						</div>
						<p className="text-sm">No streams available</p>
					</div>
				)}
			</div>
		</div>
	);

	const ChatPanelContent = () => (
		<Chat
			streamId={currentStreamId}
			username={username}
			socket={socketRef.current}
			myStream={false}
		/>
	);

    // --- Bottom Bar Controls ---
    const handlePause = () => {
        if (!remoteVideoRef.current) return;
        
        if (!isPaused) {
            // Pause the video
            remoteVideoRef.current.pause();
            setIsPaused(true);
            console.log('Stream paused by viewer');
        } else {
            // Resume and jump to live (end of buffer)
            const video = remoteVideoRef.current;
            
            // First, try to seek to the end of the seekable range (live point)
            if (video.seekable && video.seekable.length > 0) {
                try {
                    const liveTime = video.seekable.end(video.seekable.length - 1);
                    video.currentTime = liveTime;
                    console.log('Seeking to live point:', liveTime);
                } catch (error) {
                    console.warn('Could not seek to live point:', error);
                    // Continue anyway, the play() will handle it
                }
            }
            
            // Then play the video
            const playPromise = video.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => {
                    setIsPaused(false);
                    console.log('Stream resumed by viewer');
                }).catch((error) => {
                    console.error('Failed to resume stream:', error);
                    // Still set as not paused even if play fails
                    setIsPaused(false);
                });
            } else {
                setIsPaused(false);
                console.log('Stream resumed by viewer (sync)');
            }
        }
    };

    const handleMute = () => {
        if (!remoteVideoRef.current) return;
        
        if (!isMuted) {
            // Muting - save current volume and set to 0
            setPreviousVolume(volume);
            setVolume(0);
            remoteVideoRef.current.volume = 0;
            setIsMuted(true);
        } else {
            // Unmuting - restore previous volume
            setVolume(previousVolume);
            remoteVideoRef.current.volume = previousVolume;
            setIsMuted(false);
        }
    };

    const handleVolumeChange = (newVolume) => {
        if (!remoteVideoRef.current) return;
        
        setVolume(newVolume);
        remoteVideoRef.current.volume = newVolume;
        
        // Update mute state based on volume
        if (newVolume === 0) {
            setIsMuted(true);
        } else {
            setIsMuted(false);
        }
    };

    const handleVolumeSliderShow = () => {
        if (volumeSliderTimeoutRef.current) {
            clearTimeout(volumeSliderTimeoutRef.current);
        }
        setShowVolumeSlider(true);
    };

    const handleVolumeSliderHide = () => {
        volumeSliderTimeoutRef.current = setTimeout(() => {
            setShowVolumeSlider(false);
        }, 300);
    };

    // Keep isMuted state in sync with video element
    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.volume = volume;
        }
    }, [volume]);

    // Keep isPaused state in sync with video element
    useEffect(() => {
        if (remoteVideoRef.current) {
            if (isPaused && !remoteVideoRef.current.paused) {
                remoteVideoRef.current.pause();
            } else if (!isPaused && remoteVideoRef.current.paused) {
                // Only auto-play if we're not in a paused state
                remoteVideoRef.current.play().catch(error => {
                    console.warn('Auto-play failed:', error);
                });
            }
        }
    }, [isPaused]);

    // If stream changes, reset pause/mute state
    useEffect(() => {
        setIsPaused(false);
        setIsMuted(false);
        setVolume(1.0);
        setPreviousVolume(1.0);
    }, [currentStreamId]);

    // Add CSS for horizontal slider
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .slider-horizontal {
                -webkit-appearance: none;
                appearance: none;
                background: transparent;
                cursor: pointer;
                pointer-events: auto;
            }
            .slider-horizontal::-webkit-slider-track {
                -webkit-appearance: none;
                appearance: none;
                background: #374151;
                border-radius: 4px;
                height: 8px;
            }
            .slider-horizontal::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                background: #14b8a6;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                pointer-events: auto;
            }
            .slider-horizontal::-moz-range-track {
                background: #374151;
                border-radius: 4px;
                height: 8px;
                border: none;
            }
            .slider-horizontal::-moz-range-thumb {
                width: 16px;
                height: 16px;
                background: #14b8a6;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                pointer-events: auto;
            }
            .slider-horizontal:focus {
                outline: none;
            }
            .slider-horizontal:hover {
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
        
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    return (
        <div className="h-[100dvh] w-screen text-neutral-100 overflow-hidden bg-neutral-900 relative">
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full "
                onLoadedMetadata={() => console.log('Video metadata loaded')}
                onCanPlay={() => console.log('Video can play')}
                onPlay={() => {
                    console.log('Video started playing');
                    // Update pause state if video starts playing externally
                    if (isPaused) {
                        setIsPaused(false);
                    }
                }}
                onPause={() => {
                    console.log('Video paused');
                    // Update pause state if video is paused externally
                    if (!isPaused) {
                        setIsPaused(true);
                    }
                }}
                onLoadedData={() => console.log('Video data loaded')}
                onWaiting={() => console.log('Video waiting for data')}
                onStalled={() => console.log('Video stalled')}
                onError={(e) => console.error('Video error:', e)}
                onVolumeChange={() => console.log('Volume changed:', remoteVideoRef.current?.volume)}
                onAudioProcess={() => console.log('Audio processing')}
            />

			{currentStreamId && showPauseOverlay && (
				<div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl transition-opacity duration-500 z-20">
					<div className="text-center p-8">
						<div className="w-24 h-24 bg-neutral-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
							<Play className="w-12 h-12 text-neutral-400" />
						</div>
						<h3 className="text-2xl font-bold mb-2">
							Stream Paused
						</h3>
						<p className="text-neutral-300 max-w-sm">
							The streamer has paused the broadcast. Please
							wait...
						</p>
					</div>
				</div>
			)}

            {/* Viewer Paused Overlay */}
            {currentStreamId && isPaused && !showPauseOverlay && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl transition-opacity duration-500 z-20">
                    {/* <div className="text-center p-8">
                        <div
                            className="w-24 h-24 bg-neutral-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <Play className="w-12 h-12 text-teal-400"/>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Paused</h3>
                        <p className="text-neutral-300 max-w-sm">
                            You have paused the stream. Click the play button to resume.
                        </p>
                    </div> */}
                </div>
            )}

            {!currentStreamId && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl z-10">
                    <div className="text-center p-8">
                        <h3 className="text-2xl font-bold mb-2">Select a Stream</h3>
                        <p className="text-neutral-300">Choose a live stream to start watching</p>
                    </div>
                </div>
            )}

            {/*/!* Audio Test Button - Only show when stream is active *!/*/}
            {/*{currentStreamId && remoteVideoRef.current?.srcObject && (*/}
            {/*    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">*/}
            {/*        <button*/}
            {/*            onClick={() => {*/}
            {/*                if (remoteVideoRef.current) {*/}
            {/*                    remoteVideoRef.current.muted = false;*/}
            {/*                    remoteVideoRef.current.volume = 1.0;*/}
            {/*                    console.log('Audio manually enabled');*/}
            {/*                    console.log('Video muted state:', remoteVideoRef.current.muted);*/}
            {/*                    console.log('Video volume:', remoteVideoRef.current.volume);*/}
            {/*                    console.log('Video srcObject tracks:', remoteVideoRef.current.srcObject.getTracks().map(t => ({*/}
            {/*                        kind: t.kind,*/}
            {/*                        muted: t.muted,*/}
            {/*                        enabled: t.enabled*/}
            {/*                    })));*/}
            {/*                }*/}
            {/*            }}*/}
            {/*            className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"*/}
            {/*        >*/}
            {/*            Enable Audio*/}
            {/*        </button>*/}
            {/*    </div>*/}
            {/*)}*/}

            {/* Left Side: Mobile Button & Stream List */}
            <button
                onClick={() => setIsStreamListOpen(true)}
                className="absolute top-4 left-16 z-30 bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-full p-3 shadow-lg lg:hidden"
            >
                <LayoutGrid className="w-6 h-6 text-neutral-100"/>
            </button>
            
            {/* Back Button - Top Left */}
            {currentStreamId && (
                <button
                    onClick={handleStopWatching}
                    className="absolute top-4 left-4 z-30 bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-full p-3 shadow-lg text-neutral-100 hover:bg-neutral-800/50 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6"/>
                </button>
            )}
            
            <div
                className="absolute top-20 left-4 max-h-[calc(100vh-5rem)] w-80 bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-2xl z-20 hidden lg:flex flex-col">
                <StreamListPanel/>
            </div>
            {isStreamListOpen && (
                <div className="absolute inset-0 z-40 bg-neutral-900/80 backdrop-blur-2xl lg:hidden">
                    <button
                        onClick={() => setIsStreamListOpen(false)}
                        className="absolute top-4 right-4 z-50 p-2"
                    >
                        <X className="w-6 h-6"/>
                    </button>
                    <StreamListPanel/>
                </div>
            )}

            {/* Right Side Panels (Desktop) */}
            <div
                className="absolute top-4 right-4 max-h-[calc(100vh-2rem)] w-80 space-y-4 flex flex-col z-20">
                {currentStreamId && (
                    <>
                        <div
                            className="bg-neutral-900/50 backdrop-blur-lg border border-neutral-100/10 rounded-2xl p-4">
                            <h2 className="text-lg font-bold mb-3">{streamInfo.title}</h2>
                            <div className="flex items-center space-x-3 mb-4">
                                <div
                                    className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-800 rounded-full flex-shrink-0 flex items-center justify-center">
                                    <span className="text-xs font-bold">CM</span>
                                </div>
                                <div className="text-sm">
                                    <p className="font-semibold text-white">{streamInfo.streamerName}</p>
                                    <p className="text-neutral-400">{streamInfo.category}</p>
                                </div>
                            </div>
                            <div className="text-xs text-neutral-300 space-y-2 border-t border-neutral-700 pt-3">
                                <div className="flex items-center space-x-2">
                                    <Calendar className="w-4 h-4 text-teal-400"/>
                                    <span>{new Date().toLocaleDateString('en-US', {
                                        month: 'long',
                                        day: 'numeric'
                                    })}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Users className="w-4 h-4 text-teal-400"/>
                                    <span>{streamInfo.viewers} viewers</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {streamInfo.tags.map(tag => (
                                    <span key={tag} className="bg-neutral-700/50 px-3 py-1 rounded-full text-xs">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <ChatPanelContent/>
                    </>
                )}
            </div>

            {/* --- BOTTOM BAR CONTROLS --- */}
            {currentStreamId && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="flex items-center space-x-3 bg-neutral-900/30 backdrop-blur-xl p-2 rounded-3xl border border-neutral-100/10 shadow-lg min-w-[160px] justify-center">
                        <button
                            onClick={handlePause}
                            className={`p-3 rounded-2xl transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 ${isPaused ? 'bg-teal-500/80 hover:bg-teal-500 text-white' : 'bg-yellow-500/80 hover:bg-yellow-500 text-neutral-900'}`}
                        >
                            {isPaused ? <Play className="w-6 h-6"/> : <Pause className="w-6 h-6"/>}
                        </button>
                        {/* Volume Control - Button and Slider */}
                        <div 
                            className="relative flex items-center bg-neutral-800/70 rounded-2xl px-2 py-2"
                            onMouseEnter={handleVolumeSliderShow}
                            onMouseLeave={handleVolumeSliderHide}
                        >
                            <button
                                onClick={handleMute}
                                className={`p-3 rounded-xl transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 ${isMuted ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-200'}`}
                            >
                                {isMuted ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
                            </button>
                            {/* Volume Slider - Absolutely positioned to the right of the button */}
                            {showVolumeSlider && (
                                <div className="absolute left-full top-1/2 -translate-y-1/2 flex items-center space-x-2 bg-neutral-800/90 rounded-xl px-3 py-2 ml-2 shadow-lg z-50 min-w-[180px]">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={volume}
                                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                        className="flex-1 h-2 bg-neutral-600 rounded-full appearance-none cursor-pointer slider-horizontal"
                                    />
                                    <div className="text-xs text-neutral-300 min-w-[2.5rem] text-center">
                                        {Math.round(volume * 100)}%
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewerPage;
