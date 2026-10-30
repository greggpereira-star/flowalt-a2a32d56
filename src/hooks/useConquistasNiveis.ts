import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { LinhaDeConquista } from '@/lib/gamificacao/conquistas';

/** Valor, nivel e limites de cada trilha para cada membro ativo. Antes da migracao existir, `indisponivel` fica true. */
export function useConquistasNiveis() {
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ['conquistas-niveis', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_conquistas_niveis', { p_workspace_id: currentWorkspace!.id });
      if (error) return null;
      return (data ?? []) as LinhaDeConquista[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60_000,
  });
  return { linhas: data ?? [], carregando: isLoading, indisponivel: !isLoading && data === null };
}
