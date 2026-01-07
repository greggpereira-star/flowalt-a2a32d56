import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { differenceInDays, getMonth, getDate, setYear, startOfDay, isSameDay } from 'date-fns';

export interface BirthdayMember {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  birthday: string; // ISO date string (YYYY-MM-DD)
  role: string | null;
  days_until: number; // Days until next birthday
  is_today: boolean;
}

/**
 * Hook to fetch workspace members with upcoming birthdays
 */
export function useBirthdays(month?: number) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['birthdays', currentWorkspace?.id, month],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get workspace members
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // Get profiles with birthday info
      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, birthday')
        .in('id', userIds);

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      const today = startOfDay(new Date());
      const currentYear = today.getFullYear();

      // Map profiles to birthday members with days until calculation
      const birthdayMembers: BirthdayMember[] = profiles
        .filter(p => p.birthday)
        .map(profile => {
          const birthdayDate = new Date(profile.birthday!);
          
          // Calculate next birthday
          let nextBirthday = setYear(birthdayDate, currentYear);
          nextBirthday = startOfDay(nextBirthday);
          
          // If birthday already passed this year, use next year
          if (nextBirthday < today) {
            nextBirthday = setYear(birthdayDate, currentYear + 1);
            nextBirthday = startOfDay(nextBirthday);
          }
          
          const daysUntil = differenceInDays(nextBirthday, today);
          const isToday = isSameDay(nextBirthday, today);

          return {
            user_id: profile.id,
            full_name: profile.full_name || profile.email || 'Usuário',
            email: profile.email || '',
            avatar_url: profile.avatar_url,
            birthday: profile.birthday!,
            role: null,
            days_until: daysUntil,
            is_today: isToday,
          };
        })
        // Filter by month if specified
        .filter(member => {
          if (month === undefined) return true;
          const birthdayMonth = getMonth(new Date(member.birthday));
          return birthdayMonth === month;
        })
        // Sort by days until birthday
        .sort((a, b) => a.days_until - b.days_until);

      return birthdayMembers;
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to get birthdays for current month
 */
export function useCurrentMonthBirthdays() {
  const currentMonth = getMonth(new Date());
  return useBirthdays(currentMonth);
}

/**
 * Hook to get today's birthdays
 */
export function useTodayBirthdays() {
  const { data: allBirthdays, ...rest } = useBirthdays();
  
  return {
    ...rest,
    data: allBirthdays?.filter(b => b.is_today) || [],
  };
}
