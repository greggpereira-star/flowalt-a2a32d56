import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  function_title: string | null;
  department: string | null;
  is_active: boolean;
  joined_at: string;
  profile?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    hourly_rate: number | null;
  };
}

export const useWorkspaceMembers = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['workspace_members', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data: members, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (error) throw error;

      // Fetch profiles for each member
      const memberIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, hourly_rate')
        .in('id', memberIds);

      if (profilesError) throw profilesError;

      return members.map(member => ({
        ...member,
        profile: profiles?.find(p => p.id === member.user_id),
      })) as WorkspaceMember[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useMemberCapacity = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['member_capacity', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get all members
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (membersError) throw membersError;

      const memberIds = members.map(m => m.user_id);

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, hourly_rate')
        .in('id', memberIds);

      if (profilesError) throw profilesError;

      // Get time entries for this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('user_id, duration_seconds')
        .eq('workspace_id', currentWorkspace.id)
        .gte('started_at', startOfWeek.toISOString());

      if (timeError) throw timeError;

      // Get assigned cards
      const { data: cardMembers, error: cardError } = await supabase
        .from('card_members')
        .select('user_id, card_id, cards!inner(status, estimated_hours)')
        .in('user_id', memberIds);

      if (cardError) throw cardError;

      return profiles?.map(profile => {
        const weeklyHours = timeEntries
          ?.filter(t => t.user_id === profile.id)
          .reduce((acc, t) => acc + t.duration_seconds, 0) || 0;

        const assignedCards = cardMembers?.filter(
          cm => cm.user_id === profile.id && 
            (cm.cards as { status: string })?.status !== 'delivered' &&
            (cm.cards as { status: string })?.status !== 'archived'
        );

        const allocatedHours = assignedCards?.reduce((acc, cm) => {
          const hours = (cm.cards as { estimated_hours?: number })?.estimated_hours || 0;
          return acc + hours;
        }, 0) || 0;

        return {
          id: profile.id,
          name: profile.full_name || profile.email,
          email: profile.email,
          avatar_url: profile.avatar_url,
          hourly_rate: profile.hourly_rate || 0,
          weekly_hours: Math.round(weeklyHours / 3600 * 10) / 10,
          allocated_hours: allocatedHours,
          active_cards: assignedCards?.length || 0,
          available_hours: 40 - allocatedHours, // Assuming 40h work week
        };
      }) || [];
    },
    enabled: !!currentWorkspace?.id,
  });
};
