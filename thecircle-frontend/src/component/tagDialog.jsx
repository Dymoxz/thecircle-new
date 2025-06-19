import {useState} from "react";

export const TagDialog = ({ open, onClose, onSave }) => {
    const [input, setInput] = useState("");
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-neutral-900 p-6 rounded-2xl shadow-xl w-96">
                <h2 className="text-lg font-semibold mb-4">Enter Stream Tags</h2>
                <input
                    className="w-full p-2 rounded bg-neutral-800 text-neutral-100 mb-4"
                    type="text"
                    placeholder="Comma separated tags (e.g. gaming, music)"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                />
                <div className="flex justify-end space-x-2">
                    <button
                        className="px-4 py-2 rounded bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 rounded bg-teal-500 text-neutral-900 font-semibold hover:bg-teal-600"
                        onClick={() => { onSave(input); onClose(); }}
                    >
                        Start
                    </button>
                </div>
            </div>
        </div>
    );
};

