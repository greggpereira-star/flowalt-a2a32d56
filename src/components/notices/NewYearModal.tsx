import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, PartyPopper } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { getTimeUntilMidnight, isNewYearsEveEvening } from '@/lib/holidayUtils';
import { useBadges } from '@/hooks/useBadges';

interface NewYearModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewYearModal: React.FC<NewYearModalProps> = ({ open, onOpenChange }) => {
  const { fireNewYearFireworks, prefersReducedMotion, closeModal } = useHolidayEffects({ 
    holiday: 'new_year',
    enabled: false 
  });
  const { earnBadge, hasBadge } = useBadges();
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  const showCountdown = isNewYearsEveEvening();

  useEffect(() => {
    if (!showCountdown || !open) return;

    const interval = setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 1000);

    return () => clearInterval(interval);
  }, [showCountdown, open]);

  useEffect(() => {
    if (open && !prefersReducedMotion) {
      // Initial sparkle effect
      setTimeout(() => {
        fireNewYearFireworks();
      }, 500);
    }
  }, [open, prefersReducedMotion, fireNewYearFireworks]);

  const handleCelebrate = () => {
    fireNewYearFireworks();
    
    if (!hasBadge('new_year_celebrated')) {
      earnBadge.mutate('new_year_celebrated');
    }

    setTimeout(() => {
      closeModal();
      onOpenChange(false);
    }, 2000);
  };

  const handleClose = () => {
    closeModal();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-lg border-0 overflow-hidden"
        hideCloseButton
      >
        {/* Starry night background */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950 via-purple-900 to-indigo-950 -z-10">
          {/* Animated stars */}
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                opacity: Math.random() * 0.7 + 0.3,
              }}
            />
          ))}
          
          {/* Larger sparkle stars */}
          {Array.from({ length: 5 }).map((_, i) => (
            <Sparkles
              key={`sparkle-${i}`}
              className="absolute text-yellow-300 animate-pulse-glow"
              style={{
                left: `${Math.random() * 80 + 10}%`,
                top: `${Math.random() * 60 + 10}%`,
                animationDelay: `${Math.random() * 2}s`,
                width: '16px',
                height: '16px',
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4 text-center text-white">
          {/* Main icon */}
          <div className="relative mb-6">
            <div className="text-7xl animate-bounce-slow">🎆</div>
            <div className="absolute -top-2 -right-2 text-3xl animate-sparkle">✨</div>
            <div className="absolute -bottom-2 -left-2 text-3xl animate-sparkle" style={{ animationDelay: '0.5s' }}>🌟</div>
          </div>

          {/* Countdown (if New Year's Eve) */}
          {showCountdown && (
            <div className="flex items-center gap-4 mb-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
              <Clock className="w-6 h-6 text-yellow-300" />
              <div className="flex gap-3 font-mono text-2xl font-bold">
                <div className="flex flex-col items-center">
                  <span className="text-yellow-300">{String(countdown.hours).padStart(2, '0')}</span>
                  <span className="text-xs text-white/70">horas</span>
                </div>
                <span className="text-yellow-300">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-yellow-300">{String(countdown.minutes).padStart(2, '0')}</span>
                  <span className="text-xs text-white/70">min</span>
                </div>
                <span className="text-yellow-300">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-yellow-300">{String(countdown.seconds).padStart(2, '0')}</span>
                  <span className="text-xs text-white/70">seg</span>
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300 bg-clip-text text-transparent animate-gradient-shift">
            Feliz Ano Novo!
          </h2>

          {/* Message */}
          <p className="text-lg text-white/90 mb-8 max-w-sm">
            Que este ano traga novas conquistas, realizações e muita prosperidade para você e sua equipe! 🥂
          </p>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleCelebrate}
              className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-black font-bold px-8 py-3 text-lg rounded-full shadow-lg shadow-yellow-500/30 transition-all hover:scale-105"
            >
              <PartyPopper className="w-5 h-5 mr-2" />
              Começar o Ano!
            </Button>
          </div>

          {/* Skip link */}
          <button
            onClick={handleClose}
            className="mt-4 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
