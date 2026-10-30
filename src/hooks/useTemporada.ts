import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { mesDaTemporadaSP, proximoMes, type LinhaDaTemporada, type PodioDeTemporada } from '@/lib/gamificacao/temporada';

/** Classificacao da temporada do mes (ao vivo). Antes da migracao existir, devolve vazio sem barulho. */
export function useTemporada() {
  const { currentWorkspace } = useWorkspace();
  const mes = useMemo(() => mesDaTemporadaSP(), []);
  const { data, isLoading } = useQuery({
    queryKey: ['temporada', currentWorkspace?.id, mes],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_temporada', { p_workspace_id: currentWorkspace!.id, p_mes: mes });
      if (error) return [] as LinhaDaTemporada[];
      return (data ?? []) as LinhaDaTemporada[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const linhas = data ?? [];
  const primeira = linhas[0];
  return {
    linhas,
    mes,
    oficial: primeira?.oficial ?? false,
    premio: primeira?.premio ?? null,
    carregando: isLoading,
  };
}

/** Podios das temporadas oficiais ja encerradas. */
export function useHallDaFama() {
  const { currentWorkspace } = useWorkspace();
  const { data } = useQuery({
    queryKey: ['hall-da-fama', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_hall_da_fama', { p_workspace_id: currentWorkspace!.id });
      if (error) return [] as PodioDeTemporada[];
      return (data ?? []) as PodioDeTemporada[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60_000,
  });
  return data ?? [];
}

/** Premio da temporada (admin): vale para a temporada oficial em andamento ou, se ainda nao ha uma, para a proxima. */
export function useAdministrarTemporada() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const mesAtual = useMemo(() => mesDaTemporadaSP(), []);

  const { data: linhas } = useQuery({
    queryKey: ['temporadas-admin', currentWorkspace?.id, mesAtual],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('temporadas')
        .select('mes, premio, encerrada_em')
        .eq('workspace_id', currentWorkspace!.id)
        .gte('mes', mesAtual)
        .order('mes');
      if (error) return [] as { mes: string; premio: string | null; encerrada_em: string | null }[];
      return (data ?? []) as { mes: string; premio: string | null; encerrada_em: string | null }[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const existeDoMesAtual = (linhas ?? []).some(l => l.mes === mesAtual);
  const mesAlvo = existeDoMesAtual ? mesAtual : proximoMes(mesAtual);
  const premioAtual = (linhas ?? []).find(l => l.mes === mesAlvo)?.premio ?? '';

  const salvar = useMutation({
    mutationFn: async (premio: string) => {
      const { error } = await (supabase as any)
        .from('temporadas')
        .upsert({ workspace_id: currentWorkspace!.id, mes: mesAlvo, premio: premio.trim() || null, created_by: user?.id ?? null }, { onConflict: 'workspace_id,mes' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temporadas-admin', currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ['temporada', currentWorkspace?.id] });
    },
  });

  return { mesAlvo, premioAtual, salvar };
}
