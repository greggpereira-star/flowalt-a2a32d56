import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccountMetrics {
  asset_id: string;
  asset_name: string;
  followers: number;
  page_reach: number;
  page_impressions: number;
  page_engagements: number;
  accounts_engaged: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  follows: number;
  unfollows: number;
  posts_count: number;
}

interface PostMetrics {
  id: string;
  caption: string;
  content_type: string;
  published_at: string;
  metrics: Record<string, any>;
  hashtags: string[];
  content_pillar: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { workspace_id, asset_id, analysis_type = 'full' } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating AI insights for workspace ${workspace_id}, asset: ${asset_id || 'all'}`);

    // Fetch account metrics
    const { data: platforms } = await supabase
      .from('social_platforms')
      .select('id, platform, account_name, account_metrics, account_metrics_updated_at')
      .eq('workspace_id', workspace_id)
      .eq('connection_status', 'connected');

    if (!platforms || platforms.length === 0) {
      return new Response(JSON.stringify({ 
        insights: [],
        message: 'Nenhuma plataforma conectada encontrada'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract all asset metrics
    const allAssetMetrics: AccountMetrics[] = [];
    
    for (const platform of platforms) {
      if (!platform.account_metrics) continue;
      
      for (const [key, metrics] of Object.entries(platform.account_metrics as Record<string, any>)) {
        if (asset_id && metrics.asset_id !== asset_id) continue;
        
        allAssetMetrics.push({
          asset_id: metrics.asset_id,
          asset_name: metrics.asset_name || 'Unknown',
          followers: metrics.followers || 0,
          page_reach: metrics.page_reach || 0,
          page_impressions: metrics.page_impressions || 0,
          page_engagements: metrics.page_engagements || 0,
          accounts_engaged: metrics.accounts_engaged || 0,
          likes_count: metrics.likes_count || 0,
          comments_count: metrics.comments_count || 0,
          shares_count: metrics.shares_count || 0,
          follows: metrics.follows || 0,
          unfollows: metrics.unfollows || 0,
          posts_count: metrics.posts_count || 0,
        });
      }
    }

    if (allAssetMetrics.length === 0) {
      return new Response(JSON.stringify({ 
        insights: [],
        message: 'Nenhuma métrica encontrada para análise'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent published posts with metrics
    const { data: posts } = await supabase
      .from('social_posts')
      .select('id, caption, content_type, published_at, metrics, hashtags, content_pillar')
      .eq('workspace_id', workspace_id)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(50);

    // Build comprehensive data context for AI
    const dataContext = buildDataContext(allAssetMetrics, posts || []);

    // Generate insights using Lovable AI
    const insights = await generateAIInsights(lovableApiKey, dataContext, analysis_type);

    return new Response(JSON.stringify({
      success: true,
      insights,
      metrics_summary: dataContext.summary,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating AI insights:', error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      insights: [] 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildDataContext(metrics: AccountMetrics[], posts: any[]) {
  // Calculate aggregated stats
  const totalFollowers = metrics.reduce((sum, m) => sum + m.followers, 0);
  const totalReach = metrics.reduce((sum, m) => sum + m.page_reach, 0);
  const totalImpressions = metrics.reduce((sum, m) => sum + m.page_impressions, 0);
  const totalEngagements = metrics.reduce((sum, m) => sum + m.page_engagements, 0);
  const totalLikes = metrics.reduce((sum, m) => sum + m.likes_count, 0);
  const totalComments = metrics.reduce((sum, m) => sum + m.comments_count, 0);
  const totalShares = metrics.reduce((sum, m) => sum + m.shares_count, 0);
  const totalFollows = metrics.reduce((sum, m) => sum + m.follows, 0);
  const totalUnfollows = metrics.reduce((sum, m) => sum + m.unfollows, 0);
  
  // Calculate rates
  const engagementRate = totalFollowers > 0 
    ? ((totalLikes + totalComments + totalShares) / totalFollowers * 100).toFixed(2)
    : '0';
  
  const reachRate = totalFollowers > 0 
    ? (totalReach / totalFollowers * 100).toFixed(2) 
    : '0';

  const netGrowth = totalFollows - totalUnfollows;
  const growthRate = totalFollowers > 0 
    ? (netGrowth / totalFollowers * 100).toFixed(3) 
    : '0';

  // Analyze posts by content type
  const contentTypeAnalysis: Record<string, { count: number; totalEngagement: number }> = {};
  
  for (const post of posts) {
    const type = post.content_type || 'post';
    if (!contentTypeAnalysis[type]) {
      contentTypeAnalysis[type] = { count: 0, totalEngagement: 0 };
    }
    contentTypeAnalysis[type].count++;
    
    const postMetrics = post.metrics || {};
    const engagement = (postMetrics.likes || 0) + (postMetrics.comments || 0) + (postMetrics.shares || 0);
    contentTypeAnalysis[type].totalEngagement += engagement;
  }

  // Find top performing content types
  const contentTypePerformance = Object.entries(contentTypeAnalysis)
    .map(([type, data]) => ({
      type,
      count: data.count,
      avgEngagement: data.count > 0 ? Math.round(data.totalEngagement / data.count) : 0,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Analyze posting patterns
  const postsByDayOfWeek: Record<string, number> = {};
  const postsByHour: Record<number, number> = {};
  
  for (const post of posts) {
    if (post.published_at) {
      const date = new Date(post.published_at);
      const day = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
      const hour = date.getHours();
      
      postsByDayOfWeek[day] = (postsByDayOfWeek[day] || 0) + 1;
      postsByHour[hour] = (postsByHour[hour] || 0) + 1;
    }
  }

  return {
    summary: {
      totalFollowers,
      totalReach,
      totalImpressions,
      totalEngagements,
      totalLikes,
      totalComments,
      totalShares,
      totalFollows,
      totalUnfollows,
      netGrowth,
      engagementRate: parseFloat(engagementRate),
      reachRate: parseFloat(reachRate),
      growthRate: parseFloat(growthRate),
      postsAnalyzed: posts.length,
      accountsAnalyzed: metrics.length,
    },
    accounts: metrics.map(m => ({
      name: m.asset_name,
      followers: m.followers,
      reach: m.page_reach,
      impressions: m.page_impressions,
      engagements: m.page_engagements,
      follows: m.follows,
      unfollows: m.unfollows,
    })),
    contentTypePerformance,
    postsByDayOfWeek,
    postsByHour,
    recentPosts: posts.slice(0, 10).map(p => ({
      type: p.content_type,
      caption: p.caption?.substring(0, 100),
      metrics: p.metrics,
      hashtags: p.hashtags,
      published_at: p.published_at,
    })),
  };
}

async function generateAIInsights(apiKey: string | undefined, dataContext: any, analysisType: string) {
  const systemPrompt = `Você é um Social Media Growth Expert de nível Sênior, Estatístico Sênior e Cientista de Dados Sênior especializado em análise de redes sociais.

Sua missão é analisar métricas REAIS e gerar insights ACIONÁVEIS baseados em DADOS, não em achismos.

DIRETRIZES:
1. SEMPRE cite números específicos dos dados fornecidos
2. Calcule taxas, percentuais e comparações
3. Identifique padrões estatísticos
4. Dê recomendações específicas e mensuráveis
5. Priorize insights por impacto potencial
6. Use linguagem profissional mas acessível em Português BR

FORMATO DE RESPOSTA (JSON):
{
  "executive_summary": "Resumo executivo em 2-3 frases",
  "growth_analysis": {
    "status": "growing|stable|declining",
    "rate": "taxa percentual",
    "interpretation": "análise detalhada"
  },
  "engagement_analysis": {
    "status": "excellent|good|needs_improvement|critical",
    "rate": "taxa percentual",
    "benchmark_comparison": "comparação com benchmarks do setor",
    "interpretation": "análise detalhada"
  },
  "reach_analysis": {
    "reach_rate": "taxa percentual",
    "interpretation": "análise da taxa de alcance"
  },
  "content_insights": [
    {
      "insight": "descoberta sobre conteúdo",
      "data_point": "dado que suporta",
      "recommendation": "ação recomendada"
    }
  ],
  "opportunities": [
    {
      "title": "título da oportunidade",
      "description": "descrição detalhada",
      "potential_impact": "high|medium|low",
      "action_items": ["ação 1", "ação 2"]
    }
  ],
  "warnings": [
    {
      "title": "título do alerta",
      "severity": "high|medium|low",
      "description": "descrição do problema",
      "recommendation": "como resolver"
    }
  ],
  "next_steps": [
    "ação prioritária 1",
    "ação prioritária 2",
    "ação prioritária 3"
  ]
}`;

  const userPrompt = `Analise os seguintes dados REAIS de uma ou mais contas de Instagram e gere insights profundos:

## MÉTRICAS AGREGADAS (últimos 28 dias)
- Total de Seguidores: ${dataContext.summary.totalFollowers.toLocaleString()}
- Alcance Total: ${dataContext.summary.totalReach.toLocaleString()}
- Impressões Totais: ${dataContext.summary.totalImpressions.toLocaleString()}
- Engajamentos Totais: ${dataContext.summary.totalEngagements.toLocaleString()}
- Curtidas: ${dataContext.summary.totalLikes.toLocaleString()}
- Comentários: ${dataContext.summary.totalComments.toLocaleString()}
- Compartilhamentos: ${dataContext.summary.totalShares.toLocaleString()}
- Novos Seguidores: ${dataContext.summary.totalFollows.toLocaleString()}
- Unfollows: ${dataContext.summary.totalUnfollows.toLocaleString()}
- Crescimento Líquido: ${dataContext.summary.netGrowth.toLocaleString()}
- Taxa de Engajamento: ${dataContext.summary.engagementRate}%
- Taxa de Alcance: ${dataContext.summary.reachRate}%
- Taxa de Crescimento: ${dataContext.summary.growthRate}%

## DETALHES POR CONTA
${dataContext.accounts.map((a: any) => `
### ${a.name}
- Seguidores: ${a.followers.toLocaleString()}
- Alcance: ${a.reach.toLocaleString()}
- Impressões: ${a.impressions.toLocaleString()}
- Engajamentos: ${a.engagements.toLocaleString()}
- Novos Seguidores: ${a.follows} | Unfollows: ${a.unfollows}
`).join('')}

## PERFORMANCE POR TIPO DE CONTEÚDO
${dataContext.contentTypePerformance.map((c: any) => `- ${c.type}: ${c.count} posts, média de ${c.avgEngagement} engajamentos`).join('\n')}

## PADRÕES DE PUBLICAÇÃO
Por dia da semana: ${JSON.stringify(dataContext.postsByDayOfWeek)}
Por hora: ${JSON.stringify(dataContext.postsByHour)}

## POSTS RECENTES
${dataContext.recentPosts.length} posts analisados

BENCHMARKS DE REFERÊNCIA:
- Taxa de engajamento boa no Instagram: 1-3%
- Taxa de engajamento excelente: >3%
- Taxa de alcance saudável: 20-40% dos seguidores
- Crescimento mensal saudável: 1-3%

Gere uma análise completa e profunda em formato JSON conforme especificado.`;

  if (!apiKey) {
    // Fallback to rule-based insights if no API key
    return generateRuleBasedInsights(dataContext);
  }

  try {
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      return generateRuleBasedInsights(dataContext);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return generateRuleBasedInsights(dataContext);
    }

    // Parse JSON from response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                        content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      return {
        executive_summary: content.substring(0, 500),
        raw_response: content,
      };
    }

  } catch (error) {
    console.error('AI API call failed:', error);
    return generateRuleBasedInsights(dataContext);
  }
}

function generateRuleBasedInsights(dataContext: any) {
  const { summary } = dataContext;
  
  const insights: any = {
    executive_summary: '',
    growth_analysis: { status: 'stable', rate: '0%', interpretation: '' },
    engagement_analysis: { status: 'needs_improvement', rate: '0%', interpretation: '' },
    reach_analysis: { reach_rate: '0%', interpretation: '' },
    content_insights: [],
    opportunities: [],
    warnings: [],
    next_steps: [],
  };

  // Growth analysis
  if (summary.netGrowth > 0) {
    insights.growth_analysis = {
      status: 'growing',
      rate: `+${summary.growthRate}%`,
      interpretation: `A conta está em crescimento com ${summary.totalFollows} novos seguidores e ${summary.totalUnfollows} unfollows, resultando em um ganho líquido de ${summary.netGrowth} seguidores.`,
    };
  } else if (summary.netGrowth < 0) {
    insights.growth_analysis = {
      status: 'declining',
      rate: `${summary.growthRate}%`,
      interpretation: `A conta está perdendo seguidores. ${summary.totalUnfollows} unfollows contra ${summary.totalFollows} novos seguidores resultam em uma perda de ${Math.abs(summary.netGrowth)} seguidores.`,
    };
    insights.warnings.push({
      title: 'Perda de Seguidores',
      severity: 'high',
      description: `A conta está perdendo mais seguidores do que ganhando.`,
      recommendation: 'Revise a estratégia de conteúdo e frequência de publicação.',
    });
  }

  // Engagement analysis
  const engRate = summary.engagementRate;
  if (engRate >= 3) {
    insights.engagement_analysis = {
      status: 'excellent',
      rate: `${engRate}%`,
      benchmark_comparison: 'Acima da média do mercado (1-3%)',
      interpretation: `Excelente taxa de engajamento! O conteúdo está ressoando muito bem com a audiência.`,
    };
  } else if (engRate >= 1) {
    insights.engagement_analysis = {
      status: 'good',
      rate: `${engRate}%`,
      benchmark_comparison: 'Dentro da média do mercado (1-3%)',
      interpretation: `Taxa de engajamento saudável. Há espaço para melhorias através de conteúdo mais interativo.`,
    };
  } else {
    insights.engagement_analysis = {
      status: 'needs_improvement',
      rate: `${engRate}%`,
      benchmark_comparison: 'Abaixo da média do mercado (1-3%)',
      interpretation: `Taxa de engajamento baixa. Considere revisar o tipo de conteúdo e horários de publicação.`,
    };
    insights.warnings.push({
      title: 'Engajamento Baixo',
      severity: 'medium',
      description: `A taxa de engajamento de ${engRate}% está abaixo do benchmark de 1%.`,
      recommendation: 'Teste diferentes formatos (Reels, Carrosséis) e CTAs mais fortes.',
    });
  }

  // Reach analysis
  insights.reach_analysis = {
    reach_rate: `${summary.reachRate}%`,
    interpretation: summary.reachRate >= 20 
      ? `Bom alcance! ${summary.reachRate}% dos seguidores estão sendo alcançados.`
      : `Alcance pode melhorar. Apenas ${summary.reachRate}% dos seguidores estão sendo alcançados.`,
  };

  // Content insights from performance data
  if (dataContext.contentTypePerformance.length > 0) {
    const best = dataContext.contentTypePerformance[0];
    insights.content_insights.push({
      insight: `Melhor tipo de conteúdo: ${best.type}`,
      data_point: `Média de ${best.avgEngagement} engajamentos em ${best.count} posts`,
      recommendation: `Aumente a produção de ${best.type} para maximizar engajamento.`,
    });
  }

  // Opportunities
  if (summary.totalShares < summary.totalLikes * 0.1) {
    insights.opportunities.push({
      title: 'Aumentar Compartilhamentos',
      description: 'A taxa de compartilhamento está baixa em relação às curtidas. Conteúdo compartilhável aumenta alcance orgânico.',
      potential_impact: 'high',
      action_items: [
        'Criar conteúdo educativo/informativo que as pessoas queiram compartilhar',
        'Adicionar CTAs pedindo para compartilhar nos Stories',
        'Criar carrosséis com dicas úteis',
      ],
    });
  }

  // Executive summary
  insights.executive_summary = `Com ${summary.totalFollowers.toLocaleString()} seguidores, a conta teve ${summary.totalReach.toLocaleString()} de alcance e ${summary.totalEngagements.toLocaleString()} engajamentos nos últimos 28 dias. Taxa de engajamento de ${summary.engagementRate}% e crescimento de ${summary.netGrowth >= 0 ? '+' : ''}${summary.netGrowth} seguidores.`;

  // Next steps
  insights.next_steps = [
    summary.engagementRate < 1 ? 'Melhorar engajamento com conteúdo mais interativo' : 'Manter qualidade do conteúdo atual',
    summary.netGrowth < 0 ? 'Revisar estratégia para reter seguidores' : 'Escalar estratégia de crescimento',
    'Analisar horários de pico para otimizar publicações',
  ];

  return insights;
}
