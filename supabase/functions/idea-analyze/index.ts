import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Análise de criativo e geração de roteiros do Banco de Ideias.
 *
 *  mode "analyze": lê a transcrição (ou, na falta dela, a legenda) de uma referência e devolve a
 *                  estrutura, os gatilhos, o tom e o que vale replicar.
 *  mode "scripts": usa essa análise + o briefing do cliente escolhido para escrever roteiros novos
 *                  com a MESMA estrutura, sem copiar as frases do original.
 *
 * O modelo só gera texto para a equipe revisar; nada é executado nem publicado por ele. Roda com a
 * identidade de quem pediu (RLS), então só enxerga referências e clientes do próprio workspace.
 */

const MODELO = 'claude-sonnet-5-5';

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const FERRAMENTA_ANALISE = {
  name: 'registrar_analise',
  description: 'Registra a análise estruturada do criativo.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: { type: 'string', description: 'Do que o vídeo trata e qual é a promessa, em 1-2 frases.' },
      gancho: {
        type: 'object',
        properties: {
          trecho: { type: 'string', description: 'Trecho exato do início que prende a atenção.' },
          tipo: { type: 'string', description: 'Ex.: pergunta, afirmação polêmica, número, curiosidade, promessa, erro comum.' },
          por_que_funciona: { type: 'string' },
        },
        required: ['trecho', 'tipo', 'por_que_funciona'],
      },
      estrutura: {
        type: 'array',
        description: 'Etapas na ordem em que aparecem (Gancho, Problema, Virada, Prova, Passos, Oferta, CTA...).',
        items: {
          type: 'object',
          properties: {
            etapa: { type: 'string' },
            trecho: { type: 'string', description: 'Trecho ou paráfrase curta do que é dito nesta etapa.' },
            funcao: { type: 'string', description: 'O que esta etapa faz pelo espectador.' },
          },
          required: ['etapa', 'trecho', 'funcao'],
        },
      },
      gatilhos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string', description: 'Ex.: curiosidade, prova social, escassez, autoridade, medo de perder, identificação, reciprocidade.' },
            evidencia: { type: 'string', description: 'Onde aparece no texto.' },
          },
          required: ['nome', 'evidencia'],
        },
      },
      tom_e_ritmo: {
        type: 'object',
        properties: {
          tom: { type: 'string' },
          ritmo: { type: 'string' },
          linguagem: { type: 'string' },
        },
        required: ['tom', 'ritmo', 'linguagem'],
      },
      por_que_funciona: { type: 'array', items: { type: 'string' } },
      o_que_replicar: { type: 'array', items: { type: 'string' } },
      o_que_evitar: { type: 'array', items: { type: 'string' } },
      limitacoes: {
        type: 'string',
        description: 'O que NÃO foi possível avaliar (ex.: só havia a legenda, sem a fala; nada sobre imagem, música ou edição).',
      },
    },
    required: ['resumo', 'gancho', 'estrutura', 'gatilhos', 'tom_e_ritmo', 'por_que_funciona', 'o_que_replicar', 'o_que_evitar', 'limitacoes'],
  },
};

const FERRAMENTA_ROTEIROS = {
  name: 'registrar_roteiros',
  description: 'Registra os roteiros novos escritos para o cliente.',
  input_schema: {
    type: 'object',
    properties: {
      roteiros: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string' },
            abordagem: { type: 'string', description: 'Em uma frase, o ângulo deste roteiro e como ele se diferencia dos outros.' },
            gancho: { type: 'string', description: 'A fala de abertura (primeiros 3 segundos).' },
            cenas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tempo: { type: 'string', description: 'Ex.: 0-3s' },
                  fala: { type: 'string' },
                  visual: { type: 'string', description: 'O que aparece na tela / o que o criador faz.' },
                },
                required: ['tempo', 'fala', 'visual'],
              },
            },
            cta: { type: 'string' },
            legenda: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
            por_que_funciona_para_o_cliente: { type: 'string' },
          },
          required: ['titulo', 'abordagem', 'gancho', 'cenas', 'cta', 'legenda', 'hashtags', 'por_que_funciona_para_o_cliente'],
        },
      },
      lacunas_do_briefing: {
        type: 'array',
        items: { type: 'string' },
        description: 'Informações do cliente que faltaram e limitaram a qualidade dos roteiros.',
      },
    },
    required: ['roteiros', 'lacunas_do_briefing'],
  },
};

