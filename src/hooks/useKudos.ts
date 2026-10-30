import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { CategoriaDeKudos, Kudos } from '@/lib/gamificacao/kudos';

export interface ColegaDeKudos {
  user_id: string;
  nome: string | null;
  avatar_url: string | null;
}

/** Mural de kudos da equipe. Antes da migracao existir, `indisponivel` fica true. */
export function useKudos() {
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ['kudos', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_kudos', { p_workspace_id: currentWorkspace!.id, p_limite: 40 });
      if (error) return null;
      return (data ?? []) as Kudos[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  });
  return { kudos: data ?? [], carregando: isLoading, indisponivel: !isLoading && data === null };
}

export function useKudosRestantes() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { data } = useQuery({
    queryKey: ['kudos-restantes', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_kudos_restantes', { p_workspace_id: currentWorkspace!.id });
      return error ? null : (data as number);
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
    staleTime: 30_000,
  });
  return data ?? null;
}

export function useColegasDeKudos() {
  const { currentWorkspace } = useWorkspace();
  const { data } = useQuery({
    queryKey: ['kudos-colegas', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_kudos_colegas', { p_workspace_id: currentWorkspace!.id });
      return error ? ([] as ColegaDeKudos[]) : ((data ?? []) as ColegaDeKudos[]);
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60_000,
  });
  return data ?? [];
}

/** Dar e remover kudos; as duas operacoes atualizam o mural e as palmas restantes. */
export function useAcoesDeKudos() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['kudos', currentWorkspace?.id] });
    queryClient.invalidateQueries({ queryKey: ['kudos-restantes', currentWorkspace?.id] });
  };

  const dar = useMutation({
    mutationFn: async ({ para, categoria, motivo }: { para: string; categoria: CategoriaDeKudos; motivo: string }) => {
      const { error } = await (supabase as any).rpc('dar_kudos', { p_workspace_id: currentWorkspace!.id, p_para: para, p_categoria: categoria, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: refrescar,
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc('remover_kudos', { p_id: id });
      if (error) throw error;
    },
    onSuccess: refrescar,
  });

  return { dar, remover };
}
