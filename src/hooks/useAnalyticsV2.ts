import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  concentracaoDeEntregas,
  distribuicaoAtraso,
  janelaDoPeriodo,
  qualidadeDoCadastro,
  recortarPor,
  resumoDaJanela,
  serieSemanal,
  situacaoAtual,
  type CardRow,
  type OpcaoPeriodo,
  type Recorte,
  type Resumo,
  type Situacao,
} from '@/lib/analytics/metrics';

const DIAS_DE_HISTORICO = 190; // cobre 90 dias + o período anterior de comparação

export interface Insight {
  id: string;
  nivel: 'alerta' | 'atencao' | 'info' | 'ok';
  titulo: string;
  texto: string;
}

const pl = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/** Regras que transformam os números em avisos. Cada texto afirma só o que foi medido. */
function gerarInsights(args: {
  atual: Resumo;
  anterior: Resumo;
  situacao: Situacao;
  rotulo: string;
  concentracao: { total: number; dia: string; qtd: number; pct: number };
  pessoas: (Recorte & { nome: string })[];
  qualidade: ReturnType<typeof qualidadeDoCadastro>;
}): Insight[] {
  const { atual, anterior, situacao, rotulo, concentracao, pessoas, qualidade } = args;
  const lista: Insight[] = [];

  if (atual.noPrazoPct != null && atual.comPrazo >= 5 && atual.noPrazoPct < 50) {
    lista.push({
      id: 'prazo',
      nivel: 'alerta',
      titulo: `Só ${atual.noPrazoPct}% das entregas saíram no prazo`,
      texto: `${atual.noPrazo} de ${atual.comPrazo} entregas com prazo (${rotulo}). Entre as atrasadas, a mediana é de ${atual.atrasoMediana} dias de atraso. Vale conferir se o prazo cadastrado é o combinado com o cliente e se a entrega é registrada no dia em que ela acontece.`,
    });
  } else if (atual.noPrazoPct != null && atual.comPrazo >= 5 && atual.noPrazoPct >= 80) {
    lista.push({
      id: 'prazo-ok',
      nivel: 'ok',
      titulo: `${atual.noPrazoPct}% das entregas no prazo`,
      texto: `${atual.noPrazo} de ${atual.comPrazo} entregas com prazo saíram dentro da data (${rotulo}).`,
    });
  }

  if (situacao.atrasados > 0) {
    const pior = situacao.maisAtrasados[0];
    lista.push({
      id: 'atrasados',
      nivel: 'alerta',
      titulo: `${pl(situacao.atrasados, 'card aberto atrasado', 'cards abertos atrasados')}`,
      texto: pior
        ? `O mais antigo é "${pior.card.title}", com ${pl(pior.diasAtraso, 'dia', 'dias')} de atraso.`
        : 'Veja a lista na aba Prazos.',
    });
  }

  if (atual.concluidos >= 5 && atual.criados > atual.concluidos * 1.3) {
    lista.push({
      id: 'entrada',
      nivel: 'atencao',
      titulo: 'Entram mais demandas do que saem',
      texto: `${rotulo}: ${atual.criados} criados contra ${atual.concluidos} concluídos. Se continuar assim, o backlog cresce.`,
    });
  }

  if (concentracao.total >= 8 && concentracao.pct >= 30) {
    const [, m, d] = concentracao.dia.split('-');
    lista.push({
      id: 'lote',
      nivel: 'info',
      titulo: `${concentracao.pct}% das entregas foram registradas em um único dia`,
      texto: `${concentracao.qtd} de ${concentracao.total} no dia ${d}/${m}. Quando a baixa é feita em lote, o tempo de entrega e o prazo ficam distorcidos.`,
    });
  }

  const comAbertos = pessoas.filter(p => p.abertos > 0);
  if (comAbertos.length >= 2) {
    const media = comAbertos.reduce((s, p) => s + p.abertos, 0) / comAbertos.length;
    const topo = [...comAbertos].sort((a, b) => b.abertos - a.abertos)[0];
    if (topo.abertos >= 3 && topo.abertos >= media * 1.8) {
      lista.push({
        id: 'carga',
        nivel: 'atencao',
        titulo: `${topo.nome} concentra a carga`,
        texto: `${pl(topo.abertos, 'card aberto', 'cards abertos')}, contra uma média de ${media.toFixed(1)} entre quem tem demanda em aberto.`,
      });
    }
  }

  if (situacao.semResponsavel > 0) {
    lista.push({
      id: 'sem-responsavel',
      nivel: 'atencao',
      titulo: `${pl(situacao.semResponsavel, 'card aberto sem responsável', 'cards abertos sem responsável')}`,
      texto: 'Sem responsável, o card não entra na carga de ninguém nem nas métricas da equipe.',
    });
  }

  if (situacao.parados > 0) {
    lista.push({
      id: 'parados',
      nivel: 'atencao',
      titulo: `${pl(situacao.parados, 'card aberto', 'cards abertos')} sem movimento há mais de 14 dias`,
      texto: 'Vale decidir se seguem, ficam em espera ou são arquivados.',
    });
  }

  if (atual.leadMediana != null && anterior.leadMediana != null && anterior.leadMediana > 0 && atual.concluidos >= 5) {
    const variacao = Math.round(((atual.leadMediana - anterior.leadMediana) / anterior.leadMediana) * 100);
    if (Math.abs(variacao) >= 20) {
      lista.push({
        id: 'lead',
        nivel: variacao < 0 ? 'ok' : 'atencao',
        titulo: `Tempo de entrega ${variacao < 0 ? 'caiu' : 'subiu'} ${Math.abs(variacao)}%`,
        texto: `Mediana de ${atual.leadMediana} dias (${rotulo}) contra ${anterior.leadMediana} dias no período anterior.`,
      });
    }
  }

  if (qualidade.total > 0 && qualidade.semHoras / qualidade.total > 0.8) {
    lista.push({
      id: 'horas',
      nivel: 'info',
      titulo: 'Quase nenhum card tem horas registradas',
      texto: `${qualidade.semHoras} de ${qualidade.total} cards ativos sem tempo apontado, então não dá para medir esforço nem custo por entrega. O cronômetro nos cards resolve isso.`,
    });
  }

  const ordem = { alerta: 0, atencao: 1, info: 2, ok: 3 } as const;
  return lista.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

async function buscarCards(workspaceId: string, desde: string): Promise<CardRow[]> {
  const linhas: CardRow[] = [];
  const PAGINA = 1000;
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from('cards')
      .select(
        'id, title, status, due_date, completed_at, created_at, updated_at, space_id, client_id, estimated_hours, actual_hours, card_members(user_id)'
      )
      .eq('workspace_id', workspaceId)
      .or(`created_at.gte.${desde},completed_at.gte.${desde},status.not.in.(delivered,approved,archived)`)
      .order('created_at', { ascending: false })
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    (data ?? []).forEach((c: any) =>
      linhas.push({
        id: c.id,
        title: c.title,
        status: c.status,
        due_date: c.due_date,
        completed_at: c.completed_at,
        created_at: c.created_at,
        updated_at: c.updated_at,
        space_id: c.space_id,
        client_id: c.client_id,
        estimated_hours: c.estimated_hours != null ? Number(c.estimated_hours) : null,
        actual_hours: c.actual_hours != null ? Number(c.actual_hours) : null,
        members: (c.card_members ?? []).map((m: any) => m.user_id),
      })
    );
    if (!data || data.length < PAGINA) break;
  }
  return linhas;
}

