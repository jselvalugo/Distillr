import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { apiRequest } from "../lib/queryClient";

type Role = "user" | "assistant";
type Message = { role: Role; content: string; error?: boolean };

const WELCOME = `Hi! I'm **Distillr AI**, your distillery operations assistant.

I have live access to your batches, barrels, inventory, permits, compliance records, TTB reports, and sales data. Ask me anything — here are a few ideas:

• _"What batches are currently aging?"_
• _"Do we have any permits expiring soon?"_
• _"Summarize this month's production output."_
• _"How do I calculate excise tax for a CBMA producer?"_`;

function renderContent(text: string) {
  // Basic markdown: bold, italic, bullet points, line breaks
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const isBullet = /^[•\-\*]\s/.test(line);
    const content = line
      .replace(/^[•\-\*]\s/, "")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>");

    if (isBullet) {
      return (
        <div key={i} className="flex gap-2 items-start">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-50" />
          <span dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      );
    }
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <div key={i} dangerouslySetInnerHTML={{ __html: content }} />;
  });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#a3a3a3]"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <span className="text-[10px] text-[#a3a3a3] ml-1">Distillr AI is thinking…</span>
    </div>
  );
}

export function AiChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setHasUnread(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-grow textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      const apiMessages = next.map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest<{ message: string }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: apiMessages }),
      });
      const assistantMsg: Message = { role: "assistant", content: res.message };
      setMessages(prev => [...prev, assistantMsg]);
      if (!open) setHasUnread(true);
    } catch (err: any) {
      const errMsg: Message = {
        role: "assistant",
        content: err?.message || "Something went wrong. Please try again.",
        error: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, open]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Distillr AI"
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          width: 52, height: 52,
          background: open ? "#0F1B42" : "linear-gradient(135deg, #4f8ef7 0%, #1a3fa8 60%, #0F1B42 100%)",
          boxShadow: open ? "0 4px 20px rgba(15,27,66,0.4)" : "0 4px 28px rgba(79,142,247,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {open ? <X size={20} color="white" /> : <Bot size={20} color="white" />}
        {hasUnread && !open && (
          <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-[72px] right-6 z-50 flex flex-col overflow-hidden"
          style={{
            width: 400,
            height: 580,
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: 16,
            boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
            animation: "slideUp 0.2s ease-out",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: "#0a0a0a" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #c9933a 0%, #a87828 100%)" }}>
              <Sparkles size={14} color="white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none">Distillr AI</p>
              <p className="text-[10px] text-white/40 mt-0.5">Powered by Loogo Labs</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-white/40">Live</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: "#fafafa" }}>
            {/* Welcome card */}
            <div className="rounded-xl p-3.5 text-xs leading-relaxed space-y-1"
              style={{ background: "white", border: "1px solid #e5e5e5", color: "#404040" }}>
              {renderContent(WELCOME)}
            </div>

            {/* Conversation */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full shrink-0 mr-2 mt-0.5 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #c9933a, #a87828)" }}>
                    <Sparkles size={10} color="white" />
                  </div>
                )}
                <div
                  className="max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed space-y-1"
                  style={
                    msg.role === "user"
                      ? { background: "#0a0a0a", color: "white", borderRadius: "12px 12px 2px 12px" }
                      : msg.error
                      ? { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "2px 12px 12px 12px" }
                      : { background: "white", color: "#0a0a0a", border: "1px solid #e5e5e5", borderRadius: "2px 12px 12px 12px" }
                  }
                >
                  {msg.error && <AlertCircle size={12} className="inline mr-1 mb-0.5" />}
                  {msg.role === "user"
                    ? <span>{msg.content}</span>
                    : renderContent(msg.content)
                  }
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full shrink-0 mr-2 mt-0.5 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #c9933a, #a87828)" }}>
                  <Sparkles size={10} color="white" />
                </div>
                <div className="rounded-xl bg-white border border-[#e5e5e5]" style={{ borderRadius: "2px 12px 12px 12px" }}>
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips — show when no messages yet */}
          {isEmpty && !loading && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap shrink-0" style={{ background: "#fafafa" }}>
              {["Active batches?", "Permits expiring?", "Latest production?"].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-[#e5e5e5] bg-white text-[#737373] hover:border-[#c9933a] hover:text-[#c9933a] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="px-3 pb-3 pt-2 shrink-0 border-t border-[#f0f0f0]" style={{ background: "white" }}>
            <div className="flex items-end gap-2 rounded-xl border border-[#e5e5e5] px-3 py-2 focus-within:border-[#c9933a] transition-colors"
              style={{ background: "#fafafa" }}>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about batches, inventory, compliance…"
                disabled={loading}
                className="flex-1 resize-none bg-transparent text-xs text-[#0a0a0a] placeholder-[#b0b0b0] outline-none leading-relaxed"
                style={{ maxHeight: 120, minHeight: 20 }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                style={{ background: !input.trim() || loading ? "#e5e5e5" : "linear-gradient(135deg, #c9933a, #a87828)" }}
              >
                {loading
                  ? <Loader2 size={13} color="#737373" className="animate-spin" />
                  : <Send size={13} color={!input.trim() ? "#737373" : "white"} />
                }
              </button>
            </div>
            <p className="text-[9px] text-[#c0c0c0] text-center mt-1.5">
              Enter to send · Shift+Enter for new line · Read-only access
            </p>
          </div>
        </div>
      )}
    </>
  );
}
