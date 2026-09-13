import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.32.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINANCE_ROLES = ["owner", "finance", "super_admin"];

type AnalysisType = "panorama" | "onde_cortar" | "riscos_caixa" | "bater_meta";

const ANALYSIS_LABELS: Record<AnalysisType, string> = {
  panorama: "Panorama",
  onde_cortar: "Onde cortar",
  riscos_caixa: "Riscos do caixa",
  bater_meta: "Bater a meta",
};

const ANALYSIS_INSTRUCTIONS: Record<AnalysisType, string> = {
  panorama:
    "Dê um panorama geral e objetivo da situação financeira: como estão receitas, despesas, saldo e margem no período, e se a tendência (fluxo mensal e projeção) é positiva, neutra ou preocupante.",
  onde_cortar:
    "Aponte, com base na quebra por categoria e por centro de custo, onde há maior oportunidade de corte de despesas. Seja específico sobre quais categorias/centros pesam mais e por quê, sem sugerir cortes em itens que já são pequenos.",
  riscos_caixa:
    "Avalie riscos de caixa: lançamentos vencidos, o que está em aberto (a pagar vs a receber), recorrências que pressionam o caixa, e o que a projeção de fluxo de caixa indica sobre os próximos meses.",
  bater_meta:
    "Com base no ponto de equilíbrio (receita necessária vs receita média atual e a margem desejada), explique o quanto falta para bater a meta e quais alavancas (aumentar receita, reduzir despesa) têm mais impacto, usando os números fornecidos.",
};

const SYSTEM_PROMPT_BASE = `Você é um analista financeiro que audita os números de um workspace de agência de marketing/criativa no Brasil.

Regras rígidas:
- Use APENAS os números fornecidos no JSON agregado abaixo. Nunca invente, estime ou infira um número que não esteja explicitamente nos dados.
- Se um dado necessário não estiver disponível, diga isso explicitamente em vez de adivinhar.
- Responda em português do Brasil, em prosa corrida (sem markdown pesado, sem tabelas), de forma direta e objetiva — no máximo 4-5 parágrafos curtos.
- Cite valores em Real (R$) no formato brasileiro (ex.: R$ 12.345,67) exatamente como aparecem no JSON.
- Não repita a pergunta nem descreva o que você vai fazer — vá direto à análise.`;

function createLogger(correlationId: string, workspaceId?: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "analyze-financial-panel",
      correlationId,
      workspaceId,
      message,
      ...context,
    }));
  };
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  };
}

interface AnalyzeRequest {
  workspace_id: string;
  analysis_type: AnalysisType;
  aggregated_data: Record<string, unknown>;
  filters_summary?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  let logger = createLogger(correlationId);

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      logger.error("ANTHROPIC_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Análise por IA não configurada (chave da Anthropic ausente)." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const requesterToken = authHeader.replace(/^Bearer\s+/i, "");
    const { data: requesterData, error: requesterError } = await supabase.auth.getUser(requesterToken);
    if (requesterError || !requesterData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const requesterId = requesterData.user.id;

    const { workspace_id, analysis_type, aggregated_data, filters_summary }: AnalyzeRequest = await req.json();
    logger = createLogger(correlationId, workspace_id);

    if (!workspace_id || !analysis_type || !aggregated_data) {
      return new Response(JSON.stringify({ error: "workspace_id, analysis_type e aggregated_data são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ANALYSIS_INSTRUCTIONS[analysis_type]) {
      return new Response(JSON.stringify({ error: "analysis_type inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só quem tem acesso financeiro pode gerar análise.
    const { data: requesterRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (!requesterRole || !FINANCE_ROLES.includes(requesterRole.role)) {
      logger.warn("Requester without finance access tried to run analysis", { requesterId });
      return new Response(JSON.stringify({ error: "Sem permissão para gerar análise financeira" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const generatedAt = new Date();

    const userPrompt = `${ANALYSIS_INSTRUCTIONS[analysis_type]}

Filtros aplicados no painel: ${filters_summary || "Nenhum filtro aplicado"}

Dados agregados (JSON):
${JSON.stringify(aggregated_data)}`;

    logger.info("Calling Anthropic for financial analysis", { analysisType: analysis_type });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT_BASE,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const analysisText = textBlock?.text || "";

    logger.info("Analysis generated", { analysisType: analysis_type, chars: analysisText.length });

    return new Response(
      JSON.stringify({
        analysis: analysisText,
        analysis_type,
        analysis_label: ANALYSIS_LABELS[analysis_type],
        generated_at: generatedAt.toISOString(),
        filters_summary: filters_summary || "Nenhum filtro aplicado",
        correlation_id: correlationId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Error generating financial analysis", { error: message });
    return new Response(JSON.stringify({ error: message, correlation_id: correlationId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
