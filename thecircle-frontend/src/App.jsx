// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import StreamerPage from './pages/StreamerPage';
import ViewerPage from './pages/ViewerPage';
import { Camera, Eye, Lock } from 'lucide-react';
import LoginPage from "./pages/LoginPage.jsx";

const HomePage = () => {
    useEffect(() => {
        document.title = 'StreamHub - Home';
        return () => {
            document.title = 'StreamHub';
        };
    }, []);

    return (
        <div className="h-screen w-screen bg-neutral-900 text-white flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Gradient Background */}
            <div
                className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-teal-900 to-neutral-900 bg-[length:200%_200%] animate-gradient"
                style={{ willChange: 'background-position' }}
            />

            {/* Main Content Hub */}
            <div className="relative z-10 w-full max-w-xl text-center">
                <h1 className="text-5xl md:text-6xl font-bold text-teal-400 mb-4 drop-shadow-[0_2px_4px_rgba(13,148,136,0.2)]">
                    StreamHub
                </h1>
                <p className="text-neutral-300 text-lg mb-12">
                    Choose your path and dive into the live experience.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Streamer Card */}
                    <Link to="/streamer" className="group">
                        <div className="h-full bg-neutral-800/50 backdrop-blur-2xl border border-neutral-100/10 rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-300 ease-in-out hover:bg-neutral-700/70 hover:scale-105 hover:shadow-2xl hover:shadow-teal-800/10">
                            <div className="mb-4 w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 transition-all duration-300 group-hover:bg-teal-500/20 group-hover:border-teal-500/50">
                                <Camera className="w-10 h-10 text-teal-400" />
                            </div>
                            <h2 className="text-2xl font-semibold mb-1">Go Live</h2>
                            <p className="text-neutral-400">Broadcast your world.</p>
                        </div>
                    </Link>

                    {/* Viewer Card */}
                    <Link to="/viewer" className="group">
                    <div className="h-full bg-neutral-800/50 backdrop-blur-2xl border border-neutral-100/10 rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-300 ease-in-out hover:bg-neutral-700/70 hover:scale-105 hover:shadow-2xl hover:shadow-teal-800/10">
                        <div className="mb-4 w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 transition-all duration-300 group-hover:bg-teal-500/20 group-hover:border-teal-500/50">
                            <Eye className="w-10 h-10 text-teal-400" />
                        </div>
                        <h2 className="text-2xl font-semibold mb-1">Watch Now</h2>
                        <p className="text-neutral-400">Join the action.</p>
                    </div>
                </Link>
                    <Link to="/login" className="group">
                        <div className="h-full bg-neutral-800/50 backdrop-blur-2xl border border-neutral-100/10 rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-300 ease-in-out hover:bg-neutral-700/70 hover:scale-105 hover:shadow-2xl hover:shadow-teal-800/10">
                            <div className="mb-4 w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 transition-all duration-300 group-hover:bg-teal-500/20 group-hover:border-teal-500/50">
                                <Lock className="w-10 h-10 text-teal-400" />
                            </div>
                            <h2 className="text-2xl font-semibold mb-1">Login</h2>
                        </div>
                    </Link>
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
                <Route path="/streamer" element={<StreamerPage />} />
                <Route path="/viewer" element={<ViewerPage />} />
                <Route path="/login" element={<LoginPage />} />
            </Routes>
        </Router>
    );
}

export default App;