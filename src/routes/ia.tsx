import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Bot, Snowflake, Send, Sparkles, Stethoscope, DollarSign, Package, Lightbulb } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";

export const Route = createFileRoute("/ia")({
  head: () => ({ meta: [{ title: "IA Climatização — OrçaAr Condicionado Pro" }] }),
  component: IAMecanicoPage,
});

const SUGGESTIONS: { label: string; icon: typeof Stethoscope; prompt: string }[] = [
  {
    label: "Diagnóstico",
    icon: Stethoscope,
    prompt: "Meu split não está gelando e a condensadora liga normalmente. Quais as causas mais prováveis?",
  },
  {
    label: "Precificação",
    icon: DollarSign,
    prompt: "Quanto cobrar pela instalação de um split inverter de 12.000 BTUs em apartamento?",
  },
  {
    label: "Materiais",
    icon: Package,
    prompt: "Liste os materiais necessários para instalar um split de 18.000 BTUs a 4 metros da condensadora.",
  },
  {
    label: "Mensagem",
    icon: Lightbulb,
    prompt: "Escreva uma mensagem profissional de WhatsApp avisando o cliente que o orçamento de higienização está pronto.",
  },
];


function IAMecanicoPage() {
  const transport = useRef(new DefaultChatTransport({ api: "/api/chat" })).current;
  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "Erro ao falar com a IA."),
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  const enviar = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    void sendMessage({ text: t });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enviar(input);
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#000000] text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-[#1E1E1E] bg-[#000000]/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div
            className="size-11 rounded-2xl grid place-items-center"
            style={{ background: "#0D0D0D", border: "1px solid #38BDF8" }}
          >
            <Bot size={22} style={{ color: "#38BDF8" }} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg tracking-wide leading-none">IA CLIMATIZAÇÃO</h1>
            <p className="text-xs mt-1" style={{ color: "#A0A0A0" }}>
              Seu assistente de climatização
            </p>
          </div>
        </div>
      </header>

      {/* CHAT */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 pb-[200px]"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && !busy && <EmptyState />}
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
          {status === "submitted" && <TypingBubble />}
          {error && (
            <div className="text-sm text-red-400 text-center">
              {error.message || "Falha ao gerar resposta."}
            </div>
          )}
        </div>
      </div>

      {/* COMPOSER */}
      <div className="fixed left-0 right-0 bottom-[64px] z-30 border-t border-[#1E1E1E] bg-[#000000]/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-3">
          {/* Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {SUGGESTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => enviar(s.prompt)}
                  disabled={busy}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 disabled:opacity-50"
                  style={{ background: "#0D0D0D", borderColor: "#1E1E1E", color: "#38BDF8" }}
                >
                  <Icon size={13} />
                  {s.label}
                </button>
              );
            })}
          </div>
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(input);
                }
              }}
              rows={1}
              placeholder="Pergunte à IA Climatização…"
              className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none border focus:border-yellow"
              style={{ background: "#111111", borderColor: "#1E1E1E", color: "#FFF", maxHeight: 120 }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Enviar"
              className="size-12 rounded-2xl grid place-items-center transition active:scale-95 disabled:opacity-40"
              style={{ background: "#38BDF8", color: "#0A0A0F" }}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="text-center pt-10 pb-6">
      <div
        className="mx-auto size-16 rounded-full grid place-items-center mb-4"
        style={{ background: "#0D0D0D", border: "1px solid #38BDF8" }}
      >
        <Sparkles size={26} style={{ color: "#38BDF8" }} />
      </div>
      <h2 className="text-white font-bold text-lg">Como posso ajudar hoje?</h2>
      <p className="text-sm mt-1" style={{ color: "#A0A0A0" }}>
        Pergunte sobre diagnósticos, materiais, preços ou mensagens para o cliente.
      </p>
    </div>
  );
}

function partsToText(m: UIMessage): string {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

function ChatBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = partsToText(message);
  if (!text) return null;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: "#0D0D0D", color: "#FFF", borderRight: "2px solid #38BDF8" }}
        >
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div
        className="size-8 rounded-full grid place-items-center shrink-0 mt-0.5"
        style={{ background: "#0D0D0D", border: "1px solid #38BDF8" }}
      >
        <Snowflake size={16} style={{ color: "#38BDF8" }} />
      </div>
      <div
        className="max-w-[85%] rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
        style={{ background: "#0D0D0D", color: "#FFF", borderLeft: "2px solid #38BDF8" }}
      >
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2">
      <div
        className="size-8 rounded-full grid place-items-center shrink-0 mt-0.5"
        style={{ background: "#0D0D0D", border: "1px solid #38BDF8" }}
      >
        <Snowflake size={16} style={{ color: "#38BDF8" }} className="animate-spin" />
      </div>
      <div
        className="rounded-2xl rounded-tl-md px-4 py-3"
        style={{ background: "#0D0D0D", borderLeft: "2px solid #38BDF8" }}
      >
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-yellow animate-pulse" />
          <span className="size-1.5 rounded-full bg-yellow animate-pulse [animation-delay:120ms]" />
          <span className="size-1.5 rounded-full bg-yellow animate-pulse [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}