async function chamarClaude(sistema: string, usuario: string, ferramenta: { name: string; input_schema: unknown; description: string }, maxTokens: number) {
  const chave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!chave) throw new Error('Chave da IA não configurada no servidor.');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens,
      system: sistema,
      tools: [ferramenta],
      tool_choice: { type: 'tool', name: ferramenta.name },
      messages: [{ role: 'user', content: usuario }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) throw new Error(`A IA respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const bloco = (d.content ?? []).find((b: any) => b.type === 'tool_use');
  if (!bloco) throw new Error('A IA não devolveu o resultado no formato esperado.');
  return bloco.input;
}

function textoDaReferencia(ref: any): { texto: string; temFala: boolean } {
  const partes: string[] = [];
  if (ref.platform) partes.push(`Plataforma: ${ref.platform}`);
  if (ref.author_name) partes.push(`Criador: ${ref.author_name}`);
  if (ref.title) partes.push(`Título/legenda: ${ref.title}`);
  if (ref.description) partes.push(`Descrição: ${ref.description}`);
  if (ref.tags?.length) partes.push(`Tags: ${ref.tags.join(', ')}`);
  const temFala = !!ref.transcript?.trim();
  if (temFala) partes.push(`\nTRANSCRIÇÃO DA FALA:\n${ref.transcript.trim()}`);
  return { texto: partes.join('\n'), temFala };
}

const SISTEMA_ANALISE = `Você é um estrategista de conteúdo e copywriter sênior de uma agência de marketing brasileira.
Analise o criativo recebido e registre a análise pela ferramenta. Regras:
- Responda em português do Brasil.
- Baseie-se SOMENTE no que foi fornecido. Cite trechos reais da transcrição quando existir.
- Se houver apenas legenda/título (sem a fala), diga isso em "limitacoes" e não invente o conteúdo do vídeo.
- Não avalie imagem, edição ou música: você não as viu. Se for relevante, registre em "limitacoes".
- Seja específico e útil para quem vai criar um roteiro parecido, não genérico.`;

const SISTEMA_ROTEIROS = `Você é um roteirista de vídeos curtos e copywriter sênior de uma agência de marketing brasileira.
Escreva roteiros NOVOS para o cliente descrito, reaproveitando a ESTRUTURA e os gatilhos da análise de um criativo de referência. Regras:
- Responda em português do Brasil, no tom e vocabulário do cliente.
- Reaproveite a estrutura (ordem das etapas, tipo de gancho, ritmo), NUNCA as frases do original: nenhuma frase do criativo de referência pode ser copiada.
- Use somente fatos do briefing do cliente. Não invente números, resultados, depoimentos, preços ou promessas que não estejam no briefing; quando precisar de um dado que falta, escreva entre colchetes, por exemplo [inserir resultado real].
- Respeite as restrições de linguagem do cliente, se houver.
- Cada roteiro deve ter uma abordagem diferente dos demais, mantendo a mesma estrutura de base.
- Se faltarem informações do briefing que limitam a qualidade, liste em "lacunas_do_briefing".`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Não autenticado' }, 401);

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return json({ error: 'Sessão inválida' }, 401);

    const { mode, reference_id, client_id, options } = await req.json();
    if (!reference_id || !['analyze', 'scripts'].includes(mode)) return json({ error: 'Pedido inválido' }, 400);

    const { data: ref, error: erroRef } = await supa.from('idea_references').select('*').eq('id', reference_id).maybeSingle();
    if (erroRef || !ref) return json({ error: 'Referência não encontrada' }, 404);

    const { texto, temFala } = textoDaReferencia(ref);
    if (!temFala && !ref.title && !ref.description) {
      return json({ error: 'Não há texto para analisar. Cole a transcrição ou envie o arquivo de vídeo para transcrever.' }, 400);
    }

    // ---------- Análise ----------
    let analise = ref.analysis;
    if (mode === 'analyze' || !analise) {
      analise = await chamarClaude(
        SISTEMA_ANALISE,
        `Criativo de referência:\n\n${texto}`,
        FERRAMENTA_ANALISE,
        4000,
      );
      const { error } = await supa
        .from('idea_references')
        .update({ analysis: analise, analysis_at: new Date().toISOString(), review_status: ref.review_status === 'para_analisar' ? 'analisado' : ref.review_status })
        .eq('id', ref.id);
      if (error) throw new Error(`Não consegui salvar a análise: ${error.message}`);
      if (mode === 'analyze') return json({ analysis: analise });
    }

    // ---------- Roteiros ----------
    if (!client_id) return json({ error: 'Escolha o cliente para gerar os roteiros.' }, 400);
    const { data: cli, error: erroCli } = await supa.from('client_cards').select('*').eq('id', client_id).maybeSingle();
    if (erroCli || !cli) return json({ error: 'Cliente não encontrado' }, 404);

    const quantidade = Math.min(Math.max(Number(options?.quantidade) || 3, 1), 5);
    const duracao = Math.min(Math.max(Number(options?.duracao_segundos) || 30, 10), 120);
    const campo = (rotulo: string, v: unknown) => {
      const t = Array.isArray(v) ? v.join(', ') : (v ?? '').toString().trim();
      return t ? `${rotulo}: ${t}` : null;
    };
    const briefing = [
      campo('Nome', cli.name),
      campo('Segmento', cli.segment),
      campo('Sobre o cliente', cli.about_client),
      campo('Produtos e serviços', cli.products_services),
      campo('Público-alvo', cli.target_audience),
      campo('Objetivos', cli.objectives),
      campo('Desafios', cli.challenges),
      campo('Concorrentes', cli.competitors),
      campo('Posicionamento', cli.positioning),
      campo('Personalidade da marca', cli.personality),
      campo('Essência da marca', cli.brand_essence),
      campo('Tom de relacionamento', cli.relationship_tone),
      campo('Estilo de linguagem', cli.language_style),
      campo('Palavras-chave', cli.keywords),
      campo('Restrições de linguagem (NÃO usar)', cli.language_restrictions),
    ].filter(Boolean).join('\n');

    const pedido = [
      `BRIEFING DO CLIENTE:\n${briefing}`,
      `\nANÁLISE DO CRIATIVO DE REFERÊNCIA:\n${JSON.stringify(analise, null, 2)}`,
      `\nPEDIDO:\n- Quantidade de roteiros: ${quantidade}\n- Duração alvo: ${duracao} segundos`,
      options?.objetivo ? `- Objetivo do vídeo: ${options.objetivo}` : null,
      options?.formato ? `- Formato/plataforma: ${options.formato}` : null,
      options?.instrucoes ? `- Instruções extras da equipe: ${options.instrucoes}` : null,
    ].filter(Boolean).join('\n');

    const resultado = await chamarClaude(SISTEMA_ROTEIROS, pedido, FERRAMENTA_ROTEIROS, 8000);
    const roteiros = (resultado.roteiros ?? []) as any[];
    if (roteiros.length === 0) throw new Error('A IA não gerou roteiros.');

    const linhas = roteiros.map((r) => ({
      workspace_id: ref.workspace_id,
      reference_id: ref.id,
      client_id: cli.id,
      title: String(r.titulo ?? 'Roteiro').slice(0, 200),
      content: r,
      options: { quantidade, duracao_segundos: duracao, objetivo: options?.objetivo ?? null, formato: options?.formato ?? null, instrucoes: options?.instrucoes ?? null },
      created_by: u.user.id,
    }));
    const { data: salvos, error: erroSalvar } = await supa.from('idea_scripts').insert(linhas).select();
    if (erroSalvar) throw new Error(`Não consegui salvar os roteiros: ${erroSalvar.message}`);

    return json({ scripts: salvos, lacunas_do_briefing: resultado.lacunas_do_briefing ?? [] });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
