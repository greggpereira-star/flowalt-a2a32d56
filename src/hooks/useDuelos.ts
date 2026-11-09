import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { CategoriaDeDuelo, Duelo } from '@/lib/gamificacao/duelos';

/** Duelos ativos, convites meus e os encerrados nos ultimos 14 dias. Antes da migracao existir, `indisponivel` fica true. */
export function useDuelos() {
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ['duelos', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_duelos', { p_workspace_id: currentWorkspace!.id });
      if (error) return null;
      return (data ?? []) as Duelo[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  return { duelos: data ?? [], carregando: isLoading, indisponivel: !isLoading && data === null };
}

/** Desafiar, responder e cancelar; todas atualizam a lista. */
export function useAcoesDeDuelo() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['duelos', currentWorkspace?.id] });

  const desafiar = useMutation({
    mutationFn: async ({ oponente, categoria }: { oponente: string; categoria: CategoriaDeDuelo }) => {
      const { error } = await (supabase as any).rpc('desafiar_duelo', { p_workspace_id: currentWorkspace!.id, p_oponente: oponente, p_categoria: categoria });
      if (error) throw error;
    },
    onSuccess: refrescar,
  });
  const responder = useMutation({
    mutationFn: async ({ id, aceitar }: { id: string; aceitar: boolean }) => {
      const { error } = await (supabase as any).rpc('responder_duelo', { p_id: id, p_aceitar: aceitar });
      if (error) throw error;
    },
    onSuccess: refrescar,
  });
  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc('cancelar_duelo', { p_id: id });
      if (error) throw error;
    },
    onSuccess: refrescar,
  });
  return { desafiar, responder, cancelar };
}
