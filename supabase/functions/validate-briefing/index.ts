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
  console.log("validate-briefing: Request received", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const briefingData = body.briefingData as BriefingData;
    
    console.log("validate-briefing: Briefing data received", JSON.stringify(briefingData).substring(0, 200));

    // Check required fields first
    const context = briefingData?.context?.trim() || "";
    const deliverables = briefingData?.deliverables?.trim() || "";

    if (!context || !deliverables) {
      console.log("validate-briefing: Required fields missing");
      return new Response(
        JSON.stringify({
          isValid: false,
          message: "Os campos obrigatórios (Contexto e Entregáveis) devem ser preenchidos.",
          issues: ["Contexto e Entregáveis são obrigatórios"]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper to truncate message to 200 chars
    const truncateMessage = (msg: string): string => {
      if (msg.length <= 200) return msg;
      return msg.substring(0, 197) + "...";
    };

    // Basic length validation
    if (context.length < 20 || deliverables.length < 20) {
      console.log("validate-briefing: Content too short");
      return new Response(
        JSON.stringify({
          isValid: false,
          message: truncateMessage("Campos obrigatórios devem ter pelo menos 20 caracteres."),
          issues: [
            context.length < 20 ? "Contexto muito curto" : null,
            deliverables.length < 20 ? "Entregáveis muito curto" : null
          ].filter(Boolean)
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for gibberish/placeholder text
    const gibberishPatterns = [
      /^[a-z]{1,5}$/i,           // Single short words
      /^[0-9]+$/,                 // Only numbers
      /^(.)\1{3,}$/,              // Repeated characters (aaaa, xxxx)
      /^(teste?|test|asdf|qwer|xxx|abc|123)$/i,  // Common test words
      /^(ok|sim|não|nao|yes|no)$/i,              // Too short responses
    ];

    const hasGibberish = gibberishPatterns.some(pattern => 
      pattern.test(context.trim()) || pattern.test(deliverables.trim())
    );

    if (hasGibberish) {
      console.log("validate-briefing: Gibberish detected");
      return new Response(
        JSON.stringify({
          isValid: false,
          message: "O briefing parece estar preenchido de forma inadequada.",
          issues: ["Conteúdo parece ser texto de teste ou sem sentido"],
          suggestions: [
            "Descreva o contexto real do projeto",
            "Liste os entregáveis específicos esperados"
          ]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try AI validation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.log("validate-briefing: No API key, using basic validation");
      // Fallback to basic validation if no API key
      return new Response(
        JSON.stringify({
          isValid: true,
          message: "Briefing validado com sucesso!",
          issues: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("validate-briefing: Calling AI for validation");

    // Use AI to validate content quality
    const systemPrompt = `Você é um assistente de validação de briefing de projetos. 
Sua tarefa é analisar se o briefing foi preenchido de forma adequada e com informações úteis, ou se foi preenchido de qualquer jeito apenas para liberar o card.

Critérios de REJEIÇÃO:
- Texto muito curto ou sem detalhes suficientes
- Texto sem sentido ou aleatório
- Respostas genéricas demais que não agregam informação
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

    try {
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

      console.log("validate-briefing: AI response status", response.status);

      if (!response.ok) {
        console.log("validate-briefing: AI error, using fallback validation");
        // Fallback to basic validation if AI fails
        return new Response(
          JSON.stringify({
            isValid: true,
            message: "Briefing validado com sucesso!",
            issues: []
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      
      console.log("validate-briefing: AI content received", content.substring(0, 200));

      // Extract JSON from response
      let validation;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          validation = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch {
        console.log("validate-briefing: Failed to parse AI response, approving");
        validation = {
          isValid: true,
          issues: [],
          suggestions: []
        };
      }

      const message = validation.isValid 
        ? "Briefing validado!"
        : validation.issues?.length > 0 
          ? truncateMessage(validation.issues.slice(0, 2).join(". "))
          : "Preencha com mais detalhes.";

      console.log("validate-briefing: Returning result", { isValid: validation.isValid });

      return new Response(
        JSON.stringify({
          isValid: validation.isValid,
          message: truncateMessage(message),
          issues: validation.issues || [],
          suggestions: validation.suggestions || []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (aiError) {
      console.error("validate-briefing: AI call failed", aiError);
      // Fallback to approve if AI fails
      return new Response(
        JSON.stringify({
          isValid: true,
          message: "Briefing validado com sucesso!",
          issues: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("validate-briefing: Error", error);
    return new Response(
      JSON.stringify({ 
        isValid: false, 
        message: "Erro ao validar briefing. Tente novamente.",
        issues: [String(error)]
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
