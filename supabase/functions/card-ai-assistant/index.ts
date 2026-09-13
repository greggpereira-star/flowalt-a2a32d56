import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CardContext {
  title: string;
  description?: string;
  status: string;
  urgency: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  briefingCompleted?: boolean;
  checklistProgress?: { completed: number; total: number };
  isBlocked?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, cardContext } = await req.json() as { 
      type: 'suggestions' | 'checklist' | 'description'; 
      cardContext: CardContext;
    };
    
    // Migrado do gateway da Lovable (ai.gateway.lovable.dev) para a Anthropic:
    // a LOVABLE_API_KEY não existe mais neste ambiente e o gateway pertencia à
    // plataforma de onde o projeto saiu, então esta função estava 100% morta —
    // falhava logo na primeira linha. Usa a mesma chave já configurada para a
    // Análise por IA do Painel Executivo.
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Assistente de IA não configurado (chave da Anthropic ausente)." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "suggestions") {
      systemPrompt = `Você é um assistente de gerenciamento de projetos especializado em agências de comunicação e marketing.
Analise o contexto do card e sugira próximas ações práticas e específicas.
Seja conciso e objetivo. Responda em português brasileiro.`;
      
      userPrompt = `Analise este card e sugira 3-5 próximas ações prioritárias:

Título: ${cardContext.title}
${cardContext.description ? `Descrição: ${cardContext.description}` : ''}
Status: ${cardContext.status}
Urgência: ${cardContext.urgency}
${cardContext.dueDate ? `Prazo: ${cardContext.dueDate}` : 'Sem prazo definido'}
${cardContext.estimatedHours ? `Horas estimadas: ${cardContext.estimatedHours}h` : ''}
${cardContext.actualHours ? `Horas trabalhadas: ${cardContext.actualHours}h` : ''}
Briefing: ${cardContext.briefingCompleted ? 'Completo' : 'Pendente'}
${cardContext.checklistProgress ? `Checklist: ${cardContext.checklistProgress.completed}/${cardContext.checklistProgress.total} itens` : ''}
${cardContext.isBlocked ? 'ATENÇÃO: Card está bloqueado por dependência' : ''}`;
    } else if (type === "checklist") {
      systemPrompt = `Você é um especialista em gerenciamento de projetos de marketing e comunicação.
Crie checklists práticos e detalhados baseados no contexto do card.
Cada item deve ser acionável e específico. Responda em português brasileiro.`;
      
      userPrompt = `Crie um checklist detalhado para este card:

Título: ${cardContext.title}
${cardContext.description ? `Descrição: ${cardContext.description}` : ''}
Urgência: ${cardContext.urgency}

Liste 5-10 itens de checklist específicos e acionáveis.`;
    } else if (type === "description") {
      systemPrompt = `Você é um especialista em briefings de projetos de marketing e comunicação.
Ajude a estruturar descrições claras e completas para cards de projeto.
Responda em português brasileiro.`;
      
      userPrompt = `Expanda e melhore a descrição deste card:

Título: ${cardContext.title}
${cardContext.description ? `Descrição atual: ${cardContext.description}` : 'Sem descrição'}

Sugira uma descrição mais completa e estruturada, incluindo objetivo, escopo e entregáveis.`;
    }

    // Formato da Messages API da Anthropic: o system prompt é um campo próprio,
    // não uma mensagem com role "system".
    const body: Record<string, unknown> = {
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt }
      ],
    };

    // Tool calling para saída estruturada. A Anthropic usa `input_schema` no
    // lugar de `function.parameters`, e o tool_choice é { type: "tool", name }.
    if (type === "suggestions") {
      body.tools = [
        {
          name: "suggest_actions",
          description: "Retorna sugestões de próximas ações para o card",
          input_schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    action: { type: "string", description: "Ação sugerida" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    reasoning: { type: "string", description: "Justificativa curta" }
                  },
                  required: ["action", "priority", "reasoning"]
                }
              }
            },
            required: ["suggestions"]
          }
        }
      ];
      body.tool_choice = { type: "tool", name: "suggest_actions" };
    } else if (type === "checklist") {
      body.tools = [
        {
          name: "generate_checklist",
          description: "Gera itens de checklist para o card",
          input_schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Título do item" },
                    order: { type: "number", description: "Ordem do item" }
                  },
                  required: ["title", "order"]
                }
              }
            },
            required: ["items"]
          }
        }
      ];
      body.tool_choice = { type: "tool", name: "generate_checklist" };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();

      // A Anthropic sinaliza saldo insuficiente com 400 + "credit balance",
      // não com 402 como fazia o gateway anterior. Sem este tratamento o
      // usuário veria um "Erro ao processar com IA" genérico para o que é, na
      // verdade, uma questão de faturamento da conta.
      if (response.status === 402 || errorText.includes("credit balance")) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na conta da Anthropic." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("Anthropic API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Na Anthropic a resposta é uma lista de blocos: o resultado estruturado
    // vem num bloco `tool_use` (já como objeto, sem precisar de JSON.parse) e o
    // texto livre num bloco `text`.
    let result;
    const toolUse = data.content?.find((b: { type: string }) => b.type === "tool_use");
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

    if (toolUse?.input) {
      result = toolUse.input;
    } else if (textBlock?.text) {
      result = { content: textBlock.text };
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("card-ai-assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