export function useAnalyticsV2(opcao: OpcaoPeriodo) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  const cardsQ = useQuery({
    queryKey: ['analytics-v2-cards', wsId],
    queryFn: () => buscarCards(wsId!, new Date(Date.now() - DIAS_DE_HISTORICO * 86_400_000).toISOString()),
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const nomesQ = useQuery({
    queryKey: ['analytics-v2-nomes', wsId],
    queryFn: async () => {
      const [{ data: spaces }, { data: clients }, { data: membros }] = await Promise.all([
        supabase.from('spaces').select('id, name').eq('workspace_id', wsId!),
        supabase.from('clients').select('id, name').eq('workspace_id', wsId!),
        supabase.from('workspace_members').select('user_id').eq('workspace_id', wsId!).eq('is_active', true),
      ]);
      const ids = (membros ?? []).map(m => m.user_id);
      const { data: perfis } = ids.length
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
        : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
      return {
        spaces: new Map((spaces ?? []).map(s => [s.id, s.name as string])),
        clients: new Map((clients ?? []).map(c => [c.id, c.name as string])),
        pessoas: new Map((perfis ?? []).map(p => [p.id, { nome: p.full_name || 'Membro', avatar: p.avatar_url }])),
        ativos: new Set(ids),
      };
    },
    enabled: !!wsId,
    staleTime: 5 * 60_000,
  });

  const dados = useMemo(() => {
    if (!cardsQ.data || !nomesQ.data) return null;
    const cards = cardsQ.data;
    const nomes = nomesQ.data;
    const agora = new Date();
    const { atual, anterior, rotulo } = janelaDoPeriodo(opcao, agora);

    const resumoAtual = resumoDaJanela(cards, atual);
    const resumoAnterior = resumoDaJanela(cards, anterior);
    const situacao = situacaoAtual(cards, agora);
    const qualidade = qualidadeDoCadastro(cards);
    const concentracao = concentracaoDeEntregas(cards, atual);

    const pessoas = recortarPor(cards, atual, agora, c => c.members.filter(id => nomes.ativos.has(id)))
      .map(r => ({ ...r, nome: nomes.pessoas.get(r.chave)?.nome ?? 'Membro', avatar: nomes.pessoas.get(r.chave)?.avatar ?? null }));
    const spaces = recortarPor(cards, atual, agora, c => [c.space_id ?? 'sem'])
      .map(r => ({ ...r, nome: r.chave === 'sem' ? 'Sem space' : nomes.spaces.get(r.chave) ?? 'Space' }));
    const clientes = recortarPor(cards, atual, agora, c => [c.client_id ?? 'sem'])
      .map(r => ({ ...r, nome: r.chave === 'sem' ? 'Sem cliente' : nomes.clients.get(r.chave) ?? 'Cliente' }));

    return {
      rotulo,
      atual: resumoAtual,
      anterior: resumoAnterior,
      situacao,
      qualidade,
      serie: serieSemanal(cards, agora, 12),
      atraso: distribuicaoAtraso(cards, atual),
      pessoas,
      spaces,
      clientes,
      insights: gerarInsights({ atual: resumoAtual, anterior: resumoAnterior, situacao, rotulo, concentracao, pessoas, qualidade }),
    };
  }, [cardsQ.data, nomesQ.data, opcao]);

  return {
    dados,
    carregando: cardsQ.isLoading || nomesQ.isLoading,
    erro: cardsQ.error || nomesQ.error,
  };
}
