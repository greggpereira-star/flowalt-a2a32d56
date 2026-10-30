import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { MissoesDoDia } from '@/lib/gamificacao/diarias';

/** Missoes de hoje de quem esta logado. Antes da migracao existir (ou se a leitura falhar), `indisponivel` fica true. */
export function useMissoesDiarias() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ['missoes-diarias', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_missoes_diarias', { p_workspace_id: currentWorkspace!.id });
      if (error) return null;
      return ((data ?? [])[0] ?? null) as MissoesDoDia | null;
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
  });
  return { hoje: data ?? null, carregando: isLoading, indisponivel: !isLoading && !data };
}
