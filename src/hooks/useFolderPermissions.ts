import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FolderPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageViews: boolean;
  canManageChecklist: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

/**
 * Hook to check folder-specific permissions based on ownership, workspace role, and folder membership.
 * 
 * Rules:
 * - Admin/Owner/Coordinator: Full access to all folders
 * - Collaborator (member): Access to folders where owner_id = their user_id OR folder_members.can_edit = true
 */
export function useFolderPermissions(folderId: string | undefined, folderOwnerId: string | null | undefined): FolderPermissions {
  const { user } = useAuth();
  const permissions = usePermissions();

  const { data: memberPermissions } = useQuery({
    queryKey: ['folder-member-permissions', folderId, user?.id],
    queryFn: async () => {
      if (!folderId || !user?.id) return null;
      const { data, error } = await supabase
        .from('folder_members')
        .select('can_edit, can_delete')
        .eq('folder_id', folderId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) return null;
      return data;
    },
    enabled: !!folderId && !!user?.id,
  });

  return useMemo(() => {
    const userId = user?.id;
    const isAdmin = permissions.canManageWorkspace; // admin, owner, coordinator
    const isOwner = folderOwnerId === userId;
    
    // Shared folders (no owner) are accessible by everyone in the workspace
    const isSharedFolder = folderOwnerId === null || folderOwnerId === undefined;
    
    // Member specific permissions
    const canEditMember = memberPermissions?.can_edit || false;
    const canDeleteMember = memberPermissions?.can_delete || false;
    
    // Can view if: admin OR owner OR shared folder OR member
    const canView = isAdmin || isOwner || isSharedFolder || !!memberPermissions;
    
    // Can edit if: admin OR owner OR member.can_edit
    const canEdit = isAdmin || isOwner || canEditMember;
    
    // Can delete if: admin OR owner OR member.can_delete
    const canDelete = isAdmin || isOwner || canDeleteMember;
    
    // Can manage views (create/edit/delete) if: admin OR owner OR member.can_edit
    const canManageViews = isAdmin || isOwner || canEditMember;
    
    // Can manage checklist if: admin OR owner OR member.can_edit
    const canManageChecklist = isAdmin || isOwner || canEditMember;

    return {
      canView,
      canEdit,
      canDelete,
      canManageViews,
      canManageChecklist,
      isOwner,
      isAdmin,
    };
  }, [user?.id, folderOwnerId, permissions.canManageWorkspace, memberPermissions]);
}

/**
 * Hook to check if current user has admin-level access
 */
export function useIsAdmin(): boolean {
  const permissions = usePermissions();
  return permissions.canManageWorkspace;
}
