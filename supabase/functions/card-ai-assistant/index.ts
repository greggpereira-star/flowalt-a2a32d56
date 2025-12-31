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
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    const body: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    };

    // Use tool calling for structured output
    if (type === "suggestions") {
      body.tools = [
        {
          type: "function",
          function: {
            name: "suggest_actions",
            description: "Retorna sugestões de próximas ações para o card",
            parameters: {
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
                    required: ["action", "priority", "reasoning"],
                    additionalProperties: false
                  }
                }
              },
              required: ["suggestions"],
              additionalProperties: false
            }
          }
        }
      ];
      body.tool_choice = { type: "function", function: { name: "suggest_actions" } };
    } else if (type === "checklist") {
      body.tools = [
        {
          type: "function",
          function: {
            name: "generate_checklist",
            description: "Gera itens de checklist para o card",
            parameters: {
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
                    required: ["title", "order"],
                    additionalProperties: false
                  }
                }
              },
              required: ["items"],
              additionalProperties: false
            }
          }
        }
      ];
      body.tool_choice = { type: "function", function: { name: "generate_checklist" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao seu workspace." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    let result;
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      result = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
    } else if (data.choices?.[0]?.message?.content) {
      result = { content: data.choices[0].message.content };
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
