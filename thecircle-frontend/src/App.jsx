// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import StreamerPage from './pages/StreamerPage';
import ViewerPage from './pages/ViewerPage';
import './App.css'; // Add some basic styling

const HomePage = () => (
    <div className="home-container">
        <h1>WebRTC Streaming App</h1>
        <nav>
            <Link to="/streamer">
                <button>Go to Streamer Page</button>
            </Link>
            <Link to="/viewer">
                <button>Go to Viewer Page</button>
            </Link>
        </nav>
    </div>
);

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/streamer" element={<StreamerPage />} />
                <Route path="/viewer" element={<ViewerPage />} />
            </Routes>
        </Router>
    );
}

export default App;