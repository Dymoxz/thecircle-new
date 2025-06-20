import React, { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
// Make sure to import your other pages if they are in different files
import StreamerPage from "./pages/StreamerPage";
import ViewerPage from "./pages/ViewerPage";
import LoginPage from "./pages/LoginPage.jsx";
import { Camera, Eye, Lock } from "lucide-react";
import RequireAuth from "./component/RequireAuth.jsx";
import { jwtDecode } from "jwt-decode";
import { useRef } from "react";
import { setupDeviceKey } from "./services/keys.service.js";

// --- The Circle Logo SVG ---
// No changes were needed here, but it's included for completeness.
const TheCircleLogo = () => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    className="mx-auto mb-6 drop-shadow-[0_4px_32px_rgba(80,0,20,0.5)]"
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
  const setupCalled = useRef(false);

  useEffect(() => {
    document.title = "The Circle - Home";

    const token = localStorage.getItem("jwt_token");

    if (token) {
      try {
        const { exp } = jwtDecode(token);
        if (Date.now() < exp * 1000) {
          if (!setupCalled.current) {
            setupDeviceKey();
            setupCalled.current = true;
          }
        } else {
          console.log("expired jwt_token");
        }
      } catch (e) {
        console.log("invalid jwt_token");
      }
    }
  }, []);

  return (
    // --- CHANGE: Updated to a deep maroon gradient and set the new font globally ---
    <div className="min-h-screen w-screen bg-gradient-to-br from-[#5c0000] via-[#800000] to-[#2d0a14] text-white flex items-center justify-center p-4 relative overflow-hidden font-oswald">
      {/* Main Content Hub */}
      <div className="relative z-10 w-full max-w-3xl text-center">
        <TheCircleLogo />
        <h1
          // --- CHANGE: Updated font ---
          className="text-6xl md:text-8xl font-bold uppercase mb-4 tracking-wider text-white"
          style={{ textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
        >
          The Circle
        </h1>
        <p
          className="text-neutral-300 text-lg mb-12 font-light max-w-xl mx-auto"
          style={{ fontFamily: "sans-serif" }}
        >
          Secrets are power. Step inside.
          <br />
          Broadcast, watch, and connect in a world where privacy is an illusion.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* --- CHANGE: Increased blur to '2xl', updated border/shadows, and updated font on all cards --- */}

          {/* Streamer Card */}
          <Link to="/streamer" className="group">
            <div
              className="h-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center
                            shadow-xl shadow-black/30 transition-all duration-300 ease-in-out
                            hover:bg-white/10 hover:scale-105 hover:shadow-2xl hover:shadow-[#a83246]/50"
            >
              <div className="mb-4 w-20 h-20 bg-black/20 rounded-full flex items-center justify-center border border-white/10 transition-all duration-300 group-hover:bg-black/40 group-hover:border-white/20">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold uppercase tracking-wider text-white">
                Go Live
              </h2>
              <p
                className="text-neutral-300 font-light"
                style={{ fontFamily: "sans-serif" }}
              >
                Broadcast.
              </p>
            </div>
          </Link>

          {/* Viewer Card */}
          <Link to="/viewer" className="group">
            <div
              className="h-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center
                            shadow-xl shadow-black/30 transition-all duration-300 ease-in-out
                            hover:bg-white/10 hover:scale-105 hover:shadow-2xl hover:shadow-[#a83246]/50"
            >
              <div className="mb-4 w-20 h-20 bg-black/20 rounded-full flex items-center justify-center border border-white/10 transition-all duration-300 group-hover:bg-black/40 group-hover:border-white/20">
                <Eye className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold uppercase tracking-wider text-white">
                Watch
              </h2>
              <p
                className="text-neutral-300 font-light"
                style={{ fontFamily: "sans-serif" }}
              >
                Join the action.
              </p>
            </div>
          </Link>

          {/* Login Card */}
          <Link to="/login" className="group">
            <div
              className="h-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center
                            shadow-xl shadow-black/30 transition-all duration-300 ease-in-out
                            hover:bg-white/10 hover:scale-105 hover:shadow-2xl hover:shadow-[#a83246]/50"
            >
              <div className="mb-4 w-20 h-20 bg-black/20 rounded-full flex items-center justify-center border border-white/10 transition-all duration-300 group-hover:bg-black/40 group-hover:border-white/20">
                <Lock className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold uppercase tracking-wider text-white">
                Login
              </h2>
              <p
                className="text-neutral-300 font-light"
                style={{ fontFamily: "sans-serif" }}
              >
                Access.
              </p>
            </div>
          </Link>
        </div>
        <div className="mt-12 text-xs text-neutral-400/70 font-sans">
          © {new Date().getFullYear()} The Circle — Secrets are power.
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
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
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
