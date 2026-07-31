import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, AlertCircle, Sparkles, Zap } from "lucide-react";
import { apiRequest } from "../lib/queryClient";

type Role = "user" | "assistant";
type Message = { role: Role; content: string; error?: boolean };

const NAVY = "#0F1B42";
const NAVY2 = "#162050";
const BLUE_GRAD = "linear-gradient(135deg, #4f8ef7 0%, #1a3fa8 60%, #0F1B42 100%)";
const BLUE_GLOW = "0 4px 20px rgba(79,142,247,0.35)";

const WELCOME = `Hi! I'm **Distillr AI**, your distillery operations assistant.

I have live access to your batches, barrels, inventory, permits, compliance records, TTB reports, and sales data.`;

const CHIPS = [
  "Active batches?",
  "Permits expiring soon?",
  "This month's production?",
  "Excise tax calculation?",
];

function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const isBullet = /^[•\-\*]\s/.test(line);
    const content = line
      .replace(/^[•\-\*]\s/, "")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
    if (isBullet) return (
      <div key={i} className="flex gap-2 items-start">
        <span className="mt-[5px] w-1 h-1 rounded-full shrink-0" style={{ background: "#4f8ef7" }} />
        <span dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    return <div key={i} dangerouslySetInnerHTML={{ __html: content }} />;
  });
}

