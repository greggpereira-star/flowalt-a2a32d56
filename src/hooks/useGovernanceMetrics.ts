import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface GovernanceMetrics {
  restrictedCards: number;
  privateFolders: number;
  hiddenSpaces: number;
  pendingInvites: number;
  financialOnlyItems: number;
  recentAccessDenials: number;
}

interface VisibilityIssue {
  type: 'card' | 'folder' | 'space' | 'invite';
  id: string;
  name: string;
  reason: string;
  affected_users?: number;
}

export function useGovernanceMetrics() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['governance-metrics', currentWorkspace?.id],
    queryFn: async (): Promise<GovernanceMetrics> => {
      if (!currentWorkspace?.id) {
        return {
          restrictedCards: 0,
          privateFolders: 0,
          hiddenSpaces: 0,
          pendingInvites: 0,
          financialOnlyItems: 0,
          recentAccessDenials: 0,
        };
      }

      // Fetch all metrics in parallel
      const [
        cardsResult,
        foldersResult,
        spacesResult,
        invitesResult,
        accessLogsResult,
      ] = await Promise.all([
        // Restricted cards
        supabase
          .from('cards')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('visibility', 'restricted'),
        
        // Private folders (is_personal = true)
        supabase
          .from('folders')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('is_personal', true)
          .eq('is_archived', false),
        
        // Restricted spaces (access_level = 'restricted')
        supabase
          .from('spaces')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('access_level', 'restricted'),
        
        // Pending invites
        supabase
          .from('workspace_invites')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('status', 'pending'),
        
        // Recent access denials (last 7 days)
        supabase
          .from('access_logs')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('access_type', 'access.denied')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        restrictedCards: cardsResult.count || 0,
        privateFolders: foldersResult.count || 0,
        hiddenSpaces: spacesResult.count || 0,
        pendingInvites: invitesResult.count || 0,
        financialOnlyItems: 0, // Would need a specific query for financial-only items
        recentAccessDenials: accessLogsResult.count || 0,
      };
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useVisibilityIssues() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['visibility-issues', currentWorkspace?.id],
    queryFn: async (): Promise<VisibilityIssue[]> => {
      if (!currentWorkspace?.id) return [];

      const issues: VisibilityIssue[] = [];

      // Get cards that might be "invisible" to most users
      const { data: restrictedCards } = await supabase
        .from('cards')
        .select('id, title, visibility')
        .eq('workspace_id', currentWorkspace.id)
        .eq('visibility', 'restricted')
        .limit(10);

      if (restrictedCards) {
        for (const card of restrictedCards) {
          issues.push({
            type: 'card',
            id: card.id,
            name: card.title,
            reason: 'Card está marcado como restrito - apenas membros autorizados podem ver',
          });
        }
      }

      // Get personal folders
      const { data: personalFolders } = await supabase
        .from('folders')
        .select('id, name, owner_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_personal', true)
        .eq('is_archived', false)
        .limit(10);

      if (personalFolders) {
        for (const folder of personalFolders) {
          issues.push({
            type: 'folder',
            id: folder.id,
            name: folder.name,
            reason: 'Pasta pessoal - visível apenas para o proprietário',
          });
        }
      }

      // Get restricted spaces
      const { data: restrictedSpaces } = await supabase
        .from('spaces')
        .select('id, name, access_level')
        .eq('workspace_id', currentWorkspace.id)
        .eq('access_level', 'restricted')
        .limit(10);

      if (restrictedSpaces) {
        for (const space of restrictedSpaces) {
          issues.push({
            type: 'space',
            id: space.id,
            name: space.name,
            reason: 'Espaço restrito - apenas membros com acesso específico',
          });
        }
      }

      // Get expired invites
      const { data: expiredInvites } = await supabase
        .from('workspace_invites')
        .select('id, email, expires_at')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString())
        .limit(10);

      if (expiredInvites) {
        for (const invite of expiredInvites) {
          issues.push({
            type: 'invite',
            id: invite.id,
            name: invite.email,
            reason: 'Convite expirado - usuário não conseguirá aceitar',
          });
        }
      }

      return issues;
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentAccessDenials() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['recent-access-denials', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('access_logs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('access_type', 'access.denied')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 2 * 60 * 1000,
  });
}
