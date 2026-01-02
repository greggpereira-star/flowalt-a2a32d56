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

  // Spaces diagnostic - uses allowed_roles, access_level
  const { data: spacesData, isLoading: spacesLoading } = useQuery<DiagnosticItem[]>({
    queryKey: ['member_diagnostic_spaces', currentWorkspace?.id, targetUserId, filter],
    queryFn: async () => {
      const { data: spaces, error } = await supabase
        .from('spaces')
        .select('id, name, is_system, allowed_roles, access_level')
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
        const reason = status === 'allowed' ? 'Acesso permitido' : `Sem role permitido (requer: ${allowedRoles.join(', ')})`;

        if (filter === 'all' || (filter === 'blocked' && status === 'blocked')) {
          results.push({ id: space.id, name: space.name, type: 'space', status, reason });
        }
      }
      return results;
    },
    enabled: canDiagnose,
    staleTime: 30000,
  });

  // Folders diagnostic - uses owner_id, is_restricted, visibility
  const { data: foldersData, isLoading: foldersLoading } = useQuery<DiagnosticItem[]>({
    queryKey: ['member_diagnostic_folders', currentWorkspace?.id, targetUserId, filter],
    queryFn: async () => {
      const { data: folders, error } = await supabase
        .from('folders')
        .select('id, name, owner_id, is_restricted, visibility')
        .eq('workspace_id', currentWorkspace!.id)
        .limit(limit);

      if (error) throw error;

      // Check folder_members for this user
      const folderIds = folders?.map(f => f.id) || [];
      const { data: folderMembers } = await supabase
        .from('folder_members')
        .select('folder_id')
        .eq('user_id', targetUserId)
        .in('folder_id', folderIds);

      const userFolderMemberIds = new Set(folderMembers?.map(fm => fm.folder_id) || []);

      const results: DiagnosticItem[] = [];
      for (const folder of folders || []) {
        const isOwnerOrAdmin = ['owner', 'admin', 'super_admin'].includes(targetUserRole);
        const isFolderOwner = folder.owner_id === targetUserId;
        const isFolderMember = userFolderMemberIds.has(folder.id);
        
        let status: AccessStatus = 'allowed';
        let reason = 'Acesso permitido';

        if (!isOwnerOrAdmin) {
          if (folder.visibility === 'owner' && !isFolderOwner) {
            status = 'blocked';
            reason = 'Apenas o proprietário pode acessar';
          } else if (folder.visibility === 'financial' && targetUserRole !== 'finance' && !isFolderOwner) {
            status = 'blocked';
            reason = 'Apenas equipe financeira';
          } else if (folder.is_restricted && !isFolderOwner && !isFolderMember) {
            status = 'blocked';
            reason = 'Pasta restrita - não é membro';
          }
        }

        if (filter === 'all' || (filter === 'blocked' && status === 'blocked')) {
          results.push({ 
            id: folder.id, 
            name: folder.name, 
            type: 'folder', 
            status, 
            reason, 
            visibility: folder.visibility || undefined,
            ownerId: folder.owner_id || undefined
          });
        }
      }
      return results;
    },
    enabled: canDiagnose,
    staleTime: 30000,
  });

  // Cards diagnostic
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
        const isCardOwner = card.owner_id === targetUserId;

        let status: AccessStatus = 'allowed';
        let reason = 'Acesso permitido';

        if (!isOwnerOrAdmin && !isCardMember && !isCreator && !isCardOwner) {
          if (card.visibility === 'restricted' || card.visibility === 'owner') {
            status = 'blocked';
            reason = 'Card restrito - não é membro';
          } else if (card.visibility === 'financial' && targetUserRole !== 'finance') {
            status = 'blocked';
            reason = 'Apenas equipe financeira';
          }
        }

        if (filter === 'all' || (filter === 'blocked' && status === 'blocked')) {
          results.push({ 
            id: card.id, 
            name: card.title, 
            type: 'card', 
            status, 
            reason, 
            visibility: card.visibility, 
            ownerId: card.owner_id || undefined
          });
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
