import React, {useState} from 'react';
import { Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom"; // Add this import

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate(); // Add this line

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle login logic here
        console.log('Logging in with:', {email, password});
        // On success:
        navigate('/');
    };

    return (
        <div className="h-[100dvh] w-screen text-neutral-100 overflow-hidden bg-neutral-900 relative flex items-center justify-center">
            {/* Animated Gradient Background */}
            <div
                className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-teal-900 to-neutral-900 bg-[length:200%_200%] animate-gradient"
                style={{ willChange: 'background-position', zIndex: 0 }}
            />
            {/* Blurred overlay card */}
            <div className="w-full max-w-md p-8 space-y-8 bg-neutral-900/50 backdrop-blur-lg rounded-3xl shadow-2xl border border-neutral-100/10 relative z-10">
                {/* Header Section */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">
                        Designer Workspace
                    </h1>
                    <p className="text-neutral-300">
                        Log in to your expressive dashboard
                    </p>
                </div>
                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email Input */}
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20}/>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-neutral-800/60 text-white placeholder-neutral-400 rounded-2xl border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300"
                            required
                        />
                    </div>
                    {/* Password Input */}
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-neutral-800/60 text-white placeholder-neutral-400 rounded-2xl border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300"
                            required
                        />
                    </div>
                    {/* Pill-shaped Login Button */}
                    <button
                        type="submit"
                        className="w-full p-3 font-bold text-white bg-teal-500 hover:bg-teal-600 rounded-2xl shadow-lg transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-teal-500"
                    >
                        Log In
                    </button>
                </form>
                {/* Footer Link */}
                <div className="text-center">
                    <a href="#" className="text-sm text-teal-300 hover:underline">
                        Forgot Password?
                    </a>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;