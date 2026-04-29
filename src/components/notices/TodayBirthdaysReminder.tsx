import React, { useState } from 'react';
import { Cake, PartyPopper, Sparkles, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTodayBirthdays } from '@/hooks/useBirthdays';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lembrete dos aniversariantes do dia.
 * Sempre visível quando houver aniversariantes — não depende de notices.
 */
export function TodayBirthdaysReminder() {
  const { user } = useAuth();
  const { data: birthdays = [], isLoading } = useTodayBirthdays();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed) return null;

  // Filtra o próprio usuário (ele recebe um modal de celebração)
  const others = birthdays.filter((b) => b.user_id !== user?.id);

  if (others.length === 0) return null;

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const renderMessage = () => {
    if (others.length === 1) {
      const person = others[0];
      const firstName = person.full_name.split(' ')[0];
      return (
        <>
          Já lembrou de parabenizar nosso amigo{' '}
          <span className="font-semibold text-foreground">{firstName}</span>{' '}
          pelo seu aniversário? 🎉
        </>
      );
    }
    const names = others
      .map((p) => p.full_name.split(' ')[0])
      .join(', ')
      .replace(/, ([^,]*)$/, ' e $1');
    return (
      <>
        Hoje é aniversário de{' '}
        <span className="font-semibold text-foreground">{names}</span>! Não
        esqueça de parabenizar. 🎉
      </>
    );
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border',
        'border-amber-200 dark:border-amber-800',
        'bg-gradient-to-r from-amber-50 via-pink-50 to-purple-50',
        'dark:from-amber-950/40 dark:via-pink-950/40 dark:to-purple-950/40',
        'p-4 animate-fade-in transition-all duration-300',
      )}
    >
      <Sparkles className="absolute top-2 right-12 h-4 w-4 text-amber-400 animate-pulse" />
      <Sparkles className="absolute bottom-2 left-12 h-3 w-3 text-pink-400 animate-pulse delay-300" />

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded-full shrink-0',
            'bg-gradient-to-br from-amber-100 to-pink-100',
            'dark:from-amber-900/50 dark:to-pink-900/50',
          )}
        >
          <Cake className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground flex items-center gap-2">
            <PartyPopper className="h-4 w-4 text-amber-500" />
            Aniversariante{others.length > 1 ? 's' : ''} do dia
            <PartyPopper className="h-4 w-4 text-amber-500 scale-x-[-1]" />
          </p>
          <p className="text-sm text-muted-foreground">{renderMessage()}</p>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {others.map((person) => (
              <div
                key={person.user_id}
                className="flex items-center gap-2 rounded-full border border-amber-200/60 bg-background/60 dark:border-amber-800/60 px-2 py-1"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={person.avatar_url || undefined} alt={person.full_name} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(person.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground">
                  {person.full_name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          onClick={() => setDismissed(true)}
          aria-label="Dispensar lembrete"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
