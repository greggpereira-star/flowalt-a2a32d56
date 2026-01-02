import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SeasonType, getHolidayConfig } from '@/lib/holidayUtils';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';

interface SeasonModalProps {
  season: SeasonType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const seasonGradients: Record<SeasonType, string> = {
  spring: 'from-pink-400 via-rose-300 to-green-400',
  summer: 'from-yellow-400 via-orange-400 to-sky-400',
  autumn: 'from-orange-500 via-amber-400 to-red-500',
  winter: 'from-slate-400 via-blue-300 to-cyan-200',
};

const seasonEmojis: Record<SeasonType, string[]> = {
  spring: ['🌸', '🌷', '🦋', '🌺', '🐝'],
  summer: ['☀️', '🌊', '🏖️', '🍉', '🌴'],
  autumn: ['🍂', '🍁', '🎃', '🌰', '🍄'],
  winter: ['❄️', '⛄', '🧣', '☕', '🎿'],
};

export const SeasonModal: React.FC<SeasonModalProps> = ({ season, open, onOpenChange }) => {
  const config = getHolidayConfig(season);
  const { fireCelebration, closeModal, prefersReducedMotion } = useHolidayEffects({ 
    holiday: season,
    enabled: false 
  });
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (open) setCelebrating(false);
  }, [open]);

  useEffect(() => {
    if (open && !prefersReducedMotion) {
      setTimeout(() => fireCelebration(), 500);
    }
  }, [open, prefersReducedMotion, fireCelebration]);

  const handleCelebrate = () => {
    setCelebrating(true);
    fireCelebration();
    setTimeout(() => {
      closeModal();
      onOpenChange(false);
    }, 3000);
  };

  const handleClose = () => {
    closeModal();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg border-0 overflow-hidden" hideCloseButton>
        <div className={`absolute inset-0 bg-gradient-to-br ${seasonGradients[season]} -z-10`}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl opacity-20 animate-float"
              style={{
                left: `${Math.random() * 90 + 5}%`,
                top: `${Math.random() * 90 + 5}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            >
              {seasonEmojis[season][i % 5]}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4 text-center text-white">
          <div className="text-7xl mb-6 animate-bounce">{config.icon}</div>

          <h2 className="text-3xl font-bold mb-3">
            {celebrating ? `${config.name}!` : `${config.name} Chegou!`}
          </h2>

          <p className="text-lg text-white/90 mb-8 max-w-sm">{config.message}</p>

          {!celebrating ? (
            <Button
              onClick={handleCelebrate}
              className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-3 text-lg rounded-full backdrop-blur-sm"
            >
              Celebrar {config.name}!
            </Button>
          ) : (
            <div className="flex gap-2 text-4xl animate-fade-in">
              {seasonEmojis[season].map((emoji, i) => (
                <span key={i} className="animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                  {emoji}
                </span>
              ))}
            </div>
          )}

          <button onClick={handleClose} className="mt-4 text-sm text-white/50 hover:text-white/80">
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
