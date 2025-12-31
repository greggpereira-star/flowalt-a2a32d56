import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BriefingData {
  context: string;
  target_audience: string;
  deliverables: string;
  references: string;
  deadline_notes: string;
  special_instructions: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefingData } = await req.json() as { briefingData: BriefingData };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check required fields first
    const context = briefingData.context?.trim() || "";
    const deliverables = briefingData.deliverables?.trim() || "";

    if (!context || !deliverables) {
      return new Response(
        JSON.stringify({
          isValid: false,
          message: "Os campos obrigatórios (Contexto e Entregáveis) devem ser preenchidos.",
          issues: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to validate content quality
    const systemPrompt = `Você é um assistente de validação de briefing de projetos. 
Sua tarefa é analisar se o briefing foi preenchido de forma adequada e com informações úteis, ou se foi preenchido de qualquer jeito apenas para liberar o card.

Critérios de REJEIÇÃO:
- Texto muito curto (menos de 20 caracteres em campos obrigatórios)
- Texto sem sentido ou aleatório (ex: "asdf", "xxx", "teste", "123", "aaaa")
- Respostas genéricas demais que não agregam informação (ex: "ok", "sim", "não sei")
- Conteúdo que parece cópia do placeholder/exemplo do campo
- Texto repetido ou sem contexto real do projeto

Critérios de APROVAÇÃO:
- Contexto claro sobre o que é o projeto
- Entregáveis específicos e mensuráveis
- Informações que permitam a execução do trabalho

Responda APENAS em JSON válido com esta estrutura:
{
  "isValid": boolean,
  "issues": ["lista de problemas encontrados, se houver"],
  "suggestions": ["sugestões de melhoria, se aplicável"]
}`;

    const userPrompt = `Analise este briefing de projeto:

CONTEXTO (obrigatório):
${context}

PÚBLICO-ALVO:
${briefingData.target_audience || "(não preenchido)"}

ENTREGÁVEIS (obrigatório):
${deliverables}

REFERÊNCIAS:
${briefingData.references || "(não preenchido)"}

O briefing está adequado para iniciar o trabalho?`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            isValid: true, 
            message: "Validação simplificada aplicada.",
            issues: [] 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            isValid: true, 
            message: "Validação simplificada aplicada.",
            issues: [] 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.error("AI gateway error:", response.status);
      // Fallback to simple validation if AI fails
      return new Response(
        JSON.stringify({
          isValid: context.length >= 20 && deliverables.length >= 20,
          message: context.length < 20 || deliverables.length < 20 
            ? "Os campos obrigatórios devem ter pelo menos 20 caracteres."
            : "Validação simplificada aplicada.",
          issues: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    let validation;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      // Fallback if JSON parsing fails
      validation = {
        isValid: context.length >= 20 && deliverables.length >= 20,
        issues: [],
        suggestions: []
      };
    }

    const message = validation.isValid 
      ? "Briefing validado com sucesso!"
      : validation.issues?.length > 0 
        ? validation.issues.join(" ") 
        : "O briefing precisa de mais detalhes para ser aprovado.";

    return new Response(
      JSON.stringify({
        isValid: validation.isValid,
        message,
        issues: validation.issues || [],
        suggestions: validation.suggestions || []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({ 
        isValid: false, 
        message: "Erro ao validar briefing. Tente novamente.",
        issues: [] 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
