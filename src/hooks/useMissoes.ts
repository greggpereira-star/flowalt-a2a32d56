import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Missao } from '@/lib/gamificacao/missoes';

/** Missoes abertas e as encerradas nos ultimos 7 dias. A leitura tambem atualiza o estado no banco. Antes da migracao existir, `indisponivel` fica true. */
export function useMissoes() {
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ['missoes-semana', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_missoes_semana', { p_workspace_id: currentWorkspace!.id });
      if (error) return null; // leitura indisponivel: a tela some em vez de dizer que o time esta em dia
      return (data ?? []) as Missao[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  return { missoes: data ?? [], carregando: isLoading, indisponivel: data === null };
}
