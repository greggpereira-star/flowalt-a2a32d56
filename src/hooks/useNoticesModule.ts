import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Notice {
  id: string;
  workspace_id: string;
  title: string;
  content: string | null;
  category: 'general' | 'urgent' | 'celebration' | 'holiday' | 'birthday' | 'maintenance' | 'policy';
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'draft' | 'scheduled' | 'active' | 'closed' | 'archived';
  requires_confirmation: boolean;
  target_roles: string[];
  starts_at: string;
  ends_at: string | null;
  auto_generated: boolean;
  source_type: 'manual' | 'calendar_event' | 'birthday' | 'system' | null;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NoticeRead {
  id: string;
  notice_id: string;
  user_id: string;
  read_at: string;
  confirmed_at: string | null;
}

export interface NoticeConfirmation {
  id: string;
  notice_id: string;
  user_id: string;
  confirmed_at: string;
  user_email?: string;
  user_name?: string;
  avatar_url?: string;
}

export interface UserBirthday {
  user_id: string;
  workspace_id: string;
  birth_date: string;
  visibility: 'public' | 'team' | 'private';
}

export function useNotices() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['notices', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await (supabase as any)
        .from('notices')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['active', 'closed'])
        .order('starts_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Notice[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: readNotices = [] } = useQuery({
    queryKey: ['notice-reads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await (supabase as any)
        .from('notice_reads')
        .select('notice_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.notice_id) as string[];
    },
    enabled: !!user?.id,
  });

  const unreadNotices = notices.filter(n => !readNotices.includes(n.id));
  const birthdayNotices = notices.filter(n => n.category === 'birthday' && n.status === 'active');

  const markAsRead = useMutation({
    mutationFn: async (noticeId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await (supabase as any)
        .from('notice_reads')
        .upsert({ notice_id: noticeId, user_id: user.id }, { onConflict: 'notice_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notice-reads'] }),
  });

  const confirmNotice = useMutation({
    mutationFn: async (noticeId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await (supabase as any)
        .from('notice_reads')
        .upsert({ 
          notice_id: noticeId, 
          user_id: user.id, 
          read_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString() 
        }, { onConflict: 'notice_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notice-reads'] });
      queryClient.invalidateQueries({ queryKey: ['notice-confirmations'] });
      toast.success('Confirmação registrada');
    },
  });

  return { notices, unreadNotices, birthdayNotices, isLoading, markAsRead, confirmNotice, readNotices };
}

export function useNoticeConfirmations(noticeId: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['notice-confirmations', noticeId],
    queryFn: async () => {
      if (!noticeId) return [];
      
      // Get confirmations
      const { data: reads, error: readsError } = await (supabase as any)
        .from('notice_reads')
        .select('id, notice_id, user_id, read_at, confirmed_at')
        .eq('notice_id', noticeId)
        .not('confirmed_at', 'is', null);
      
      if (readsError) throw readsError;
      
      if (!reads || reads.length === 0) return [];

      // Get user info from profiles table
      const userIds = reads.map((r: any) => r.user_id);
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map((p: { id: string; email: string; full_name: string | null; avatar_url: string | null }) => [p.id, p]));

      return reads.map((r: any) => {
        const profile = profileMap.get(r.user_id) as { email: string; full_name: string | null; avatar_url: string | null } | undefined;
        return {
          id: r.id,
          notice_id: r.notice_id,
          user_id: r.user_id,
          confirmed_at: r.confirmed_at,
          user_email: profile?.email || 'Usuário desconhecido',
          user_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
        };
      }) as NoticeConfirmation[];
    },
    enabled: !!noticeId && !!currentWorkspace?.id,
  });
}

export function useNoticeStats(noticeId: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['notice-stats', noticeId],
    queryFn: async () => {
      if (!noticeId || !currentWorkspace?.id) return null;
      
      // Count total workspace members
      const { count: totalMembers, error: membersError } = await (supabase as any)
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);
      
      if (membersError) throw membersError;

      // Count confirmations for this notice
      const { count: confirmations, error: confirmError } = await (supabase as any)
        .from('notice_reads')
        .select('*', { count: 'exact', head: true })
        .eq('notice_id', noticeId)
        .not('confirmed_at', 'is', null);
      
      if (confirmError) throw confirmError;

      return {
        totalMembers: totalMembers || 0,
        confirmations: confirmations || 0,
        percentage: totalMembers ? Math.round((confirmations || 0) / totalMembers * 100) : 0,
      };
    },
    enabled: !!noticeId && !!currentWorkspace?.id,
  });
}

export function useUserBirthday() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: birthday, isLoading } = useQuery({
    queryKey: ['user-birthday', user?.id, currentWorkspace?.id],
    queryFn: async () => {
      if (!user?.id || !currentWorkspace?.id) return null;
      const { data, error } = await (supabase as any)
        .from('user_birthdays')
        .select('*')
        .eq('user_id', user.id)
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserBirthday | null;
    },
    enabled: !!user?.id && !!currentWorkspace?.id,
  });

  const saveBirthday = useMutation({
    mutationFn: async (data: { birth_date: string; visibility: 'public' | 'team' | 'private' }) => {
      if (!user?.id || !currentWorkspace?.id) throw new Error('Not authenticated');
      const { error } = await (supabase as any)
        .from('user_birthdays')
        .upsert({ user_id: user.id, workspace_id: currentWorkspace.id, ...data }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-birthday'] });
      toast.success('Aniversário salvo');
    },
  });

  return { birthday, isLoading, saveBirthday };
}

export function useTodaysBirthdays() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['todays-birthdays', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await (supabase as any)
        .from('user_birthdays')
        .select('user_id, visibility')
        .eq('workspace_id', currentWorkspace.id)
        .neq('visibility', 'private');
      
      if (error) throw error;
      return (data || []) as { user_id: string; visibility: string }[];
    },
    enabled: !!currentWorkspace?.id,
  });
}
