import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lê e persiste a preferência `hide_birthday_celebration` em profiles.
 * Permite ao usuário desativar permanentemente o modal de celebração.
 */
export function useBirthdayCelebrationPref() {
  const { user } = useAuth();
  const [hideCelebration, setHideCelebration] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setHideCelebration(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('profiles')
      .select('hide_birthday_celebration')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setHideCelebration(Boolean(data?.hide_birthday_celebration));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const setPreference = useCallback(
    async (value: boolean) => {
      if (!user?.id) return;
      setHideCelebration(value);
      const { error } = await supabase
        .from('profiles')
        .update({ hide_birthday_celebration: value })
        .eq('id', user.id);
      if (error) {
        // Reverte em caso de erro
        setHideCelebration((prev) => (prev === value ? !value : prev));
        throw error;
      }
    },
    [user?.id],
  );

  return { hideCelebration: hideCelebration ?? false, loading, setPreference };
}
