import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';

export type AccessStatus = 'allowed' | 'blocked';

export interface DiagnosticItem {
  id: string;
  name: string;
  type: 'space' | 'folder' | 'card';
  status: AccessStatus;
  reason: string;
  visibility?: string;
  ownerId?: string;
}

export interface MemberDiagnosticResult {
  spaces: DiagnosticItem[];
  folders: DiagnosticItem[];
  cards: DiagnosticItem[];
  notifications: { receiving: boolean; reason: string };
  isLoading: boolean;
}

interface UseMemberAccessDiagnosticParams {
  targetUserId: string;
  targetUserRole: string;
  enabled?: boolean;
  filter?: 'all' | 'blocked' | 'restricted';
  limit?: number;
}

export function useMemberAccessDiagnostic({
  targetUserId,
  targetUserRole,
  enabled = true,
  filter = 'all',
  limit = 50,
}: UseMemberAccessDiagnosticParams): MemberDiagnosticResult {
  const { currentWorkspace } = useWorkspace();
  const { isAdmin, isOwner } = usePermissions();

  const canDiagnose = enabled && (isAdmin || isOwner) && !!currentWorkspace?.id && !!targetUserId;

  const { data: spacesData, isLoading: spacesLoading } = useQuery<DiagnosticItem[]>({
    queryKey: ['member_diagnostic_spaces', currentWorkspace?.id, targetUserId, filter],
    queryFn: async () => {
      const { data: spaces, error } = await supabase
        .from('spaces')
        .select('id, name, owner_id, is_system, is_restricted, allowed_roles')
        .eq('workspace_id', currentWorkspace!.id)
        .neq('is_system', true)
        .limit(limit);

      if (error) throw error;

      const results: DiagnosticItem[] = [];
      for (const space of spaces || []) {
        const isOwnerOrAdmin = ['owner', 'admin', 'super_admin'].includes(targetUserRole);
        const allowedRoles = (space.allowed_roles as string[]) || [];
        const hasRole = allowedRoles.length === 0 || allowedRoles.includes(targetUserRole);
        const status: AccessStatus = isOwnerOrAdmin || hasRole ? 'allowed' : 'blocked';
        const reason = status === 'allowed' ? 'Acesso permitido' : 'Sem role permitido';

        if (filter === 'all' || (filter === 'blocked' && status === 'blocked')) {
          results.push({ id: space.id, name: space.name, type: 'space', status, reason, ownerId: space.owner_id });
        }
      }
      return results;
    },
    enabled: canDiagnose,
    staleTime: 30000,
  });

  const { data: foldersData, isLoading: foldersLoading } = useQuery<DiagnosticItem[]>({
    queryKey: ['member_diagnostic_folders', currentWorkspace?.id, targetUserId, filter],
    queryFn: async () => {
      const { data: folders, error } = await supabase
        .from('folders')
        .select('id, name, owner_id, is_restricted, allowed_roles')
        .eq('workspace_id', currentWorkspace!.id)
        .limit(limit);

      if (error) throw error;

      const results: DiagnosticItem[] = [];
      for (const folder of folders || []) {
        const isOwnerOrAdmin = ['owner', 'admin', 'super_admin'].includes(targetUserRole);
        const isOwner = folder.owner_id === targetUserId;
        const allowedRoles = (folder.allowed_roles as string[]) || [];
        const hasRole = allowedRoles.length === 0 || allowedRoles.includes(targetUserRole);
        const status: AccessStatus = isOwnerOrAdmin || isOwner || (!folder.is_restricted && hasRole) ? 'allowed' : 'blocked';
        const reason = status === 'allowed' ? 'Acesso permitido' : 'Pasta restrita';

        if (filter === 'all' || (filter === 'blocked' && status === 'blocked')) {
          results.push({ id: folder.id, name: folder.name, type: 'folder', status, reason, ownerId: folder.owner_id });
        }
      }
      return results;
    },
    enabled: canDiagnose,
    staleTime: 30000,
  });

  const { data: cardsData, isLoading: cardsLoading } = useQuery<DiagnosticItem[]>({
    queryKey: ['member_diagnostic_cards', currentWorkspace?.id, targetUserId, filter],
    queryFn: async () => {
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, title, visibility, owner_id, created_by')
        .eq('workspace_id', currentWorkspace!.id)
        .neq('status', 'archived')
        .limit(limit);

      if (error) throw error;

      const cardIds = cards?.map(c => c.id) || [];
      const { data: cardMembers } = await supabase
        .from('card_members')
        .select('card_id')
        .eq('user_id', targetUserId)
        .in('card_id', cardIds);

      const userCardMemberIds = new Set(cardMembers?.map(cm => cm.card_id) || []);
      const results: DiagnosticItem[] = [];

      for (const card of cards || []) {
        const isOwnerOrAdmin = ['owner', 'admin', 'super_admin'].includes(targetUserRole);
        const isCardMember = userCardMemberIds.has(card.id);
        const isCreator = card.created_by === targetUserId;
        const status: AccessStatus = isOwnerOrAdmin || isCardMember || isCreator ? 'allowed' : 
          (card.visibility === 'restricted' || card.visibility === 'owner') ? 'blocked' : 'allowed';
        const reason = status === 'allowed' ? 'Acesso permitido' : 'Card restrito';

        if (filter === 'all' || (filter === 'blocked' && status === 'blocked')) {
          results.push({ id: card.id, name: card.title, type: 'card', status, reason, visibility: card.visibility, ownerId: card.owner_id });
        }
      }
      return results;
    },
    enabled: canDiagnose,
    staleTime: 30000,
  });

  return {
    spaces: spacesData || [],
    folders: foldersData || [],
    cards: cardsData || [],
    notifications: { receiving: true, reason: 'Notificações ativas' },
    isLoading: spacesLoading || foldersLoading || cardsLoading,
  };
}
