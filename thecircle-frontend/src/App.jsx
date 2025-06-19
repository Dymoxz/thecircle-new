import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, Link, useNavigate } from "react-router-dom";
import StreamerPage from "./pages/StreamerPage";
import ViewerPage from "./pages/ViewerPage";
import LoginPage from "./pages/LoginPage.jsx";
import RequireAuth from "./component/RequireAuth.jsx";

import { Camera, Eye, Lock, Search, SlidersHorizontal, ArrowDownWideNarrow, User } from "lucide-react";
import ProfilePage from "./pages/ProfilePage.jsx";

const API_URL = "https://localhost:3001/api";

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
  const [subscriptions, setSubscriptions] = useState([]); // Initialize as an empty array
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true); // New loading state for subscriptions
  const [subscriptionError, setSubscriptionError] = useState(null); // New error state for subscriptions


  useEffect(() => {
    document.title = "The Circle - Home";
  }, []);

  // --- Hardcoded Data for Streams and Followed Users ---
  const [streams, setStreams] = useState([
    { id: 1, title: "Building a React App", streamer: "DevSage", viewers: "2.5K", thumbnail: "https://placehold.co/320x180/7B1FA2/FFFFFF?text=React+Build" },
    { id: 2, title: "Exploring New Worlds", streamer: "ExplorerGaming", viewers: "1.2K", thumbnail: "https://placehold.co/320x180/C2185B/FFFFFF?text=Gaming+Adventure" },
    { id: 3, title: "Digital Art Workshop", streamer: "CreativeBrush", viewers: "800", thumbnail: "https://placehold.co/320x180/00796B/FFFFFF?text=Art+Lesson" },
    { id: 4, title: "Cooking Masterclass", streamer: "ChefBytes", viewers: "1.5K", thumbnail: "https://placehold.co/320x180/D32F2F/FFFFFF?text=Cooking+Show" },
    { id: 5, title: "Morning Yoga Flow", streamer: "ZenFlex", viewers: "450", thumbnail: "https://placehold.co/320x180/303F9F/FFFFFF?text=Yoga+Flow" },
    { id: 6, title: "Live Music Session", streamer: "AcousticVibes", viewers: "950", thumbnail: "https://placehold.co/320x180/FBC02D/FFFFFF?text=Music+Session" },
    { id: 7, title: "Crafting DIY Projects", streamer: "HandyHannah", viewers: "300", thumbnail: "https://placehold.co/320x180/E64A19/FFFFFF?text=DIY+Crafts" },
    { id: 8, title: "Science Explained", streamer: "KnowledgeHub", viewers: "1.1K", thumbnail: "https://placehold.co/320x180/4CAF50/FFFFFF?text=Science+Talk" },
    { id: 9, title: "Book Club Discussion", streamer: "LiteraryLane", viewers: "200", thumbnail: "https://placehold.co/320x180/795548/FFFFFF?text=Book+Club" },
  ]);

  // FIX: This useEffect dependency array was causing an infinite loop.
  // It should depend on values that trigger a *re-fetch*, not the state being updated.
  // We'll also add `Maps` to ensure it's available if used for redirect.
  useEffect(() => {
    const fetchMySubscriptions = async () => {
      setLoadingSubscriptions(true); // Start loading
      setSubscriptionError(null); // Clear previous errors

      try {
        const token = localStorage.getItem("jwt_token"); // Use 'jwt_token' as per ProfilePage
        if (!token) {
          navigate('/login'); // Redirect if no token
          return;
        }

        const response = await fetch(`${API_URL}/profile/getMySubscriptions`, { // Assuming you create this backend endpoint
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
        // Ensure data is an array before setting state
        setSubscriptions(Array.isArray(data) ? data : []);

      } catch (error) {
        console.error('Error fetching subscriptions:', error);
        setSubscriptionError(error.message || 'Failed to load subscriptions.');
        setSubscriptions([]); // Ensure it's an array even on error
      } finally {
        setLoadingSubscriptions(false); // End loading
      }
    };

    fetchMySubscriptions();
  }, [navigate]); // Only re-run if navigate object changes (rare), or if you need a refresh mechanism

  const [followedUsers, setFollowedUsers] = useState([
    { id: 1, name: "DevSage", isOnline: true, avatar: "https://placehold.co/40x40/7B1FA2/FFFFFF?text=DS" },
    { id: 2, name: "ExplorerGaming", isOnline: false, avatar: "https://placehold.co/40x40/C2185B/FFFFFF?text=EG" },
    { id: 3, name: "CreativeBrush", isOnline: true, avatar: "https://placehold.co/40x40/00796B/FFFFFF?text=CB" },
    { id: 4, name: "ChefBytes", isOnline: false, avatar: "https://placehold.co/40x40/D32F2F/FFFFFF?text=CH" },
    { id: 5, name: "ZenFlex", isOnline: true, avatar: "https://placehold.co/40x40/303F9F/FFFFFF?text=ZF" },
    { id: 6, name: "AcousticVibes", isOnline: true, avatar: "https://placehold.co/40x40/FBC02D/FFFFFF?text=AV" },
    { id: 7, name: "HandyHannah", isOnline: false, avatar: "https://placehold.co/40x40/E64A19/FFFFFF?text=HH" },
  ]);

  const [searchTerm, setSearchTerm] = useState("");

  // Filter streams based on search term
  const filteredStreams = streams.filter(stream =>
      stream.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stream.streamer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to handle profile click
  const handleProfileClick = () => {
    navigate("/profile");
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
            {filteredStreams.length > 0 ? (
                filteredStreams.map(stream => (
                    <div
                        key={stream.id}
                        className="bg-white/80  backdrop-blur-sm rounded-lg overflow-hidden shadow-xl shadow-black/30 transition-all duration-300 ease-in-out hover:scale-[1.02] cursor-pointer"
                        onClick={() => alert(`Navigating to ${stream.streamer}'s stream: ${stream.title}`)}
                    >
                      <img src={stream.thumbnail} alt={stream.title} className="w-full h-40 object-cover" />
                      <div className="p-4">
                        <h3 className="text-xl font-bold text-gray-900 mb-1 truncate">{stream.title}</h3>
                        <p className="text-gray-800 text-sm mb-2 truncate">{stream.streamer}</p>
                        <div className="flex items-center text-sm text-neutral-600">
                          <Eye className="w-4 h-4 mr-1" /> {stream.viewers} viewers
                        </div>
                      </div>
                    </div>
                ))
            ) : (
                <div className="col-span-full text-center text-neutral-400 text-lg py-10">
                  No streams found matching your search. Try a different keyword!
                </div>
            )}
          </div>
        </div>

        <div className="w-full md:w-80 flex-shrink-0 ml-0 md:ml-6 mt-6 md:mt-0 flex flex-col space-y-6">
          <div
              className="bg-white/80 border-white/10 rounded-3xl p-4 shadow-md shadow-black/30 flex flex-col items-center cursor-pointer
                         transition-all duration-200 ease-in-out hover:bg-white/90 hover:shadow-2xl hover:shadow-black/40"
              onClick={handleProfileClick}
          >
            <div className="flex items-center justify-start w-full mb-2">
              <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center mr-2 border-2 border-[#a83246] overflow-hidden">
                <User className="w-10 h-10 text-neutral-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">My Profile</h2>
            </div>
            <Link to="/streamer" className="w-full">
              <button className="flex items-center justify-center w-full px-3 py-1.5 text-sm rounded-lg bg-[#a83246] text-white font-semibold hover:bg-[#c04d65] transition-colors shadow-lg shadow-[#a83246]/40">
                <Camera className="w-4 h-4 mr-1" /> Go Live
              </button>
            </Link>
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
                  {subscriptions.map(sub => ( // Changed 'user' to 'sub' for clarity as it's a subscription object
                      <li
                          key={sub._id} // Use _id from the subscription object
                          className="flex items-center mb-3 p-2 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
                          onClick={() => navigate(`/profile/${sub.streamer._id}`)} // Navigate to the streamer's profile
                      >
                        <div className="w-6 h-6 rounded-full mr-3 flex-shrink-0 overflow-hidden bg-neutral-700 flex items-center justify-center text-white text-xs font-bold">
                          {sub.streamer?.userName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="text-gray-800 font-semibold flex-grow truncate">{sub.streamer?.userName}</span>
                        {/* You can add online status logic here if your backend provides it */}
                        {/* {sub.streamer?.isOnline && (
                            <div className="relative inline-flex">
                              <div className="rounded-full bg-red-500 h-[8px] w-[8px] inline-block mr-2"></div>
                              <div className="absolute animate-ping rounded-full bg-red-500 h-[8px] w-[8px] mr-2"></div>
                            </div>
                        )} */}
                      </li>
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

// Main App component with React Router setup
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
              path="/viewer"
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