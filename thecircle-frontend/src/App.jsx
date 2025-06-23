import React, { useEffect, useState, useRef } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Link,
  useNavigate,
} from "react-router-dom";
import StreamerPage from "./pages/StreamerPage";
import ViewerPage from "./pages/ViewerPage";
import LoginPage from "./pages/LoginPage.jsx";
import RequireAuth from "./component/RequireAuth.jsx";
import {
  Camera,
  Eye,
  Lock,
  Search,
  SlidersHorizontal,
  ArrowDownWideNarrow,
  User,
} from "lucide-react";
import ProfilePage from "./pages/ProfilePage.jsx";
import { jwtDecode } from "jwt-decode";
import {
  exportPrivateKey,
  getDevice,
  getDeviceName,
  setupDeviceKey,
} from "./services/keys.service.js";

const API_URL = "https://localhost:3001/api";
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
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

// Click outside hook
const useClickOutside = (ref, callback) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
};

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

  // Filter and sort state
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: "",
    liveOnly: true,
    subscribedOnly: false,
  });
  const [sortOpen, setSortOpen] = useState(false);
  const [sortOption, setSortOption] = useState("viewers-desc");

  // Refs for click outside
  const filterRef = useRef();
  const sortRef = useRef();

  useClickOutside(filterRef, () => setFilterOpen(false));
  useClickOutside(sortRef, () => setSortOpen(false));

  // Effect for fetching subscriptions
  useEffect(() => {
    const fetchMySubscriptions = async () => {
      setLoadingSubscriptions(true);
      setSubscriptionError(null);

      try {
        const token = localStorage.getItem("jwt_token");
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch(`${API_URL}/profile/getMySubscriptions`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch subscriptions");
        }

        const data = await response.json();
        setSubscriptions(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching subscriptions:", error);
        setSubscriptionError(error.message || "Failed to load subscriptions.");
        setSubscriptions([]);
      } finally {
        setLoadingSubscriptions(false);
      }
    };

    fetchMySubscriptions();
  }, [navigate]);

  // Effect for WebSocket connection
  useEffect(() => {
    document.title = "The Circle - Home";

    socketRef.current = new WebSocket(WS_URL);
    const socket = socketRef.current;

    socket.onopen = () => {
      console.log("[WS] Connected to server.");
      socket.send(JSON.stringify({ event: "get-streams", data: {} }));
      setLoadingStreams(false);
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("[WS MESSAGE HOME]", msg);
      switch (msg.event) {
        case "streams":
          setStreams(msg.data.streams);
          console.log("Received streams:", msg.data.streams);
          setLoadingStreams(false);
          break;
        case "stream-started":
        case "stream-ended":
          socket.send(JSON.stringify({ event: "get-streams", data: {} }));
          break;
        case "error":
          console.error("Server error:", msg.data.message);
          setStreamError(msg.data.message);
          setLoadingStreams(false);
          break;
        default:
          break;
      }
    };

    socket.onclose = () => {
      console.log("[WS] Disconnected from server.");
      setLoadingStreams(false);
      setStreamError("Disconnected from stream server. Please refresh.");
    };

    socket.onerror = (err) => {
      console.error("[WS] Error:", err);
      setStreamError("WebSocket error. Could not connect to stream server.");
      setLoadingStreams(false);
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  // Filter streams
  const filteredStreams = streams.filter((stream) => {
    // Live only filter
    if (filters.liveOnly && !stream.isLive) return false;

    // Subscribed only filter
    if (filters.subscribedOnly) {
      const isSubscribed = subscriptions.some(
        (sub) => sub.streamer?._id === stream.streamerId
      );
      if (!isSubscribed) return false;
    }

    // Category filter
    if (filters.category && stream.category !== filters.category) {
      return false;
    }

    return true;
  });

  // Sort streams
  const sortedStreams = [...filteredStreams].sort((a, b) => {
    switch (sortOption) {
      case "viewers-desc":
        return (b.viewerCount || 0) - (a.viewerCount || 0);
      case "viewers-asc":
        return (a.viewerCount || 0) - (b.viewerCount || 0);
      case "date-desc":
        return new Date(b.startTime || 0) - new Date(a.startTime || 0);
      case "date-asc":
        return new Date(a.startTime || 0) - new Date(b.startTime || 0);
      case "title-asc":
        return (a.title || "").localeCompare(b.title || "");
      case "title-desc":
        return (b.title || "").localeCompare(a.title || "");
      default:
        return 0;
    }
  });

  // Search streams
  const searchedStreams = sortedStreams.filter((stream) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      (stream.title || "").toLowerCase().includes(searchLower) ||
      (stream.streamerName || "").toLowerCase().includes(searchLower) ||
      (stream.category || "").toLowerCase().includes(searchLower) ||
      (stream.tags || []).some((tag) => tag.toLowerCase().includes(searchLower))
    );
  });

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
            {/* Filter Dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors shadow-md"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" /> Filter
              </button>

              {filterOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white/90 backdrop-blur-lg rounded-lg shadow-xl z-50 p-4">
                  <h3 className="font-bold text-gray-800 mb-2">
                    Filter Streams
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.liveOnly}
                          onChange={() =>
                            setFilters({
                              ...filters,
                              liveOnly: !filters.liveOnly,
                            })
                          }
                          className="rounded text-[#a83246]"
                        />
                        <span className="text-gray-800">Live Only</span>
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.subscribedOnly}
                          onChange={() =>
                            setFilters({
                              ...filters,
                              subscribedOnly: !filters.subscribedOnly,
                            })
                          }
                          className="rounded text-[#a83246]"
                        />
                        <span className="text-gray-800">Subscribed Only</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={filters.category}
                        onChange={(e) =>
                          setFilters({ ...filters, category: e.target.value })
                        }
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#a83246] focus:ring-[#a83246] text-gray-800"
                      >
                        <option value="">All Categories</option>
                        <option value="gaming">Gaming</option>
                        <option value="music">Music</option>
                        <option value="coding">Coding</option>
                        <option value="talk">Talk Shows</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors shadow-md"
              >
                <ArrowDownWideNarrow className="w-4 h-4 mr-2" /> Sort
              </button>

              {sortOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white/90 backdrop-blur-lg rounded-lg shadow-xl z-50 p-4">
                  <h3 className="font-bold text-gray-800 mb-2">Sort By</h3>

                  <div className="space-y-2">
                    {[
                      { value: "viewers-desc", label: "Viewers (High to Low)" },
                      { value: "viewers-asc", label: "Viewers (Low to High)" },
                      { value: "date-desc", label: "Recently Started" },
                      { value: "date-asc", label: "Oldest" },
                      { value: "title-asc", label: "Title (A-Z)" },
                      { value: "title-desc", label: "Title (Z-A)" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="radio"
                          name="sortOption"
                          value={option.value}
                          checked={sortOption === option.value}
                          onChange={() => setSortOption(option.value)}
                          className="text-[#a83246]"
                        />
                        <span className="text-gray-800">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
          ) : searchedStreams.length > 0 ? (
            searchedStreams.map((stream) => (
              <div
                key={stream.streamId}
                className="bg-white/80 backdrop-blur-sm rounded-lg overflow-hidden shadow-xl shadow-black/30 transition-all duration-300 ease-in-out hover:scale-[1.02] cursor-pointer"
                onClick={() => handleStreamClick(stream.streamId)}
              >
                <img
                  src={
                    "https://placehold.co/320x180/7B1FA2/FFFFFF?text=Live+Stream"
                  }
                  alt={stream.streamId}
                  className="w-full h-40 object-cover"
                />
                <div className="p-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1 truncate">
                    {stream.streamerName}
                  </h3>
                  <p className="text-gray-800 text-sm mb-2 truncate">
                    {stream.tags}
                  </p>
                  <div className="flex items-center text-sm text-neutral-600">
                    <Eye className="w-4 h-4 mr-1" /> {stream.viewers || 0}{" "}
                    viewers
                  </div>
                  {stream.tags && stream.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {stream.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="bg-[#a83246]/10 text-[#a83246] text-xs px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center text-neutral-400 text-lg py-10">
              No live streams found matching your criteria.
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
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Subscriptions
          </h3>
          {loadingSubscriptions ? (
            <div className="flex justify-center items-center h-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
            </div>
          ) : subscriptionError ? (
            <p className="text-red-500 text-sm">{subscriptionError}</p>
          ) : subscriptions.length > 0 ? (
            <ul>
              {subscriptions.map(
                (sub) =>
                  sub?.streamer && (
                    <li
                      key={sub._id}
                      className="flex items-center mb-3 p-2 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/profile/${sub.streamer._id}`)}
                    >
                      <div className="w-6 h-6 rounded-full mr-3 flex-shrink-0 overflow-hidden bg-neutral-700 flex items-center justify-center text-white text-xs font-bold">
                        {sub.streamer?.userName?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <span className="text-gray-800 font-semibold flex-grow truncate">
                        {sub.streamer?.userName}
                      </span>
                    </li>
                  )
              )}
            </ul>
          ) : (
            <p className="text-gray-600 text-sm">
              You have no active subscriptions.
            </p>
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
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
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
