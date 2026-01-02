import React, { useEffect, useState, useCallback } from 'react';
import { useNotices } from '@/hooks/useNoticesModule';
import { X, PartyPopper, Cake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Confetti particle component
const Confetti: React.FC<{ delay: number; left: number }> = ({ delay, left }) => {
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9ff3', '#ffeaa7'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return (
    <div
      className="absolute w-2 h-2 rounded-sm animate-confetti pointer-events-none"
      style={{
        left: `${left}%`,
        backgroundColor: color,
        animationDelay: `${delay}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      }}
    />
  );
};

// Balloon component
const Balloon: React.FC<{ left: number; delay: number; color: string }> = ({ left, delay, color }) => (
  <div
    className="absolute bottom-0 animate-float-up pointer-events-none"
    style={{ left: `${left}%`, animationDelay: `${delay}s` }}
  >
    <div
      className="w-6 h-8 rounded-full opacity-80"
      style={{ backgroundColor: color }}
    />
    <div className="w-px h-12 bg-muted-foreground/30 mx-auto" />
  </div>
);

export const BirthdayBanner: React.FC = () => {
  const { birthdayNotices, markAsRead } = useNotices();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showEffects, setShowEffects] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  const activeBirthdays = birthdayNotices.filter(n => !dismissed.includes(n.id));

  useEffect(() => {
    // Show effects only once per session
    if (activeBirthdays.length > 0 && !prefersReducedMotion) {
      const sessionKey = `birthday-effects-${new Date().toDateString()}`;
      if (!sessionStorage.getItem(sessionKey)) {
        setShowEffects(true);
        sessionStorage.setItem(sessionKey, 'shown');
        // Auto-hide effects after 5 seconds
        const timer = setTimeout(() => setShowEffects(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [activeBirthdays.length, prefersReducedMotion]);

  const handleDismiss = useCallback((noticeId: string) => {
    setDismissed(prev => [...prev, noticeId]);
    markAsRead.mutate(noticeId);
  }, [markAsRead]);

  if (activeBirthdays.length === 0) return null;

  return (
    <>
      {/* Confetti Effect */}
      {showEffects && (
        <div className="fixed inset-x-0 top-0 h-screen overflow-hidden pointer-events-none z-50">
          {Array.from({ length: 30 }).map((_, i) => (
            <Confetti key={i} delay={Math.random() * 2} left={Math.random() * 100} />
          ))}
          {/* Balloons */}
          <Balloon left={5} delay={0} color="#ff6b6b" />
          <Balloon left={15} delay={0.5} color="#ffd93d" />
          <Balloon left={85} delay={0.3} color="#6bcb77" />
          <Balloon left={95} delay={0.8} color="#4d96ff" />
        </div>
      )}

      {/* Birthday Banners */}
      <div className="space-y-2">
        {activeBirthdays.map(notice => (
          <div
            key={notice.id}
            className={cn(
              'relative overflow-hidden rounded-lg border border-pink-200 dark:border-pink-800',
              'bg-gradient-to-r from-pink-50 via-amber-50 to-pink-50',
              'dark:from-pink-950/30 dark:via-amber-950/30 dark:to-pink-950/30',
              'p-4 animate-fade-in'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/50">
                <Cake className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-amber-500" />
                  {notice.title}
                  <PartyPopper className="h-4 w-4 text-amber-500 scale-x-[-1]" />
                </p>
                {notice.content && (
                  <p className="text-sm text-muted-foreground">{notice.content}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleDismiss(notice.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

// Add required CSS animations to index.css
export const birthdayAnimationsCSS = `
@keyframes confetti {
  0% {
    transform: translateY(-10px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

@keyframes float-up {
  0% {
    transform: translateY(100vh);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px);
    opacity: 0;
  }
}

.animate-confetti {
  animation: confetti 3s ease-out forwards;
}

.animate-float-up {
  animation: float-up 4s ease-out forwards;
}
`;
