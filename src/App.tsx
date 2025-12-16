import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const WS_URL = import.meta.env.VITE_WS_URL!;


type Message = {
  id: string;
  text: string;
  self: boolean;
};

export default function App() {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const connectRef = useRef<() => void | null>(null);

  const [screen, setScreen] = useState<"home" | "chat">("home");
  const [roomId, setRoomId] = useState("");
  const [inputRoom, setInputRoom] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [userCount, setUserCount] = useState("0");
  const [connected, setConnected] = useState(false);

  /* =========================
      SOCKET CONNECT + RECONNECT
   ========================= */
  const connectSocket = useCallback(() => {
    socketRef.current = new WebSocket(WS_URL);

    socketRef.current.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    socketRef.current.onclose = () => {
      setConnected(false);
      reconnectTimer.current = window.setTimeout(() => connectRef.current?.(), 2000);
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "room-created") {
        setRoomId(data.payload.room);
        setScreen("chat");
      }

      if (data.type === "joined") {
        setRoomId(data.payload.room);
        setScreen("chat");
      }

      if (data.type === "user-count") {
        setUserCount(`${data.payload.count}/${data.payload.max}`);
      }

      if (data.type === "message") {
        setMessages((prev) => [
          ...prev,
          { id: data.payload.id, text: data.payload.message, self: false },
        ]);
      }

      if (data.type === "typing") {
        setTyping(data.payload.typing);
      }
    };
  }, []);

  useEffect(() => {
    connectRef.current = connectSocket;
  }, [connectSocket]);

  useEffect(() => {
    connectSocket();
    return () => socketRef.current?.close();
  }, [connectSocket]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* =========================
      ACTIONS
   ========================= */
  const createRoom = () => {
    socketRef.current?.send(JSON.stringify({ type: "create-room" }));
  };

  const joinRoom = () => {
    if (!inputRoom) return;
    socketRef.current?.send(
      JSON.stringify({ type: "join-room", payload: { room: inputRoom } })
    );
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    const id = crypto.randomUUID();

    setMessages((prev) => [...prev, { id, text, self: true }]);

    socketRef.current?.send(
      JSON.stringify({ type: "message", payload: { id, text } })
    );

    setText("");
  };

  const copyRoomId = async () => {
    if (!roomId) return;
    await navigator.clipboard.writeText(roomId);
    // Optional: Add a toast notification here
    alert("Room ID copied!");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") sendMessage();
  };

  /* =========================
      UI RENDER
   ========================= */
  return (
    <div className="h-screen w-full bg-neutral-950 text-white font-serif overflow-hidden flex flex-col">
      <motion.button
       whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-3 m-3 w-fit py-3.5 bg-white text-black font-serif rounded-2xl shadow-lg shadow-white/10 hover:bg-neutral-200 transition-colors">
        IncognitoChat
      </motion.button>
      <AnimatePresence mode="wait">
        {screen === "home" ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md  bg-black-900/50 border border-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
              <div className="mb-8 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 mb-2">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  
                </div>
                 <h1 className="text-3xl font-bold text-white font-mono bg-clip-text t">
                  Real Time Chat
                </h1>
               
                <p className="text-neutral-400 font-serif text-sm">
                  temporary room that expires after all users exit
                </p>
              </div>

              <div className="space-y-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={createRoom}
                  className="w-full py-3.5 bg-white text-black font-serif rounded shadow-lg shadow-white/10 hover:bg-neutral-200 transition-colors"
                >
                  Create New Room
                </motion.button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-neutral-900 px-2 font-serif text-neutral-500">
                      Or join with code
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    value={inputRoom}
                    onChange={(e) => setInputRoom(e.target.value)}
                    placeholder="e.g. 8x29a"
                    className="flex-1 p-3.5 rounded font-serif bg-black/50 border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-neutral-600"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={joinRoom}
                    disabled={!inputRoom}
                    className="px-6 py-3.5 bg-neutral-800 border font-serif border-white/10 rounded font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Join
                  </motion.button>
                </div>

                <div className="pt-4 flex items-center justify-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connected ? "bg-green-500" : "bg-red-500 animate-pulse"
                    }`}
                  />
                  <span className="text-xs text-neutral-500">
                    {connected ? "Server Connected" : "Connecting..."}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full max-w-3xl mx-auto w-full bg-neutral-900/30 sm:border-x sm:border-white/5"
          >
            {/* HEADER */}
            <header className="h-16 px-4 border-b border-white/10 flex items-center justify-between backdrop-blur-md bg-neutral-950/80 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScreen("home")}
                  className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div>
                  <h2 className="font-semibold text-sm text-neutral-200">
                    Room Code
                  </h2>
                  <button
                    onClick={copyRoomId}
                    className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    {roomId}
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium">{userCount} Online</span>
              </div>
            </header>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`flex ${msg.self ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl wrap-break-word text-sm leading-relaxed shadow-md ${
                        msg.self
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-neutral-800 text-neutral-200 rounded-bl-none border border-white/5"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Typing Indicator */}
              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-neutral-800 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-1">
                     <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                     <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                     <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <div className="p-4 bg-neutral-950/80 backdrop-blur-md border-t border-white/10">
              <div className="flex gap-2 items-end max-w-3xl mx-auto">
                <div className="relative flex-1">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() =>
                      socketRef.current?.send(
                        JSON.stringify({ type: "typing", payload: { typing: true } })
                      )
                    }
                    onBlur={() =>
                      socketRef.current?.send(
                        JSON.stringify({ type: "typing", payload: { typing: false } })
                      )
                    }
                    className="w-full pl-4 pr-4 py-3 bg-neutral-900 border border-white/10 rounded-2xl focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-white placeholder:text-neutral-500"
                    placeholder="Type a message..."
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendMessage}
                  disabled={!text.trim()}
                  className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none hover:bg-blue-500 transition-colors"
                >
                  <svg
                    className="w-5 h-5 transform rotate-90"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}