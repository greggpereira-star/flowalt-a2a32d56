import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  janelaDoPeriodo,
  resumoDaJanela,
  type CardRow,
} from '@/lib/analytics/metrics';
import {
  avaliarCards,
  cargaPorPessoa,
  resumir,
  type CoordCard,
  type EtapaConfig,
} from '@/lib/coordination/coordMetrics';

const DIAS = 64; // 30 dias do período atual + 30 do anterior, para comparar

interface Bruto extends CardRow {
  current_stage: string | null;
  stage_entered_at: string | null;
  space: { id: string; name: string; color: string | null } | null;
}

async function buscarCards(workspaceId: string): Promise<Bruto[]> {
  const desde = new Date(Date.now() - DIAS * 86_400_000).toISOString();
  const linhas: Bruto[] = [];
  const PAGINA = 1000;
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from('cards')
      .select(
        'id, title, status, due_date, completed_at, created_at, updated_at, space_id, client_id, estimated_hours, actual_hours, current_stage, stage_entered_at, space:spaces(id, name, color), card_members(user_id)'
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
        current_stage: c.current_stage,
        stage_entered_at: c.stage_entered_at,
        space: c.space ?? null,
      })
    );
    if (!data || data.length < PAGINA) break;
  }
  return linhas;
}

/**
 * Dados da Início nova: indicadores de entrega (mesmas regras da tela Analytics), fila de cards que
 * precisam de atenção e carga por pessoa (mesmas regras da Coordenação). Nenhuma regra é recriada
 * aqui: tudo vem de lib/analytics/metrics e lib/coordination/coordMetrics.
 */
export function useInicioDados(ativo: boolean) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  const cardsQ = useQuery({
    queryKey: ['inicio-cards', wsId],
    queryFn: () => buscarCards(wsId!),
    enabled: ativo && !!wsId,
    staleTime: 60_000,
  });

  const apoioQ = useQuery({
    queryKey: ['inicio-apoio', wsId],
    enabled: ativo && !!wsId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [{ data: etapas }, { data: membros }] = await Promise.all([
        supabase
          .from('workflow_stages')
          .select('slug, name, sort_order, is_final, wip_limit, wip_limit_per_person, sla_warning_hours, sla_critical_hours, workflows!inner(workspace_id)')
          .eq('workflows.workspace_id', wsId!),
        supabase.from('workspace_members').select('user_id').eq('workspace_id', wsId!).eq('is_active', true),
      ]);
      const ids = (membros ?? []).map(m => m.user_id);
      const { data: perfis } = ids.length
        ? await supabase.from('profiles').select('id, full_name').in('id', ids)
        : { data: [] as { id: string; full_name: string | null }[] };
      return {
        etapas: (etapas ?? []) as unknown as EtapaConfig[],
        ativos: new Set(ids),
        nomes: new Map((perfis ?? []).map(p => [p.id, p.full_name || 'Membro'] as [string, string])),
      };
    },
  });

  const dados = useMemo(() => {
    if (!cardsQ.data || !apoioQ.data) return null;
    const agora = new Date();
    const { atual, anterior } = janelaDoPeriodo('30d', agora);

    const resumoAtual = resumoDaJanela(cardsQ.data, atual);
    const resumoAnterior = resumoDaJanela(cardsQ.data, anterior);

    const vinculos = cardsQ.data.flatMap(c => c.members.map(u => ({ card_id: c.id, user_id: u })));
    const avaliados = avaliarCards(
      cardsQ.data as unknown as CoordCard[],
      vinculos,
      apoioQ.data.etapas,
      agora,
      apoioQ.data.ativos
    );
    const ativosEmAtencao = avaliados.filter(a => a.pontos > 0).sort((a, b) => b.pontos - a.pontos);

    return {
      resumoAtual,
      resumoAnterior,
      coord: resumir(avaliados, agora),
      emAtencao: ativosEmAtencao,
      carga: cargaPorPessoa(avaliados, agora),
      nomes: apoioQ.data.nomes,
    };
  }, [cardsQ.data, apoioQ.data]);

  return { dados, carregando: cardsQ.isLoading || apoioQ.isLoading, erro: cardsQ.error || apoioQ.error };
}
