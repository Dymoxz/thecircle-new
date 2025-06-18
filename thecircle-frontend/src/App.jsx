import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
// Make sure to import your other pages if they are in different files
import StreamerPage from "./pages/StreamerPage"; // Assuming these pages exist
import ViewerPage from "./pages/ViewerPage"; // Assuming these pages exist
import LoginPage from "./pages/LoginPage.jsx"; // Assuming this page exists
import RequireAuth from "./component/RequireAuth.jsx"; // Assuming this component exists

// Importing new icons for the homepage layout
import { Camera, Eye, Lock, Search, SlidersHorizontal, ArrowDownWideNarrow, User, Settings } from "lucide-react";

// --- The Circle Logo SVG ---
// Updated to remove auto-margins, size, and margin-bottom, as its placement is now controlled by the parent flex container.
const TheCircleLogo = ({ className }) => ( // Add className prop for external styling
    <svg
        width="120" // Base width
        height="120" // Base height
        viewBox="0 0 120 120"
        className={`drop-shadow-[0_4px_32px_rgba(80,0,20,0.5)] ${className}`} // Apply external className
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
  useEffect(() => {
    document.title = "The Circle - Home";
  }, []);

  // --- Hardcoded Data for Streams and Followed Users ---
  // Using useState to manage this data, allowing for potential future dynamic updates
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

  return (
      // Main container with full screen height and a deep maroon gradient background
      <div className="min-h-screen bg-gradient-to-br from-[#5c0000] via-[#800000] to-[#2d0a14] text-white flex p-4 font-oswald overflow-hidden">
        {/* Main Content Area - Takes up available space */}
        <div className="flex-grow flex flex-col p-4">
          {/* Top Section: Title, Search Bar, Sort, and Filter Buttons */}
          <div className="flex flex-col md:flex-row items-center justify-between mb-8">
            {/* The Circle Title with Logo */}
            {/* CHANGE: Added a flex container for the logo and title, and adjusted logo size/margin */}
            <div className="flex items-center mb-4 md:mb-0">
              <TheCircleLogo className="w-26 h-26 mr-4" /> {/* Apply specific size and margin */}
              <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wider text-white">
                The Circle
              </h1>
            </div>

            {/* Search Bar */}
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

            {/* Sort and Filter Buttons */}
            <div className="flex space-x-2 mt-4 md:mt-0">
              <button className="flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors shadow-md">
                <ArrowDownWideNarrow className="w-4 h-4 mr-2" /> Sort
              </button>
              <button className="flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors shadow-md">
                <SlidersHorizontal className="w-4 h-4 mr-2" /> Filter
              </button>
            </div>
          </div>

          {/* Streams Grid - Displays all available or filtered streams */}
          {/* CHANGE: Adjusted grid columns to lg:grid-cols-3 and added more top margin (mt-12) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow mt-12">
            {filteredStreams.length > 0 ? (
                filteredStreams.map(stream => (
                    <div
                        key={stream.id}
                        className="bg-white/80  backdrop-blur-sm rounded-lg overflow-hidden shadow-xl shadow-black/30 transition-all duration-300 ease-in-out hover:scale-[1.02] cursor-pointer"
                        onClick={() => alert(`Navigating to ${stream.streamer}'s stream: ${stream.title}`)} // Placeholder for navigation
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

        {/* Right Panel - Fixed width sidebar */}
        {/* CHANGE: Updated main panel background, border, padding, and rounded corners */}
        <div className="w-full md:w-80 flex-shrink-0 ml-0 md:ml-6 mt-6 md:mt-0 flex flex-col space-y-6"> {/* Added space-y-6 for vertical spacing between panels */}
          {/* Top Part of Right Panel: Profile + Go Live Button */}
          <div className="bg-white/80 border-white/10 rounded-3xl p-8 shadow-xl shadow-black/30 flex flex-col items-center">
            <div className="flex justify-between mb-3 items-center">
            <div className="w-14 h-14 rounded-full bg-neutral-700 flex items-center justify-center mr-3 mb-3 border-4 border-[#a83246] overflow-hidden">
              {/* Placeholder for user avatar, could be dynamic later */}
              <User className="w-16 h-16 text-neutral-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">My Profile</h2>
            </div>{/* Changed text to gray-800 for contrast */}
            {/* Link to StreamerPage for "Go Live" functionality */}
            <Link to="/streamer" className="w-full">
              <button className="flex items-center justify-center w-full px-4 py-2 rounded-full bg-[#a83246] text-white font-semibold hover:bg-[#c04d65] transition-colors shadow-lg shadow-[#a83246]/40">
                <Camera className="w-5 h-5 mr-2" /> Go Live
              </button>
            </Link>
            {/* Settings Button (can link to a settings page if needed) */}
            <Link to="/login" className="w-full mt-2"> {/* Using login as a placeholder for settings route */}
              <button className="flex items-center justify-center w-full px-4 py-2 rounded-full bg-white/40 text-gray-800 font-semibold hover:bg-white/60 transition-colors shadow-md"> {/* Adjusted background and text color */}
                <Settings className="w-5 h-5 mr-2" /> Settings
              </button>
            </Link>
          </div>

          {/* Bottom Part of Right Panel: List of People You Follow */}
          <div className="flex-grow bg-white/80 border-white/10 rounded-3xl p-8 shadow-xl shadow-black/30 overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Following</h3> {/* Changed text to gray-800 for contrast */}
            <ul>
              {followedUsers.map(user => (
                  <li key={user.id} className="flex items-center mb-3 p-2 rounded-md hover:bg-white/20 transition-colors cursor-pointer"> {/* Adjusted hover background */}
                    <div className={`w-6 h-6 rounded-full mr-3 flex-shrink-0  overflow-hidden`}>
                      {/* User Avatar */}
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-gray-800 font-semibold flex-grow truncate">{user.name}</span> {/* Changed text to gray-800 for contrast */}
                  {user.isOnline && (
                      <div className="relative inline-flex">
                        <div className="rounded-full bg-red-500 h-[8px] w-[8px] inline-block mr-2"></div>
                        <div className="absolute animate-ping rounded-full bg-red-500 h-[8px] w-[8px] mr-2"></div>
                      </div>                  )}
                  </li>

              ))}
            </ul>
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
          <Route path="/" element={<HomePage />} />
          {/* Protected route for StreamerPage */}
          <Route
              path="/streamer"
              element={
                <RequireAuth>
                  <StreamerPage />
                </RequireAuth>
              }
          />
          {/* Protected route for ViewerPage (Note: original code had /streamer here, corrected to /viewer) */}
          <Route
              path="/viewer"
              element={
                <RequireAuth>
                  <ViewerPage />
                </RequireAuth>
              }
          />
          {/* Login Page route */}
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </Router>
  );
}

export default App;