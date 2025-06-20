import React from "react";
import { XCircle } from "lucide-react";

const MaxStreams = ({ show, onClose }) => {
	if (!show) return null;
	return (
		<div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xl z-50 transition-opacity duration-500">
			<div className="relative bg-neutral-900/80 border border-red-500/40 rounded-3xl p-8 shadow-2xl text-center max-w-sm mx-auto">
				<div className="w-24 h-24 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
					<XCircle className="w-12 h-12 text-red-400" />
				</div>
				<h3 className="text-2xl font-bold mb-2 text-red-400">
					Stream Limit Reached
				</h3>
				<p className="text-neutral-200 mb-4">
					You can only watch up to{" "}
					<span className="font-bold">4 streams</span> at a time.
					<br />
					Please close another stream before joining a new one.
				</p>
				{onClose && (
					<button
						onClick={onClose}
						className="mt-2 px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors"
					>
						Close
					</button>
				)}
			</div>
		</div>
	);
};

export default MaxStreams;
