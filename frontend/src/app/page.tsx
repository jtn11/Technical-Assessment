"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Send, FileText, UploadCloud, X, Loader2, Bot, User, CheckCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for cleaner class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Hello! I am your AI assistant. Upload a PDF or ingest some text, and then ask me anything about it!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pdf" | "text">("pdf");
  
  const [uploadText, setUploadText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, { message: userMessage.content });
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: res.data.response }
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: `Error: Could not reach the server. Make sure it's running on port 8000. details: ${err.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setUploadStatus("uploading");
    
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/upload-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadStatus("success");
      setStatusMessage(res.data.message);
      setTimeout(() => {
        setIsModalOpen(false);
        setUploadStatus("idle");
        setSelectedFile(null);
      }, 2000);
    } catch (err: any) {
      setUploadStatus("error");
      setStatusMessage(err.response?.data?.detail || err.message);
    }
  };

  const handleTextIngest = async () => {
    if (!uploadText.trim()) return;
    setUploadStatus("uploading");

    try {
      const res = await axios.post(`${API_BASE}/ingest`, { text: uploadText });
      setUploadStatus("success");
      setStatusMessage(res.data.message);
      setTimeout(() => {
        setIsModalOpen(false);
        setUploadStatus("idle");
        setUploadText("");
      }, 2000);
    } catch (err: any) {
      setUploadStatus("error");
      setStatusMessage(err.response?.data?.detail || err.message);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-neutral-200 selection:bg-emerald-500/30">
      {/* Header */}
      <header className="sticky top-0 z-10 p-4 border-b border-neutral-800/50 bg-neutral-900/50 backdrop-blur-xl flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="text-neutral-950 w-6 h-6" />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight">RAG Docs AI</h1>
            <p className="text-xs text-emerald-400/80 font-medium tracking-wide items-center flex gap-1.5"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>FastAPI Backend Active</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium rounded-full transition-all duration-300 ring-1 ring-neutral-700 hover:ring-neutral-500 active:scale-95"
        >
          <UploadCloud className="w-4 h-4" />
          Knowledge Base
        </button>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-8 lg:px-24 xl:px-48 relative">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex-shrink-0 flex items-center justify-center mt-1">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              
              <div className={cn(
                "px-5 py-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] leading-relaxed text-[15px]",
                msg.role === "user" 
                  ? "bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white rounded-br-none shadow-lg shadow-emerald-900/20" 
                  : "bg-neutral-800/80 border border-neutral-800 rounded-bl-none text-neutral-300"
              )}>
                {msg.content}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-neutral-700 flex-shrink-0 flex items-center justify-center mt-1">
                  <User className="w-4 h-4 text-neutral-300" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4 w-full justify-start animate-in fade-in duration-300">
               <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex-shrink-0 flex items-center justify-center mt-1">
                  <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
                <div className="px-5 py-4 rounded-2xl bg-neutral-800/80 border border-neutral-800 rounded-bl-none text-neutral-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="sticky bottom-0 p-4 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent pt-10">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative group">
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 rounded-2xl -z-10 transition-opacity duration-500 opacity-0 group-hover:opacity-100" />
          <div className="relative flex items-center bg-neutral-900 border border-neutral-700/50 shadow-xl shadow-black/50 overflow-hidden rounded-2xl focus-within:ring-1 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/30 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about the documents..."
              className="w-full bg-transparent border-none py-4 pl-6 pr-14 text-neutral-200 placeholder-neutral-500 outline-none focus:ring-0 text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-all duration-200 active:scale-95 disabled:active:scale-100 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" />
            </button>
          </div>
        </form>
        <p className="text-center text-[11px] text-neutral-600 mt-3 font-medium">Memory overhead minimized for Render 512MB RAM constraints.</p>
      </div>

      {/* Upload Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-neutral-800/80">
              <h2 className="font-semibold text-neutral-200">Knowledge Base</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-neutral-300 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-1 flex border-b border-neutral-800/80 bg-neutral-900">
              <button 
                onClick={() => setActiveTab("pdf")}
                className={cn("flex-1 py-3 text-sm font-medium transition-all rounded-lg", activeTab === "pdf" ? "bg-neutral-800 text-neutral-200" : "text-neutral-500 hover:text-neutral-400")}
              >
                Upload PDF
              </button>
              <button 
                onClick={() => setActiveTab("text")}
                className={cn("flex-1 py-3 text-sm font-medium transition-all rounded-lg", activeTab === "text" ? "bg-neutral-800 text-neutral-200" : "text-neutral-500 hover:text-neutral-400")}
              >
                Raw Text
              </button>
            </div>

            <div className="p-6">
              {activeTab === "pdf" ? (
                <div className="space-y-4">
                  <div className="relative border-2 border-dashed border-neutral-700 hover:border-emerald-500/50 rounded-xl p-8 text-center transition-colors bg-neutral-950/30 w-full group">
                    <input 
                      type="file" 
                      accept=".pdf" 
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-300">
                        <FileText className="w-6 h-6 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <div>
                        {selectedFile ? (
                          <p className="text-sm font-medium text-emerald-400">{selectedFile.name}</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-neutral-300">Click to upload or drag & drop</p>
                            <p className="text-xs text-neutral-500 mt-1">PDF documents only</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleFileUpload}
                    disabled={!selectedFile || uploadStatus === "uploading"}
                    className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploadStatus === "uploading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Process PDF"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                    placeholder="Paste text to quickly ingest into Pinecone..."
                    className="w-full h-40 bg-neutral-950/50 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300 placeholder-neutral-600 focus:ring-1 focus:ring-emerald-500/50 outline-none resize-none"
                  />
                  <button 
                    onClick={handleTextIngest}
                    disabled={!uploadText.trim() || uploadStatus === "uploading"}
                    className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploadStatus === "uploading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ingest Text"}
                  </button>
                </div>
              )}

              {uploadStatus === "success" && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 animate-in slide-in-from-top-1">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-emerald-300/90">{statusMessage}</p>
                </div>
              )}

              {uploadStatus === "error" && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2 animate-in slide-in-from-top-1">
                  <div className="w-4 h-4 rounded-full bg-red-400/20 flex items-center justify-center mt-0.5 shrink-0"><span className="text-red-400 text-[10px] font-bold">!</span></div>
                  <p className="text-sm text-red-300">{statusMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