function AiAvatar({ size = 28 }: { size?: number }) {
  return (
    <div className="shrink-0 flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: BLUE_GRAD, boxShadow: "0 2px 8px rgba(79,142,247,0.4)" }}>
      <Sparkles size={size * 0.42} color="white" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#4f8ef7", animation: `aiDot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
        ))}
      </div>
      <span className="text-[10px]" style={{ color: "rgba(15,27,66,0.4)" }}>Thinking…</span>
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setHasUnread(false);
      setTimeout(() => textareaRef.current?.focus(), 120);
    }
  }, [open]);

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
      const res = await apiRequest<{ message: string }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });
      setMessages(prev => [...prev, { role: "assistant", content: res.message }]);
      if (!open) setHasUnread(true);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: err?.message || "Something went wrong.", error: true }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, open]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const canSend = !!input.trim() && !loading;
  const isEmpty = messages.length === 0;

  return (
    <>
      <style>{`
        @keyframes aiDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes aiSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aiFabPulse {
          0%, 100% { box-shadow: 0 4px 28px rgba(79,142,247,0.45), inset 0 1px 0 rgba(255,255,255,0.15); }
          50%       { box-shadow: 0 4px 36px rgba(79,142,247,0.7), inset 0 1px 0 rgba(255,255,255,0.15); }
        }
        .ai-chip:hover { background: ${NAVY} !important; color: white !important; border-color: ${NAVY} !important; }
        .ai-input-wrap:focus-within { border-color: #4f8ef7 !important; box-shadow: 0 0 0 3px rgba(79,142,247,0.12) !important; }
        .ai-msg-scroll::-webkit-scrollbar { width: 4px; }
        .ai-msg-scroll::-webkit-scrollbar-track { background: transparent; }
        .ai-msg-scroll::-webkit-scrollbar-thumb { background: rgba(15,27,66,0.1); border-radius: 99px; }
      `}</style>

      {/* FAB */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Distillr AI"
        className="fixed bottom-6 right-6 z-50 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          width: 52, height: 52,
          background: open ? NAVY : BLUE_GRAD,
          boxShadow: open ? `0 4px 20px rgba(15,27,66,0.4)` : undefined,
          animation: open ? undefined : "aiFabPulse 3s ease-in-out infinite",
        }}
      >
        {open
          ? <X size={19} color="white" />
          : <Sparkles size={19} color="white" />
        }
        {hasUnread && !open && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed right-6 z-50 flex flex-col overflow-hidden"
          style={{
            bottom: 72, width: 400, height: 600,
            borderRadius: 20,
            background: "#f4f6fb",
            border: `1px solid rgba(15,27,66,0.12)`,
            boxShadow: "0 32px 80px rgba(15,27,66,0.22), 0 8px 24px rgba(15,27,66,0.1)",
            animation: "aiSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* ── Header ── */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3.5"
            style={{ background: `linear-gradient(135deg, ${NAVY2} 0%, ${NAVY} 100%)`, borderRadius: "20px 20px 0 0" }}>
            {/* Animated glow ring around avatar */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full" style={{ background: "rgba(79,142,247,0.3)", filter: "blur(6px)", transform: "scale(1.3)" }} />
              <AiAvatar size={34} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-white leading-none">Distillr AI</p>
                <Zap size={11} color="#4f8ef7" />
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Live data access · Powered by Loogo Labs
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #34d399" }} />
              <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Online</span>
            </div>
          </div>

          {/* ── Messages ── */}
          <div className="ai-msg-scroll flex-1 overflow-y-auto px-4 py-4 space-y-3">

            {/* Welcome */}
            <div className="flex gap-2.5 items-start">
              <AiAvatar size={26} />
              <div className="flex-1 rounded-2xl rounded-tl-sm px-4 py-3 text-xs leading-relaxed space-y-1"
                style={{ background: "white", border: "1px solid rgba(15,27,66,0.08)", color: "#374151", boxShadow: "0 1px 4px rgba(15,27,66,0.06)" }}>
                {renderContent(WELCOME)}
              </div>
            </div>

            {/* Conversation */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 items-end ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.role === "assistant" && <AiAvatar size={26} />}
                <div
                  className="max-w-[82%] text-xs leading-relaxed space-y-1"
                  style={
                    msg.role === "user"
                      ? {
                          background: BLUE_GRAD,
                          color: "white",
                          padding: "10px 14px",
                          borderRadius: "16px 16px 4px 16px",
                          boxShadow: BLUE_GLOW,
                        }
                      : msg.error
                      ? {
                          background: "#fef2f2",
                          color: "#991b1b",
                          border: "1px solid #fecaca",
                          padding: "10px 14px",
                          borderRadius: "4px 16px 16px 16px",
                        }
                      : {
                          background: "white",
                          color: "#1f2937",
                          border: "1px solid rgba(15,27,66,0.08)",
                          padding: "10px 14px",
                          borderRadius: "4px 16px 16px 16px",
                          boxShadow: "0 1px 4px rgba(15,27,66,0.06)",
                        }
                  }
                >
                  {msg.error && <AlertCircle size={12} className="inline mr-1 mb-0.5 text-red-500" />}
                  {msg.role === "user" ? <span>{msg.content}</span> : renderContent(msg.content)}
                </div>
              </div>
            ))}

            {/* Typing */}
            {loading && (
              <div className="flex gap-2.5 items-end">
                <AiAvatar size={26} />
                <div className="rounded-2xl rounded-tl-sm" style={{ background: "white", border: "1px solid rgba(15,27,66,0.08)", boxShadow: "0 1px 4px rgba(15,27,66,0.06)" }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── Suggestion chips ── */}
          {isEmpty && !loading && (
            <div className="px-4 pb-2 flex gap-1.5 flex-wrap shrink-0">
              {CHIPS.map(q => (
                <button key={q} className="ai-chip text-[10px] font-medium px-3 py-1.5 rounded-full transition-all duration-150"
                  style={{ border: `1px solid rgba(15,27,66,0.15)`, background: "white", color: NAVY }}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* ── Input bar ── */}
          <div className="px-3 pb-3 pt-2 shrink-0" style={{ background: "#f4f6fb", borderTop: "1px solid rgba(15,27,66,0.07)" }}>
            <div className="ai-input-wrap flex items-end gap-2 rounded-2xl border px-3.5 py-2.5 transition-all duration-150"
              style={{ background: "white", border: "1.5px solid rgba(15,27,66,0.12)" }}>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about batches, compliance, TTB…"
                disabled={loading}
                className="flex-1 resize-none bg-transparent text-xs outline-none leading-relaxed"
                style={{ maxHeight: 120, minHeight: 20, color: NAVY, caretColor: "#4f8ef7" }}
              />
              <button
                onClick={sendMessage}
                disabled={!canSend}
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150"
                style={{
                  background: canSend ? BLUE_GRAD : "rgba(15,27,66,0.07)",
                  boxShadow: canSend ? BLUE_GLOW : "none",
                  transform: canSend ? "scale(1)" : "scale(0.95)",
                }}
              >
                {loading
                  ? <Loader2 size={13} color={NAVY} className="animate-spin" style={{ opacity: 0.4 }} />
                  : <Send size={13} color={canSend ? "white" : "rgba(15,27,66,0.3)"} />
                }
              </button>
            </div>
            <p className="text-[9px] text-center mt-1.5" style={{ color: "rgba(15,27,66,0.3)" }}>
              Enter to send · Shift+Enter for new line · Read-only data access
            </p>
          </div>
        </div>
      )}
    </>
  );
}
