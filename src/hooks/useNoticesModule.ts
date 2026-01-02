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
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['active', 'closed'])
        .order('starts_at', { ascending: false });
      if (error) throw error;
      return data as Notice[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: readNotices = [] } = useQuery({
    queryKey: ['notice-reads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(r => r.notice_id);
    },
    enabled: !!user?.id,
  });

  const unreadNotices = notices.filter(n => !readNotices.includes(n.id));
  const birthdayNotices = notices.filter(n => n.category === 'birthday' && n.status === 'active');

  const markAsRead = useMutation({
    mutationFn: async (noticeId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('notice_reads')
        .upsert({ notice_id: noticeId, user_id: user.id }, { onConflict: 'notice_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notice-reads'] }),
  });

  const confirmNotice = useMutation({
    mutationFn: async (noticeId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('notice_reads')
        .upsert({ notice_id: noticeId, user_id: user.id, confirmed_at: new Date().toISOString() }, { onConflict: 'notice_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notice-reads'] });
      toast.success('Confirmação registrada');
    },
  });

  return { notices, unreadNotices, birthdayNotices, isLoading, markAsRead, confirmNotice, readNotices };
}

export function useUserBirthday() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: birthday, isLoading } = useQuery({
    queryKey: ['user-birthday', user?.id, currentWorkspace?.id],
    queryFn: async () => {
      if (!user?.id || !currentWorkspace?.id) return null;
      const { data, error } = await supabase
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
      const { error } = await supabase
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
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      
      const { data, error } = await supabase
        .from('user_birthdays')
        .select('user_id, visibility')
        .eq('workspace_id', currentWorkspace.id)
        .neq('visibility', 'private');
      
      if (error) throw error;
      
      // Filter by month/day (can't do this in RPC easily without exposing date)
      // For now return all public birthdays - actual filtering happens in generate_birthday_notices
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });
}
