import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayBirthdays } from '@/hooks/useBirthdays';
import { BirthdayCelebrationModal } from './BirthdayCelebrationModal';

/**
 * Detecta se hoje é o aniversário do usuário logado e dispara o modal
 * de celebração com confete. Independente do sistema de notices —
 * funciona sempre que houver `birthday` preenchido no perfil.
 *
 * O modal usa sessionStorage para evitar reaparecer várias vezes no mesmo dia.
 */
export function MyBirthdayCelebration() {
  const { user } = useAuth();
  const { data: birthdays = [], isLoading } = useTodayBirthdays();
  const [open, setOpen] = useState(false);

  const isMyBirthday = !isLoading && birthdays.some((b) => b.user_id === user?.id);

  useEffect(() => {
    if (!isMyBirthday) return;
    const key = `birthday-modal-${new Date().toDateString()}`;
    if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
      setOpen(true);
    }
  }, [isMyBirthday]);

  if (!isMyBirthday) return null;

  const userName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Você';

  return (
    <BirthdayCelebrationModal
      open={open}
      onOpenChange={setOpen}
      userName={userName}
    />
  );
}
