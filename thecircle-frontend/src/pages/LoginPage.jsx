import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { login } from "../login.service";
import theCircleLogoImg from "../assets/thecircle.jpg";

// --- The Circle Logo SVG (matching HomePage) ---
const TheCircleLogo = ({ className }) => (
    <img
        src={theCircleLogoImg}
        alt="The Circle Logo"
        className={`w-20 h-20 rounded-full object-cover mx-auto mb-6 drop-shadow-[0_4px_32px_rgba(80,0,20,0.5)] ${className}`}
    />
);

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'The Circle - Login';
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const result = await login(email, password);
            if (result.token) {
                localStorage.setItem('jwt_token', result.token); // Store JWT
                navigate('/');
            } else {
                setError(result.message || 'Login failed');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }
        setLoading(false);
    };

    const handleBackToHome = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen w-screen bg-gradient-to-br from-[#7a1a1a] via-[#a83246] to-[#2d0a14] text-white flex items-center justify-center p-4 relative overflow-hidden font-oswald">

            {/* Back Button */}
            <button
                onClick={handleBackToHome}
                className="absolute top-6 left-6 z-20 group flex items-center space-x-2 text-white/70 hover:text-white transition-all duration-300"
            >
                <div className="w-10 h-10 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:bg-white/10 group-hover:scale-105">
                    <ArrowLeft className="w-5 h-5" />
                </div>
                <span className="text-sm font-light opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ fontFamily: 'sans-serif' }}>
                    Back to Home
                </span>
            </button>

            {/* Main Login Container */}
            <div className="relative z-10 w-full max-w-lg">

                {/* Frosted Glass Login Card (NO BLUR) */}
                <div className="bg-white/80 border border-white/10 rounded-3xl p-8 shadow-xl shadow-black/30 transition-all duration-300">

                    {/* Header Section */}
                    <div className="text-center mb-8">
                        <TheCircleLogo />
                        <h1
                            className="text-[#7a1a1a] text-4xl md:text-5xl font-bold uppercase mb-2 tracking-wider"
                            style={{ textShadow: "0 4px 24px rgba(168,50,70,0.15)" }}
                        >
                            Access
                        </h1>
                        <p className="text-[#7a1a1a] text-base font-light" style={{ fontFamily: 'sans-serif' }}>
                            Enter the circle. Your secrets await.
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-[#a83246]/10 backdrop-blur-xl border border-[#a83246]/30 rounded-2xl px-4 py-3 text-center">
                            <p className="text-[#7a1a1a] text-sm font-light" style={{ fontFamily: 'sans-serif' }}>
                                {error}
                            </p>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Email Input Container */}
                        <div className="relative group">
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-16 pr-4 py-4 bg-white/60 backdrop-blur-xl text-[#a83246] placeholder-[#a83246]/50 rounded-2xl border border-[#a83246]/20 focus:outline-none focus:bg-white/80 focus:border-[#a83246]/40 focus:ring-2 focus:ring-[#a83246]/30 transition-all duration-300"
                                style={{ fontFamily: 'sans-serif' }}
                                required
                                disabled={loading}
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#a83246]/10 rounded-full flex items-center justify-center border border-[#a83246]/20 transition-all duration-300 group-focus-within:bg-[#a83246]/20 group-focus-within:border-[#a83246]/40">
                                <Mail className="w-4 h-4 text-[#a83246]" />
                            </div>
                        </div>

                        {/* Password Input Container */}
                        <div className="relative group">
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-16 pr-4 py-4 bg-white/60 backdrop-blur-xl text-[#7a1a1a] placeholder-[#a83246]/50 rounded-2xl border border-[#a83246]/20 focus:outline-none focus:bg-white/80 focus:border-[#a83246]/40 focus:ring-2 focus:ring-[#a83246]/30 transition-all duration-300"
                                style={{ fontFamily: 'sans-serif' }}
                                required
                                disabled={loading}
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#a83246]/10 rounded-full flex items-center justify-center border border-[#a83246]/20 transition-all duration-300 group-focus-within:bg-[#a83246]/20 group-focus-within:border-[#a83246]/40">
                                <Lock className="w-4 h-4 text-[#7a1a1a]" />
                            </div>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            className="w-full py-4 bg-[#7a1a1a]/90 backdrop-blur-xl border border-[#a83246]/30 text-white font-bold uppercase tracking-wider rounded-2xl shadow-xl shadow-black/30 transition-all duration-300 ease-in-out hover:bg-[#a83246] hover:scale-105 hover:shadow-2xl hover:shadow-[#a83246]/40 focus:outline-none focus:ring-2 focus:ring-[#a83246]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Accessing...</span>
                                </div>
                            ) : (
                                'Enter The Circle'
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-8 text-center space-y-3">
                        <button
                            type="button"
                            className="text-[#7a1a1a] text-sm font-light hover:text-[#a83246] transition-colors duration-300 underline decoration-transparent hover:decoration-[#a83246] decoration-1 underline-offset-4"
                            style={{ fontFamily: 'sans-serif' }}
                        >
                            Forgot your access code?
                        </button>
                        <div className="text-xs text-neutral-700/70 font-sans">
                            No account? Contact your Circle administrator.
                        </div>
                    </div>
                </div>

                {/* Bottom Copyright */}
                <div className="mt-8 text-center text-xs text-neutral-400/70 font-sans">
                    © {new Date().getFullYear()} The Circle — Access is privilege.
                </div>
            </div>
        </div>
    );
};

export default LoginPage;