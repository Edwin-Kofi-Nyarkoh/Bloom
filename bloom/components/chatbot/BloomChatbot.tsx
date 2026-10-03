"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import BloomFlower from "@/components/ui/BloomFlower";
import { SendIcon } from "@/components/ui/icons";
import api, { apiErrorStatus } from "@/lib/api";
import { todayKey } from "@/lib/dates";
import { useAuthToken } from "@/lib/useAuthToken";
import { authHeader } from "@/lib/useBloomData";

type ChatMessage = { id: string; role: "user" | "bloom"; text: string };

const SUGGESTIONS = [
  "When is my next period?",
  "Can I get pregnant today?",
  "What helps with cramps?",
  "What does luteal mean?",
  "Why am I so tired?",
];

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part
  );
}

/** Renders the small subset of formatting Bloom uses: paragraphs, bold, and dash lists. */
function renderMessage(text: string) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {list.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  text.split("\n").forEach((line) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flush();
    if (trimmed) blocks.push(<p key={`p-${blocks.length}`}>{renderInline(trimmed.replace(/^#+\s*/, ""))}</p>);
  });
  flush();
  return blocks;
}

export default function BloomChatbot() {
  const token = useAuthToken();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get("/chat/logs", authHeader(token))
      .then((response) => {
        if (cancelled) return;
        const logs = Array.isArray(response.data?.logs) ? response.data.logs : [];
        setMessages(
          logs.map((log: { id: string; role: string; message: string }) => ({
            id: log.id,
            role: log.role === "USER" ? "user" : "bloom",
            text: log.message,
          }))
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || thinking || !token) return;
    setDraft("");
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: message }]);
    setThinking(true);
    try {
      const ask = () => api.post("/chat", { message, today: todayKey() }, authHeader(token));
      // A dropped connection usually works on the second try, so retry once before giving up.
      const response = await ask().catch(async (error) => {
        if (apiErrorStatus(error) === 401) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return ask();
      });
      setMessages((current) => [...current, { id: `b-${Date.now()}`, role: "bloom", text: response.data.reply }]);
    } catch (error) {
      const text =
        apiErrorStatus(error) === 401
          ? "Please sign in again so we can keep chatting."
          : "I couldn't reach the server just now. Please try again in a moment.";
      setMessages((current) => [...current, { id: `e-${Date.now()}`, role: "bloom", text }]);
    } finally {
      setThinking(false);
    }
  };

  const clear = async () => {
    if (!token || !window.confirm("Delete this whole conversation?")) return;
    await api.delete("/chat/logs", authHeader(token)).catch(() => undefined);
    setMessages([]);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  return (
    <section className="flex h-[calc(100dvh-14rem)] min-h-104 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-soft md:h-[calc(100dvh-6.5rem)]">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <BloomFlower size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold leading-tight text-ink">Bloom AI</h1>
          <p className="truncate text-xs text-muted">Ask me anything. I&apos;m here to help, not to judge.</p>
        </div>
        {messages.length ? (
          <button type="button" onClick={clear} className="cursor-pointer rounded-full px-3 py-2 text-xs font-bold text-muted">
            Clear
          </button>
        ) : null}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {loaded && !messages.length ? (
          <div className="mx-auto max-w-xs pt-4 text-center">
            <div className="mx-auto w-fit">
              <BloomFlower size={72} />
            </div>
            <p className="mt-3 font-display text-xl font-semibold text-ink">Hi, I&apos;m Bloom 🌸</p>
            <p className="mt-1 text-sm text-muted">
              Ask about your period, your body, or just tell me about your day.
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] space-y-2 rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed ${
                message.role === "user"
                  ? "rounded-br-lg bg-primary text-on-primary"
                  : "rounded-bl-lg bg-bg text-ink"
              }`}
            >
              {renderMessage(message.text)}
            </div>
          </div>
        ))}

        {thinking ? (
          <div className="flex justify-start" aria-label="Bloom is typing">
            <div className="flex gap-1.5 rounded-3xl rounded-bl-lg bg-bg px-4 py-3.5">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="typing-dot h-2 w-2 rounded-full bg-muted"
                  style={{ animationDelay: `${dot * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line px-3 pb-3 pt-2">
        <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={thinking}
              onClick={() => send(suggestion)}
              className="shrink-0 cursor-pointer rounded-full bg-primary-soft px-3.5 py-2 text-sm font-bold text-primary-ink transition active:scale-95 disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message"
            aria-label="Message"
            maxLength={2000}
            className="field rounded-full"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || thinking}
            className="btn btn-primary h-12 w-12 shrink-0 px-0"
          >
            <SendIcon size={20} />
          </button>
        </form>
      </div>
    </section>
  );
}
