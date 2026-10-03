import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface EtapaSla {
  slug: string;
  name: string;
  sla_warning_hours: number | null;
  sla_critical_hours: number | null;
}

/**
 * Limites de tempo (SLA) de cada etapa do fluxo, por slug. Uma consulta compartilhada por todos
 * os cards do quadro; só roda quando o visual novo do Kanban está ligado.
 */
export function useEtapasSla(ativo: boolean) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  return useQuery({
    queryKey: ['etapas-sla', wsId],
    enabled: ativo && !!wsId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_stages')
        .select('slug, name, sla_warning_hours, sla_critical_hours, workflows!inner(workspace_id)')
        .eq('workflows.workspace_id', wsId!);
      if (error) throw error;
      const mapa = new Map<string, EtapaSla>();
      (data ?? []).forEach((e: any) =>
        mapa.set(e.slug, {
          slug: e.slug,
          name: e.name,
          sla_warning_hours: e.sla_warning_hours,
          sla_critical_hours: e.sla_critical_hours,
        })
      );
      return mapa;
    },
  });
}
