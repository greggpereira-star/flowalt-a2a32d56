import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { inicioDaSemanaSP, TIPOS_DE_META, type MetaDoTime, type SemanaDeEntregas, type TipoDeMeta } from '@/lib/gamificacao/metaDoTime';

/** Metas do time da semana atual, com o progresso calculado no banco. Antes da migracao existir, devolve lista vazia sem barulho. */
export function useMetaDoTime() {
  const { currentWorkspace } = useWorkspace();
  const { data } = useQuery({
    queryKey: ['meta-do-time', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_meta_do_time', { p_workspace_id: currentWorkspace!.id });
      if (error) return [] as MetaDoTime[];
      return (data ?? []) as MetaDoTime[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  return data ?? [];
}

/** Entregas e entregas no prazo das ultimas semanas, para escolher uma meta realista. */
export function useHistoricoDeEntregas() {
  const { currentWorkspace } = useWorkspace();
  const { data } = useQuery({
    queryKey: ['historico-entregas-semanais', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_historico_entregas_semanais', { p_workspace_id: currentWorkspace!.id, p_semanas: 6 });
      if (error) return [] as SemanaDeEntregas[];
      return (data ?? []) as SemanaDeEntregas[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60_000,
  });
  return data ?? [];
}

/** Criar e remover a meta do time da semana (admin). */
export function useAdministrarMetaDoTime() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const semana = useMemo(() => inicioDaSemanaSP(), []);
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['meta-do-time', currentWorkspace?.id] });

  const criar = useMutation({
    mutationFn: async ({ tipo, alvo, recompensa }: { tipo: TipoDeMeta; alvo: number; recompensa: string }) => {
      const { error } = await (supabase as any).from('team_goals').upsert(
        {
          workspace_id: currentWorkspace!.id,
          week_start: semana,
          tipo,
          alvo,
          titulo: TIPOS_DE_META[tipo].titulo(alvo),
          recompensa: recompensa.trim() || null,
          ativa: true,
          celebrada_em: null,
          created_by: user?.id ?? null,
        },
        { onConflict: 'workspace_id,week_start,tipo' },
      );
      if (error) throw error;
    },
    onSuccess: refrescar,
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('team_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refrescar,
  });

  return { criar, remover, semana };
}
