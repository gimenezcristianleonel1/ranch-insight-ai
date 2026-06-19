import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, User, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ia")({
  ssr: false,
  head: () => ({ meta: [{ title: "IA Ganadera — Ganadero IA" }] }),
  component: IAChat,
});

const SUGERENCIAS = [
  "¿Cuántas vacas vacías tengo?",
  "¿Cuál es mi % de preñez y cómo estoy vs el objetivo?",
  "¿Cuántos EV tengo y cuál es mi carga animal?",
  "¿Cuántos terneros voy a destetar este año?",
  "Dame 3 acciones prioritarias para mejorar el destete.",
];

function IAChat() {
  const { activeId, active } = useActiveEstablecimiento();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }),
        body: () => ({ establecimientoId: activeId }),
      }),
    [token, activeId],
  );

  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  async function handleSend(text: string) {
    if (!text.trim() || isLoading) return;
    await sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold">IA Ganadera</h1>
            <p className="text-xs text-muted-foreground">{active ? `Conectada a ${active.nombre}` : "Sin establecimiento activo"}</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <Bot className="h-12 w-12 mx-auto text-primary" />
              <h2 className="text-xl font-semibold mt-4">Preguntale a la IA sobre tu rodeo</h2>
              <p className="text-muted-foreground text-sm mt-1">Tiene acceso a tus datos reales en tiempo real.</p>
              <div className="grid sm:grid-cols-2 gap-2 mt-6 max-w-2xl mx-auto">
                {SUGERENCIAS.map((s) => (
                  <button key={s} onClick={() => handleSend(s)} className="text-left text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"><Bot className="h-4 w-4" /></div>}
              <Card className={`px-4 py-3 max-w-[80%] ${m.role === "user" ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}</div>
              </Card>
              {m.role === "user" && <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4" /></div>}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3"><div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Bot className="h-4 w-4" /></div><Card className="px-4 py-3"><div className="flex gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" /><span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:120ms]" /><span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:240ms]" /></div></Card></div>
          )}
        </div>
      </div>

      <div className="border-t border-border p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntá sobre tu rodeo…"
            rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
            className="min-h-[44px] resize-none"
            autoFocus
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="lg"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}