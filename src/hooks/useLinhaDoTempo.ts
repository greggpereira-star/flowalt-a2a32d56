import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { EventoDaLinha } from '@/lib/gamificacao/linhaDoTempo';

/** Feed do time dos ultimos 7 dias. Atualiza sozinho a cada minuto. Antes da migracao existir, `indisponivel` fica true. */
export function useLinhaDoTempo(limite = 30) {
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ['linha-do-tempo', currentWorkspace?.id, limite],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_linha_do_tempo', { p_workspace_id: currentWorkspace!.id, p_limite: limite });
      if (error) return null;
      return (data ?? []) as EventoDaLinha[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  return { eventos: data ?? [], carregando: isLoading, indisponivel: !isLoading && data === null };
}
