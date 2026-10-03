import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface IndicadoresDoCard {
  feitos: number;
  total: number;
  comentarios: number;
}

const PAGINA = 1000;

async function paginar(consulta: (de: number, ate: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const linhas: any[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await consulta(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return linhas;
}

/**
 * Progresso do checklist e número de comentários de cada card, para o visual novo do Kanban.
 * Duas consultas por workspace (uma para checklists, outra para comentários), compartilhadas
 * por todos os cards do quadro. Só roda quando o visual novo está ligado.
 */
export function useCardIndicators(ativo: boolean) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  return useQuery({
    queryKey: ['card-indicators', wsId],
    enabled: ativo && !!wsId,
    staleTime: 60_000,
    queryFn: async () => {
      const mapa = new Map<string, IndicadoresDoCard>();
      const doCard = (id: string) => {
        let v = mapa.get(id);
        if (!v) {
          v = { feitos: 0, total: 0, comentarios: 0 };
          mapa.set(id, v);
        }
        return v;
      };

      const [itens, comentarios] = await Promise.all([
        paginar((de, ate) =>
          supabase
            .from('checklists')
            .select('card_id, is_completed, cards!inner(workspace_id)')
            .eq('cards.workspace_id', wsId!)
            .range(de, ate)
        ),
        paginar((de, ate) =>
          supabase
            .from('comments')
            .select('card_id, cards!inner(workspace_id)')
            .eq('cards.workspace_id', wsId!)
            .range(de, ate)
        ),
      ]);

      itens.forEach(i => {
        const v = doCard(i.card_id);
        v.total++;
        if (i.is_completed) v.feitos++;
      });
      comentarios.forEach(c => {
        doCard(c.card_id).comentarios++;
      });
      return mapa;
    },
  });
}
