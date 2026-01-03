import React, { useState, useCallback } from 'react';
import { useNotices } from '@/hooks/useNoticesModule';
import { X, PartyPopper, Cake, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBirthdayEffects } from '@/hooks/useBirthdayEffects';
import { BirthdayCelebrationModal } from './BirthdayCelebrationModal';
import { useAuth } from '@/contexts/AuthContext';

export function BirthdayBanner() {
  const { user } = useAuth();
  const { birthdayNotices, markAsRead } = useNotices();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(true);
  
  const {
    fireMiniConfetti,
    shouldShowModal,
    clickCount,
    prefersReducedMotion,
  } = useBirthdayEffects({ enabled: true });

  const activeBirthdays = birthdayNotices.filter(n => !dismissed.includes(n.id));

  // Check if today is the current user's birthday
  const isMyBirthday = activeBirthdays.some(notice => 
    notice.source_id === user?.id
  );

  const handleDismiss = useCallback((noticeId: string) => {
    setDismissed(prev => [...prev, noticeId]);
    markAsRead.mutate(noticeId);
  }, [markAsRead]);

  const handleBannerClick = useCallback(() => {
    if (!prefersReducedMotion) {
      fireMiniConfetti();
    }
  }, [fireMiniConfetti, prefersReducedMotion]);

  if (activeBirthdays.length === 0) return null;

  return (
    <>
      {/* Birthday Celebration Modal - only for the birthday person */}
      {isMyBirthday && shouldShowModal && (
        <BirthdayCelebrationModal
          open={showModal}
          onOpenChange={setShowModal}
          userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Você'}
        />
      )}

      {/* Birthday Banners */}
      <div className="space-y-2">
        {activeBirthdays.map(notice => (
          <div
            key={notice.id}
            onClick={handleBannerClick}
            className={cn(
              'relative overflow-hidden rounded-lg border',
              'border-amber-200 dark:border-amber-800',
              'bg-gradient-to-r from-amber-50 via-pink-50 to-purple-50',
              'dark:from-amber-950/40 dark:via-pink-950/40 dark:to-purple-950/40',
              'p-4 animate-fade-in cursor-pointer',
              'transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10',
              'hover:scale-[1.01]',
              // Birthday glow effect
              isMyBirthday && 'ring-2 ring-amber-400/50 shadow-lg shadow-amber-400/20'
            )}
          >
            {/* Sparkle decorations */}
            {!prefersReducedMotion && (
              <>
                <Sparkles className="absolute top-2 right-12 h-4 w-4 text-amber-400 animate-pulse" />
                <Sparkles className="absolute bottom-2 left-12 h-3 w-3 text-pink-400 animate-pulse delay-300" />
              </>
            )}

            <div className="flex items-center gap-3">
              <div className={cn(
                'flex items-center justify-center w-12 h-12 rounded-full',
                'bg-gradient-to-br from-amber-100 to-pink-100',
                'dark:from-amber-900/50 dark:to-pink-900/50',
                isMyBirthday && 'animate-pulse-glow'
              )}>
                <Cake className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-amber-500" />
                  {notice.title}
                  <PartyPopper className="h-4 w-4 text-amber-500 scale-x-[-1]" />
                </p>
                {notice.content && (
                  <p className="text-sm text-muted-foreground">{notice.content}</p>
                )}
                {/* Easter egg hint */}
                {clickCount > 0 && clickCount < 5 && (
                  <p className="text-xs text-amber-500 mt-1 animate-fade-in">
                    🎉 Continue clicando para mais confetes! ({5 - clickCount} restantes)
                  </p>
                )}
                {clickCount >= 5 && (
                  <p className="text-xs text-pink-500 mt-1 animate-fade-in">
                    🎊 Máximo de confetes desbloqueado! 🎊
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(notice.id);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
