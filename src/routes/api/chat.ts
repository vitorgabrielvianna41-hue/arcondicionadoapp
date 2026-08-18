import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `Você é a IA Climatização, assistente especializada em ar-condicionado e climatização para instaladores e técnicos autônomos brasileiros.
Responda de forma direta, prática e objetiva, em português do Brasil.
Use valores em reais (R$) quando estimar custos ou preços.
Foque em: instalação de split, split inverter, multi split, janela, cassete e piso-teto; manutenção preventiva e corretiva;
higienização e limpeza; recarga de gás (R-410A, R-32, R-22); diagnóstico de falhas (não gela, vazamento, ruído, dreno entupido, erro de placa);
dimensionamento de BTUs por ambiente; materiais (tubo de cobre 1/4", 3/8", 1/2", 5/8", isolamento térmico, cabo PP, suportes, dreno, gás,
capacitor, contator, placa eletrônica); precificação de serviços; textos e mensagens profissionais para enviar ao cliente pelo WhatsApp.
Quando der valores, deixe claro que são estimativas que variam por região e por complexidade do serviço.
Priorize segurança elétrica e boas práticas de refrigeração em toda resposta. Use listas curtas e títulos quando ajudar a clareza.`;


type ChatBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});