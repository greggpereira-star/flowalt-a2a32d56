import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { HomeActivityItem } from '@/lib/home/home-types';

/**
 * Feed de atividade do workspace.
 *
 * Não usa `domain_events`, apesar de ser a tabela com cara de "log de
 * atividade": 87% do conteúdo dela é telemetria (`social.view.opened`,
 * `social.cards.scope_resolved`). `card_history` tem o mesmo problema —
 * 325 dos 362 registros são `space_shared`. Um feed montado a partir dali
 * mostraria jargão técnico para o usuário.
 *
 * As três fontes abaixo são as que produzem frase legível por humano.
 *
 * Os nomes vêm de uma consulta separada a `profiles`, e não de embed: as FKs
 * de user_id/owner_id/created_by apontam para `auth.users`, então o PostgREST
 * não enxerga relação com `public.profiles` e responde PGRST200.
 */
export function useRecentActivity(limit = 5) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useQuery({
    queryKey: ['home', 'recent-activity', workspaceId, limit],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async (): Promise<HomeActivityItem[]> => {
      const [commentsRes, createdRes, completedRes] = await Promise.all([
        supabase
          .from('comments')
          .select('id, created_at, card_id, user_id, cards!inner(title, workspace_id)')
          .eq('cards.workspace_id', workspaceId!)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('cards')
          .select('id, title, created_at, created_by')
          .eq('workspace_id', workspaceId!)
          .neq('status', 'archived')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('cards')
          .select('id, title, completed_at, owner_id')
          .eq('workspace_id', workspaceId!)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(limit),
      ]);

      const raw: (HomeActivityItem & { actorId: string | null })[] = [];

      (commentsRes.data ?? []).forEach((row: any) => {
        raw.push({
          id: `comment-${row.id}`,
          actorId: row.user_id,
          actor: '',
          actionText: `comentou em ${row.cards?.title ?? 'um card'}`,
          createdAt: row.created_at,
          route: '/tasks',
        });
      });

      (createdRes.data ?? []).forEach((row: any) => {
        raw.push({
          id: `created-${row.id}`,
          actorId: row.created_by,
          actor: '',
          actionText: `criou ${row.title}`,
          createdAt: row.created_at,
          route: '/tasks',
        });
      });

      (completedRes.data ?? []).forEach((row: any) => {
        raw.push({
          id: `done-${row.id}`,
          actorId: row.owner_id,
          actor: '',
          actionText: `concluiu ${row.title}`,
          createdAt: row.completed_at,
          route: '/tasks',
        });
      });

      // Uma única consulta de perfis para todos os autores do feed.
      const actorIds = [...new Set(raw.map((r) => r.actorId).filter(Boolean))] as string[];
      const nameById = new Map<string, string>();

      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', actorIds);

        (profiles ?? []).forEach((p) => {
          if (p.full_name) nameById.set(p.id, p.full_name);
        });
      }

      return raw
        .filter((item) => !!item.createdAt)
        .map(({ actorId, ...item }) => ({
          ...item,
          actor: (actorId && nameById.get(actorId)) || 'Alguém',
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
    },
  });
}
