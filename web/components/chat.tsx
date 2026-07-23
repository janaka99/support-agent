"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  conversation_id: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendChatMessage = async () => {
    if (inputMessage.trim() === "") return;

    const userMsg = inputMessage;
    setInputMessage("");
    setError("");

    addMessage({
      role: "user",
      content: userMsg,
      conversation_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    });

    try {
      setIsLoading(true);
      const response = await fetch("http://localhost:8000/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMsg,
          conversation_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        }),
      });
      const data = await response.json();
      console.log(data);
      addMessage(data);
    } catch (error) {
      console.log("ERROR: ", error);
      setError("Unable to reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  function addMessage(message: Message) {
    setMessages((prev) => [...prev, message]);
  }

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#09090b] text-gray-900 dark:text-gray-100 font-sans">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center px-6 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#09090b] flex-shrink-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Support Case
            </h1>
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <span className="text-sm text-gray-500">ID: 3fa85f64</span>
            <div className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400">
              {messages.length > 0 ? "Active" : "New"}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-[#09090b]">
          <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center mb-4 shadow-sm">
                  <svg
                    className="w-6 h-6 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Support Chat
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Send a message to speak with a specialist regarding your order
                  or payment.
                </p>
              </div>
            )}

            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={index}
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[85%] sm:max-w-[75%] ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border ${
                        isUser
                          ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ml-3"
                          : "bg-blue-600 border-blue-700 mr-3"
                      }`}
                    >
                      {isUser ? (
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          U
                        </span>
                      ) : (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Message Bubble & Name */}
                    <div
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <span className="font-medium text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 px-1">
                        {isUser ? "You" : "Specialist"}
                      </span>
                      <div
                        className={`text-[15px] leading-relaxed whitespace-pre-wrap px-4 py-2.5 shadow-sm border ${
                          isUser
                            ? "bg-white dark:bg-[#18181b] border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tr-sm"
                            : "bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="flex max-w-[85%] flex-row">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 border border-blue-700 mr-3 flex items-center justify-center shadow-sm">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 px-1">
                      Specialist
                    </span>
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 px-4 py-3.5 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-1.5 h-11">
                      <div className="w-1.5 h-1.5 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-6 py-2">
            <div className="max-w-4xl mx-auto bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-md flex items-center">
              <svg
                className="w-4 h-4 mr-2 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#09090b] flex-shrink-0 z-10">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end border border-gray-300 dark:border-white/20 rounded-lg overflow-hidden bg-white dark:bg-[#18181b] shadow-sm focus-within:ring-1 focus-within:ring-gray-400 dark:focus-within:ring-gray-500 focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors">
              <textarea
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                disabled={isLoading}
                placeholder="Message Support..."
                className="flex-1 max-h-32 bg-transparent px-4 py-3 text-[15px] outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 disabled:opacity-50 resize-none"
                style={{ minHeight: "44px" }}
              />
              <div className="p-2 flex-shrink-0">
                <button
                  onClick={sendChatMessage}
                  disabled={isLoading || inputMessage.trim() === ""}
                  className="bg-gray-900 dark:bg-white text-white dark:text-black p-1.5 rounded-md hover:bg-black dark:hover:bg-gray-200 disabled:opacity-30 transition-colors flex items-center justify-center"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 12h14M12 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="mt-2 flex justify-between items-center text-[11px] text-gray-500">
              <span>Support Specialist typically replies instantly.</span>
              <span>
                <strong>Enter</strong> to send, <strong>Shift + Enter</strong>{" "}
                for new line
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
