import React, { useEffect } from "react";

const Toast = ({ message, show, onClose, duration = 5000 }) => {
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [show, duration, onClose]);

    return (
        <div
            className={`fixed top-8 left-1/2 z-50 transform -translate-x-1/2 transition-all duration-500 pointer-events-none ${
                show
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-90 -translate-y-8"
            }`}
            style={{ minWidth: 320, maxWidth: 400 }}
        >
            <div className="bg-neutral-900/80 border border-neutral-100/10 backdrop-blur-lg shadow-xl rounded-2xl px-6 py-4 flex items-center justify-center text-lg font-semibold text-teal-200 animate-toast-in">
                {message}
            </div>
            <style>{`
                @keyframes toast-in {
                    0% { opacity: 0; transform: scale(0.95) translateY(-24px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-toast-in {
                    animation: toast-in 0.5s cubic-bezier(0.4,0,0.2,1);
                }
            `}</style>
        </div>
    );
};

export default Toast;

