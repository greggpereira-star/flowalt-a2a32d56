import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PartyPopper, Music } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { useBadges } from '@/hooks/useBadges';

interface CarnivalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CarnivalModal: React.FC<CarnivalModalProps> = ({ open, onOpenChange }) => {
  const { fireCarnivalConfetti, prefersReducedMotion, closeModal } = useHolidayEffects({ 
    holiday: 'carnival',
    enabled: false 
  });
  const { earnBadge, hasBadge } = useBadges();
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (open) {
      setCelebrating(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && !prefersReducedMotion) {
      setTimeout(() => {
        fireCarnivalConfetti();
      }, 500);
    }
  }, [open, prefersReducedMotion, fireCarnivalConfetti]);

  const handleCelebrate = () => {
    setCelebrating(true);
    fireCarnivalConfetti();
    
    if (!hasBadge('carnival_celebrated')) {
      earnBadge.mutate('carnival_celebrated');
    }

    setTimeout(() => {
      closeModal();
      onOpenChange(false);
    }, 3000);
  };

  const handleClose = () => {
    closeModal();
    onOpenChange(false);
  };

  const carnivalColors = ['#9333ea', '#eab308', '#22c55e', '#3b82f6', '#f43f5e', '#ff0080'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-lg border-0 overflow-hidden"
        hideCloseButton
      >
        {/* Carnival gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-yellow-400 to-green-500 -z-10">
          {/* Confetti particles */}
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                width: `${Math.random() * 10 + 5}px`,
                height: `${Math.random() * 10 + 5}px`,
                backgroundColor: carnivalColors[i % carnivalColors.length],
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 4 + 5}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}

          {/* Music notes */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`note-${i}`}
              className="absolute text-2xl opacity-30 animate-float"
              style={{
                left: `${Math.random() * 90 + 5}%`,
                top: `${Math.random() * 90 + 5}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 3 + 4}s`,
              }}
            >
              {['🎵', '🎶', '🎷', '🥁', '🎺'][i % 5]}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4 text-center text-white">
          {/* Main decoration */}
          <div className="relative mb-6">
            {!celebrating ? (
              <div className="relative animate-egg-wobble">
                <div className="text-7xl">🎭</div>
                <div className="absolute -top-3 -right-3 text-2xl animate-bounce">🎊</div>
              </div>
            ) : (
              <div className="relative animate-scale-in">
                <div className="text-7xl">🥳</div>
                <div className="absolute -top-2 -right-2 text-3xl animate-sparkle">🎉</div>
                <div className="absolute -bottom-2 -left-2 text-2xl animate-pulse">💃</div>
              </div>
            )}
          </div>

          {/* Decorations */}
          <div className="absolute top-20 left-8">
            <Music className="w-8 h-8 text-white/40" />
          </div>
          <div className="absolute top-24 right-10">
            <PartyPopper className="w-6 h-6 text-white/40" />
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
            {celebrating ? 'Olê, Olê, Olá!' : 'É Carnaval!'}
          </h2>

          {/* Message */}
          <p className="text-lg text-white/90 mb-8 max-w-sm">
            {celebrating 
              ? 'Que o espírito do Carnaval traga alegria, energia e muita diversão para o seu dia! Sambe, dance e celebre! 🎭💃🕺'
              : 'A maior festa do mundo chegou! Vamos celebrar com muita alegria!'
            }
          </p>

          {/* Action buttons */}
          {!celebrating ? (
            <Button
              onClick={handleCelebrate}
              className="bg-gradient-to-r from-pink-500 via-yellow-500 to-green-500 hover:from-pink-600 hover:via-yellow-600 hover:to-green-600 text-white font-bold px-8 py-3 text-lg rounded-full shadow-lg shadow-pink-500/30 transition-all hover:scale-105"
            >
              <PartyPopper className="w-5 h-5 mr-2" />
              Cair na Folia!
            </Button>
          ) : (
            <div className="flex gap-2 text-4xl animate-fade-in">
              <span className="animate-bounce" style={{ animationDelay: '0s' }}>🎭</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🎉</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>💃</span>
              <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🕺</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🥁</span>
            </div>
          )}

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
