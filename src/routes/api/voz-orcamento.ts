import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";

const MATERIAIS = [
  'tubo_cobre_14: Tubo de cobre 1/4" (m)',
  'tubo_cobre_38: Tubo de cobre 3/8" (m)',
  'tubo_cobre_12: Tubo de cobre 1/2" (m)',
  'tubo_cobre_58: Tubo de cobre 5/8" (m)',
  "isolamento_termico: Isolamento térmico (m)",
  "cabo_eletrico: Cabo elétrico (m)",
  "cabo_pp: Cabo PP (m)",
  "suporte_condensadora: Suporte para condensadora (par)",
  "suporte_reforcado: Suporte reforçado (par)",
  "buchas_parafusos: Buchas e parafusos (un)",
  "dreno: Dreno (m)",
  "mangueira_dreno: Mangueira para dreno (m)",
  "fita_pvc: Fita PVC (un)",
  "fita_isolamento: Fita de isolamento (un)",
  "fita_aluminizada: Fita aluminizada (un)",
  "canaleta: Canaleta (m)",
  "conector_eletrico: Conector elétrico (un)",
  "disjuntor: Disjuntor (un)",
  "tomada: Tomada (un)",
  "plugue: Plugue (un)",
  "gas_refrigerante: Fluido refrigerante / gás (kg)",
  "valvula_registro: Válvula / registro (un)",
  "filtro: Filtro (un)",
  "capacitor: Capacitor (un)",
  "sensor: Sensor (un)",
  "rele: Relé (un)",
  "contator: Contator (un)",
  "helice: Hélice (un)",
  "motor_ventilador: Motor (un)",
  "placa_eletronica: Placa eletrônica (un)",
].join("\n");

const SYSTEM = `Você extrai dados de orçamentos de climatização a partir da fala de um técnico brasileiro.
Responda SOMENTE com um JSON válido (sem markdown, sem comentários) neste formato:

{
  "cliente": { "nome": "", "telefone": "", "endereco": "" },
  "servico": {
    "tipoServico": "",
    "tipoEquipamento": "",
    "capacidade": "",
    "ambiente": "",
    "tipoInstalacao": "",
    "quantidade": 1,
    "marca": "",
    "modelo": ""
  },
  "materiais": [ { "key": "", "nome": "", "quantidade": 0, "unidade": "" } ],
  "servicos": [ { "nome": "", "descricao": "", "valor": 0 } ],
  "camposIncertos": [ "" ],
  "resumo": ""
}

REGRAS CRÍTICAS:
- NUNCA invente dados. Se algo não foi dito, use "" (ou omita o item) e adicione o rótulo do campo em "camposIncertos".
- "tipoServico" deve ser um destes, quando aplicável: Instalação de Split, Instalação de Split Inverter, Instalação de Multi Split, Instalação de Ar de Janela, Manutenção Preventiva, Manutenção Corretiva, Higienização / Limpeza, Recarga de Gás, Desinstalação, Desinstalação + Reinstalação, Reparo de Vazamento, Troca de Peças.
- "tipoEquipamento": Split Hi Wall, Split Inverter, Multi Split, Janela, Cassete, Piso-Teto, Portátil, Ar Condicionado Central.
- "capacidade": formato "12.000 BTUs" (7.000, 9.000, 12.000, 18.000, 22.000, 24.000, 30.000, 36.000, 48.000, 60.000).
- "ambiente": Quarto, Sala, Cozinha, Escritório, Loja, Sala Comercial, Galpão, Restaurante, Outro.
- "tipoInstalacao": Parede, Teto, Embutido, Aparente, Com infraestrutura pronta, Sem infraestrutura.
- Materiais devem usar preferencialmente uma destas chaves (key) do catálogo do app:
${MATERIAIS}
  Se o material falado não existir na lista, use key "custom" e preencha "nome" com o que foi dito.
- Valores monetários por extenso ("trezentos e cinquenta reais") devem virar número (350).
- Mão de obra e serviços falados vão em "servicos" com "valor" numérico. A descrição deve resumir o que foi dito (obrigatória).
- Telefone: só preencha se números de telefone forem falados.
- "camposIncertos": use rótulos amigáveis em português (ex.: "Telefone do cliente", "Endereço do serviço", "Metros de tubo de cobre") e liste apenas informações realmente relevantes que faltaram para este orçamento. Se nada essencial faltar, devolva lista vazia.
- "resumo": uma frase curta descrevendo o serviço.`;

export const Route = createFileRoute("/api/voz-orcamento")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let audio: File | null = null;
        try {
          const form = await request.formData();
          const f = form.get("audio");
          if (f instanceof File) audio = f;
        } catch {
          return new Response("Áudio inválido", { status: 400 });
        }
        if (!audio || audio.size < 2048) {
          return new Response("Áudio vazio ou muito curto", { status: 400 });
        }
        if (audio.size > 20 * 1024 * 1024) {
          return new Response("Áudio muito longo", { status: 413 });
        }

        // 1) Transcrição
        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", audio, "gravacao.wav");
        upstream.append("language", "pt");

        const tr = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });
        if (!tr.ok) {
          const body = await tr.text().catch(() => "");
          console.error(`Transcrição falhou [${tr.status}]: ${body}`);
          return new Response(body || "Falha na transcrição", { status: tr.status });
        }
        const trJson = (await tr.json()) as { text?: string };
        const transcript = (trJson.text || "").trim();
        if (!transcript) {
          return new Response("Não conseguimos entender o áudio.", { status: 422 });
        }

        // 2) Interpretação
        const gateway = createLovableAiGatewayProvider(key);
        const { text } = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM,
          prompt: `Fala do técnico:\n"""${transcript}"""`,
        });

        const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        let dados: unknown;
        try {
          dados = JSON.parse(cleaned);
        } catch {
          const m = cleaned.match(/\{[\s\S]*\}/);
          if (!m) {
            return new Response("Não conseguimos interpretar o áudio.", { status: 422 });
          }
          try {
            dados = JSON.parse(m[0]);
          } catch {
            return new Response("Não conseguimos interpretar o áudio.", { status: 422 });
          }
        }

        return new Response(JSON.stringify({ transcript, dados }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
