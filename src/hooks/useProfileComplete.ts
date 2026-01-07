import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ProfileStatus {
  isComplete: boolean;
  hasBirthday: boolean;
  hasAvatar: boolean;
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    birthday: string | null;
  } | null;
}

/**
 * Hook to check if user profile has required fields filled
 * Required: birthday AND avatar_url
 */
export function useProfileComplete() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile-complete', user?.id],
    queryFn: async (): Promise<ProfileStatus> => {
      if (!user?.id) {
        return {
          isComplete: false,
          hasBirthday: false,
          hasAvatar: false,
          profile: null,
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, birthday')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      const hasBirthday = !!data?.birthday;
      const hasAvatar = !!data?.avatar_url;

      return {
        isComplete: hasBirthday && hasAvatar,
        hasBirthday,
        hasAvatar,
        profile: data,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
