import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSpaces } from '@/hooks/useSpaces';
import { useClientCards } from '@/hooks/useClientCards';
import { buscarCards } from '@/hooks/home/useInicioDados';
import { janelaDoPeriodo, type OpcaoPeriodo } from '@/lib/analytics/metrics';
import { calcularExecutor } from '@/lib/dashboard/executor-metrics';

export type PeriodoExecutor = Extract<OpcaoPeriodo, '7d' | '30d'>;

const horasDe = (linhas: { duration_seconds: number | null; started_at: string; is_running: boolean | null }[], agora: Date) =>
  linhas.reduce((total, e) => {
    // Cronômetro ligado conta até agora; sem isso as horas ficariam paradas no último registro fechado.
    if (e.is_running) return total + Math.max(0, (agora.getTime() - new Date(e.started_at).getTime()) / 1000);
    return total + (e.duration_seconds ?? 0);
  }, 0) / 3600;

/**
 * Dados do Dashboard do executor ("Meu desempenho"): só o que é da própria pessoa, com o time como régua.
 * Os cálculos ficam em lib/dashboard/executor-metrics (puros e testados); aqui só se busca e se junta.
 */
export function useDashboardExecutor(periodo: PeriodoExecutor, pessoaId?: string) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { data: espacos } = useSpaces();
  const { data: clientes } = useClientCards();
  const wsId = currentWorkspace?.id;
  // Quem coordena pode olhar o desempenho de outra pessoa do time; sem `pessoaId` é o da própria pessoa.
  const meuId = pessoaId ?? user?.id;

  const cardsQ = useQuery({
    queryKey: ['exec-cards', wsId],
    queryFn: () => buscarCards(wsId!),
    enabled: !!wsId && !!meuId,
    staleTime: 60_000,
  });

  const idsMeus = useMemo(
    () => (cardsQ.data ?? []).filter(c => meuId && c.members.includes(meuId)).map(c => c.id),
    [cardsQ.data, meuId]
  );

  const datasQ = useQuery({
    queryKey: ['exec-post-dates', wsId, meuId, idsMeus.length],
    enabled: idsMeus.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_custom_fields')
        .select('card_id, field_value')
        .eq('field_key', 'post_date')
        .in('card_id', idsMeus);
      if (error) throw error;
      return new Map((data ?? []).filter(l => l.field_value).map(l => [l.card_id, l.field_value as string] as [string, string]));
    },
  });

  const horasQ = useQuery({
    queryKey: ['exec-horas', wsId, meuId, periodo],
    enabled: !!wsId && !!meuId,
    staleTime: 60_000,
    queryFn: async () => {
      const agora = new Date();
      const { atual, anterior } = janelaDoPeriodo(periodo, agora);
      const { data, error } = await supabase
        .from('time_entries')
        .select('duration_seconds, started_at, is_running')
        .eq('workspace_id', wsId!)
        .eq('user_id', meuId!)
        .gte('started_at', anterior.start.toISOString());
      if (error) throw error;
      const linhas = data ?? [];
      const noAtual = linhas.filter(l => new Date(l.started_at) >= atual.start);
      const noAnterior = linhas.filter(l => new Date(l.started_at) < atual.start);
      return { atual: horasDe(noAtual, agora), anterior: horasDe(noAnterior, agora) };
    },
  });

  const espacosSocial = useMemo(
    () => new Set((espacos ?? []).filter(e => e.type === 'social_media').map(e => e.id)),
    [espacos]
  );

  const nomesClientes = useMemo(
    () => new Map((clientes ?? []).map(c => [c.id, c.name] as [string, string])),
    [clientes]
  );

  const resultado = useMemo(() => {
    if (!cardsQ.data || !meuId) return null;
    return calcularExecutor({
      todos: cardsQ.data,
      meuId,
      agora: new Date(),
      periodo,
      datasDePostagem: datasQ.data,
      espacosSocial,
    });
  }, [cardsQ.data, meuId, periodo, datasQ.data, espacosSocial]);

  return {
    resultado,
    horas: horasQ.data ?? null,
    nomesClientes,
    carregando: cardsQ.isLoading,
    erro: cardsQ.error ?? null,
  };
}
