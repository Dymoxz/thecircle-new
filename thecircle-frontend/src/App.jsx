import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter as Router, Route, Routes, Link, useNavigate } from "react-router-dom";
import StreamerPage from "./pages/StreamerPage";
import ViewerPage from "./pages/ViewerPage";
import LoginPage from "./pages/LoginPage.jsx";
import RequireAuth from "./component/RequireAuth.jsx";
import { Camera, Eye, Lock, Search, SlidersHorizontal, ArrowDownWideNarrow, User } from "lucide-react";
import ProfilePage from "./pages/ProfilePage.jsx";

const API_URL = "https://localhost:3001/api";
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.hostname}:3001`;

const TheCircleLogo = ({ className }) => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    className={`drop-shadow-[0_4px_32px_rgba(80,0,20,0.5)] ${className}`}
  >
    <defs>
      <radialGradient id="circle-maroon" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="#fff" />
        <stop offset="60%" stopColor="#a83246" />
        <stop offset="100%" stopColor="#2d0a14" />
      </radialGradient>
      <linearGradient id="circle-maroon-stroke" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff" />
        <stop offset="100%" stopColor="#a83246" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#circle-maroon)" opacity="0.95" />
    <circle
      cx="60"
      cy="60"
      r="44"
      fill="none"
      stroke="url(#circle-maroon-stroke)"
      strokeWidth="8"
      opacity="0.7"
    />
    <circle
      cx="60"
      cy="60"
      r="22"
      fill="none"
      stroke="url(#circle-maroon-stroke)"
      strokeWidth="5"
      opacity="0.8"
    />
    <circle
      cx="60"
      cy="60"
      r="11"
      fill="url(#circle-maroon-stroke)"
      opacity="0.95"
    />
  </svg>
);

const HomePage = () => {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState(null);
  const [streams, setStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [streamError, setStreamError] = useState(null);
  const socketRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = "The Circle - Home";
  }, []);

  // Effect for fetching subscriptions
  useEffect(() => {
    const fetchMySubscriptions = async () => {
      setLoadingSubscriptions(true);
      setSubscriptionError(null);

      try {
        const token = localStorage.getItem("jwt_token");
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(`${API_URL}/profile/getMySubscriptions`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch subscriptions');
        }

        const data = await response.json();
        setSubscriptions(Array.isArray(data) ? data : []);

      } catch (error) {
        console.error('Error fetching subscriptions:', error);
        setSubscriptionError(error.message || 'Failed to load subscriptions.');
        setSubscriptions([]);
      } finally {
        setLoadingSubscriptions(false);
      }
    };

    fetchMySubscriptions();
  }, [navigate]);

  // Effect for WebSocket connection
  useEffect(() => {
    socketRef.current = new WebSocket(WS_URL);
    const socket = socketRef.current;

    socket.onopen = () => {
      console.log('[WS] Connected to server.');
      socket.send(JSON.stringify({ event: 'get-streams', data: {} }));
      setLoadingStreams(false);
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log('[WS MESSAGE HOME]', msg);
      switch (msg.event) {
        case 'streams':
          setStreams(msg.data.streams);
          console.log('Received streams:', msg.data.streams);
          setLoadingStreams(false);
          break;
        case 'stream-started':
        case 'stream-ended':
          socket.send(JSON.stringify({ event: 'get-streams', data: {} }));
          break;
        case 'error':
          console.error('Server error:', msg.data.message);
          setStreamError(msg.data.message);
          setLoadingStreams(false);
          break;
        default:
          break;
      }
    };

    socket.onclose = () => {
      console.log('[WS] Disconnected from server.');
      setLoadingStreams(false);
      setStreamError("Disconnected from stream server. Please refresh.");
    };

    socket.onerror = (err) => {
      console.error('[WS] Error:', err);
      setStreamError("WebSocket error. Could not connect to stream server.");
      setLoadingStreams(false);
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  const filteredStreams = streams;

  // Navigation handlers
  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleGoLiveClick = () => {
    navigate("/streamer");
  };

  const handleStreamClick = (streamId) => {
    navigate(`/viewer/${streamId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5c0000] via-[#800000] to-[#2d0a14] text-white flex p-4 font-oswald overflow-hidden">
      <div className="flex-grow flex flex-col p-4">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8">
          <div className="flex items-center mb-4 md:mb-0">
            <TheCircleLogo className="w-10 h-10 mr-2" />
            <h1 className="text-3xl font-bold uppercase tracking-wider text-white">
              The Circle
            </h1>
          </div>

          <div className="flex-grow max-w-xl md:mx-8 w-full relative">
            <input
              type="text"
              placeholder="Search streams..."
              className="w-full pl-10 pr-4 py-2 rounded-full bg-white/10 border border-white/20 text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#a83246]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          </div>

          <div className="flex space-x-2 mt-4 md:mt-0">
            <button className="flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors shadow-md">
              <ArrowDownWideNarrow className="w-4 h-4 mr-2" /> Sort
            </button>
            <button className="flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors shadow-md">
              <SlidersHorizontal className="w-4 h-4 mr-2" /> Filter
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow mt-12">
          {loadingStreams ? (
            <div className="col-span-full text-center text-white text-lg py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
              Loading live streams...
            </div>
          ) : streamError ? (
            <div className="col-span-full text-center text-red-400 text-lg py-10">
              Error loading streams: {streamError}
            </div>
          ) : filteredStreams.length > 0 ? (
            filteredStreams.map(stream => (
              <div
                key={stream.streamId}
                className="bg-white/80 backdrop-blur-sm rounded-lg overflow-hidden shadow-xl shadow-black/30 transition-all duration-300 ease-in-out hover:scale-[1.02] cursor-pointer"
                onClick={() => handleStreamClick(stream.streamId)}
              >
                <img src={ "https://placehold.co/320x180/7B1FA2/FFFFFF?text=Live+Stream"} alt={stream.streamId} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1 truncate">{stream.streamerName}</h3>
                  <p className="text-gray-800 text-sm mb-2 truncate">{stream.tags}</p>
                  <div className="flex items-center text-sm text-neutral-600">
                    <Eye className="w-4 h-4 mr-1" /> {stream.viewers || 0} viewers
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center text-neutral-400 text-lg py-10">
              No live streams found.
            </div>
          )}
        </div>
      </div>

<div className="w-full md:w-80 flex-shrink-0 ml-0 md:ml-6 mt-6 md:mt-0 flex flex-col space-y-6">
  {/* Aangepaste profiel/stream card */}
  <div className="bg-white/80 border-white/10 rounded-3xl p-4 shadow-md shadow-black/30 flex flex-col items-center">
    {/* Profiel sectie - aparte klik handler */}
    <div
      className="flex items-center justify-start w-full mb-2 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        handleProfileClick();
      }}
    >
      <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center mr-2 border-2 border-[#a83246] overflow-hidden">
        <User className="w-10 h-10 text-neutral-300" />
      </div>
      <h2 className="text-xl font-bold text-gray-800">My Profile</h2>
    </div>

    {/* Go Live knop - aparte klik handler */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleGoLiveClick();
      }}
      className="flex items-center justify-center w-full px-3 py-1.5 text-sm rounded-lg bg-[#a83246] text-white font-semibold hover:bg-[#c04d65] transition-colors shadow-lg shadow-[#a83246]/40"
    >
      <Camera className="w-4 h-4 mr-1" /> Go Live
    </button>
  </div>


        <div className="flex-grow bg-white/80 border-white/10 rounded-3xl p-8 shadow-md shadow-black/30 overflow-y-auto">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Subscriptions</h3>
          {loadingSubscriptions ? (
            <div className="flex justify-center items-center h-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
            </div>
          ) : subscriptionError ? (
            <p className="text-red-500 text-sm">{subscriptionError}</p>
          ) : subscriptions.length > 0 ? (
            <ul>
              {subscriptions.map(sub => (
                sub?.streamer && (
                  <li
                    key={sub._id}
                    className="flex items-center mb-3 p-2 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/profile/${sub.streamer._id}`)}
                  >
                    <div className="w-6 h-6 rounded-full mr-3 flex-shrink-0 overflow-hidden bg-neutral-700 flex items-center justify-center text-white text-xs font-bold">
                      {sub.streamer?.userName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-gray-800 font-semibold flex-grow truncate">{sub.streamer?.userName}</span>
                  </li>
                )
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 text-sm">You have no active subscriptions.</p>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        } />
        <Route
          path="/streamer"
          element={
            <RequireAuth>
              <StreamerPage />
            </RequireAuth>
          }
        />
        <Route
          path="/viewer/:streamId"
          element={
            <RequireAuth>
              <ViewerPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;