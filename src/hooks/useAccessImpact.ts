import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions, type AppRole } from '@/hooks/usePermissions';

export interface AccessImpactMember {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  reason?: string;
}

export interface AccessImpactResult {
  willKeepAccess: AccessImpactMember[];
  willLoseAccess: AccessImpactMember[];
  willGainAccess: AccessImpactMember[];
  isLoading: boolean;
  hasImpact: boolean;
  impactSummary: string;
}

interface UseAccessImpactParams {
  entityType: 'card' | 'folder' | 'space';
  entityId?: string;
  targetFolderId?: string | null;
  targetVisibility?: string | null;
  targetAllowedRoles?: string[] | null;
  targetOwnerId?: string | null;
  enabled?: boolean;
}

export function useAccessImpact({
  entityType,
  entityId,
  targetFolderId,
  targetVisibility,
  targetAllowedRoles,
  targetOwnerId,
  enabled = true,
}: UseAccessImpactParams): AccessImpactResult {
  const { currentWorkspace } = useWorkspace();
  const { isAdmin, isOwner } = usePermissions();

  const shouldCalculate = enabled && (isAdmin || isOwner) && !!currentWorkspace?.id;

  // Fetch workspace members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['workspace_members_access_impact', currentWorkspace?.id],
    queryFn: async () => {
      const { data: memberData, error: membersError } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', currentWorkspace!.id)
        .eq('is_active', true);

      if (membersError) throw membersError;

      const memberIds = memberData.map(m => m.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberIds);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('workspace_id', currentWorkspace!.id)
        .in('user_id', memberIds);

      return memberData.map(m => {
        const profile = profiles?.find(p => p.id === m.user_id);
        const roleData = roles?.find(r => r.user_id === m.user_id);
        return {
          id: m.user_id,
          name: profile?.full_name || profile?.email || 'Usuário',
          email: profile?.email || '',
          role: (roleData?.role as AppRole) || 'member',
        };
      });
    },
    enabled: shouldCalculate,
    staleTime: 30000,
  });

  // Calculate access impact
  const result = useMemo<AccessImpactResult>(() => {
    const defaultResult: AccessImpactResult = {
      willKeepAccess: [],
      willLoseAccess: [],
      willGainAccess: [],
      isLoading: membersLoading,
      hasImpact: false,
      impactSummary: '',
    };

    if (!shouldCalculate || !members || members.length === 0) {
      return defaultResult;
    }

    const currentVisibility = 'public';
    const newVisibility = targetVisibility || currentVisibility;
    const newAllowedRoles = targetAllowedRoles || [];

    const willKeepAccess: AccessImpactMember[] = [];
    const willLoseAccess: AccessImpactMember[] = [];
    const willGainAccess: AccessImpactMember[] = [];

    const canAccess = (member: AccessImpactMember, visibility: string, allowedRoles: string[]): boolean => {
      if (['owner', 'admin', 'super_admin'].includes(member.role)) return true;
      if (visibility === 'public') return true;
      if (visibility === 'owner') return member.id === targetOwnerId;
      if (visibility === 'financial') return member.role === 'finance';
      if (visibility === 'restricted' && allowedRoles.length > 0) {
        return allowedRoles.includes(member.role);
      }
      return true;
    };

    members.forEach(member => {
      const hadAccess = canAccess(member, currentVisibility, []);
      const willHaveAccess = canAccess(member, newVisibility, newAllowedRoles);

      if (hadAccess && willHaveAccess) {
        willKeepAccess.push(member);
      } else if (hadAccess && !willHaveAccess) {
        willLoseAccess.push({ ...member, reason: 'Sem permissão para a nova visibilidade' });
      } else if (!hadAccess && willHaveAccess) {
        willGainAccess.push(member);
      }
    });

    const hasImpact = willLoseAccess.length > 0 || willGainAccess.length > 0;
    let impactSummary = '';
    if (hasImpact) {
      const parts: string[] = [];
      if (willLoseAccess.length > 0) parts.push(`${willLoseAccess.length} perderá acesso`);
      if (willGainAccess.length > 0) parts.push(`${willGainAccess.length} ganhará acesso`);
      impactSummary = parts.join(', ');
    }

    return { willKeepAccess, willLoseAccess, willGainAccess, isLoading: false, hasImpact, impactSummary };
  }, [shouldCalculate, members, targetVisibility, targetAllowedRoles, targetOwnerId, membersLoading]);

  return result;
}
