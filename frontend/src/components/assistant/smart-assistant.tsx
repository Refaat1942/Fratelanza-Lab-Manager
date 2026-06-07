"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { api, getApiError } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  links?: { label: string; href: string }[];
}

const SUGGESTIONS = {
  ar: ["ملخص المختبر", "كيف أضيف مريض؟", "الفواتير والمدفوعات", "مخزون منخفض"],
  en: ["Lab summary", "How to add a patient?", "Billing & payments", "Low stock"],
};

export function SmartAssistant() {
  const locale = useAuthStore((s) => s.locale) as "ar" | "en";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        locale === "ar"
          ? "مرحباً! أنا مساعد لاب ماستر. اسألني عن أي وحدة في النظام أو اطلب «ملخص المختبر»."
          : "Hi! I'm the LabMaster assistant. Ask about any module or say «lab summary» for live stats.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const { data } = await api.post("/assistant/chat", { message: msg, locale });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply, links: data.links },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: getApiError(err) || (locale === "ar" ? "حدث خطأ، حاول مجدداً." : "Something went wrong."),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 z-50 flex w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card-lg start-4 sm:start-6"
            style={{ maxHeight: "min(70vh, 560px)" }}
          >
            <div className="gradient-brand flex items-center justify-between px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <span className="font-semibold">
                  {locale === "ar" ? "المساعد الذكي" : "Smart Assistant"}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "gradient-brand text-white"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.content}
                    {m.links && m.links.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.links.map((l) => (
                          <Link
                            key={l.href}
                            href={l.href}
                            onClick={() => setOpen(false)}
                            className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-primary hover:underline"
                          >
                            {l.label} →
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {locale === "ar" ? "جاري التفكير..." : "Thinking..."}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border/60 p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS[locale].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={locale === "ar" ? "اسأل عن أي شيء..." : "Ask anything..."}
                  className="flex-1"
                  disabled={loading}
                />
                <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full gradient-brand text-white shadow-glow start-4 sm:start-6"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={locale === "ar" ? "المساعد الذكي" : "Smart assistant"}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </motion.button>
    </>
  );
}
