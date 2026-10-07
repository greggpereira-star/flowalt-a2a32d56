import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { STATUS_ENCERRADOS_SQL } from '@/lib/metrics/definicoes';
import { sugerirResponsaveis, type EntregaNoSpace } from '@/lib/inteligencia/sugestao-responsavel';

const DIAS_HISTORICO = 180;

/** Sugestões de responsável para um card: histórico do space + carga atual. Cálculo em lib/inteligencia. */
export function useSugestaoResponsavel(cardId: string, jaNoCard: string[], ativo: boolean) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  const { data: membros = [] } = useWorkspaceMembers();

  const dadosQ = useQuery({
    queryKey: ['sugestao-responsavel', wsId, cardId],
    enabled: ativo && !!wsId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: card, error: e0 } = await supabase.from('cards').select('space_id').eq('id', cardId).single();
      if (e0) throw e0;
      const desde = new Date(Date.now() - DIAS_HISTORICO * 86_400_000).toISOString();
      const [entregasR, abertosR] = await Promise.all([
        supabase
          .from('cards')
          .select('id, card_members(user_id)')
          .eq('workspace_id', wsId!)
          .eq('space_id', card.space_id)
          .not('completed_at', 'is', null)
          .gte('completed_at', desde)
          .limit(1000),
        supabase
          .from('card_members')
          .select('user_id, cards!inner(status, workspace_id)')
          .eq('cards.workspace_id', wsId!)
          .not('cards.status', 'in', STATUS_ENCERRADOS_SQL)
          .limit(2000),
      ]);
      if (entregasR.error) throw entregasR.error;
      if (abertosR.error) throw abertosR.error;
      const entregas: EntregaNoSpace[] = (entregasR.data ?? []).map((c: any) => ({
        members: (c.card_members ?? []).map((m: any) => m.user_id),
      }));
      const abertos = new Map<string, number>();
      (abertosR.data ?? []).forEach((m: any) => abertos.set(m.user_id, (abertos.get(m.user_id) ?? 0) + 1));
      return { entregas, abertos };
    },
  });

  const sugestoes = useMemo(() => {
    if (!dadosQ.data) return [];
    const candidatos = membros.map(m => ({
      user_id: m.user_id,
      nome: m.profile?.full_name || m.profile?.email || 'Membro',
    }));
    return sugerirResponsaveis(candidatos, dadosQ.data.entregas, dadosQ.data.abertos, jaNoCard);
  }, [dadosQ.data, membros, jaNoCard.join(',')]);

  return { sugestoes, carregando: dadosQ.isLoading };
}
