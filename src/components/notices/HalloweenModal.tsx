import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Ghost, Skull } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { useBadges } from '@/hooks/useBadges';

interface HalloweenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HalloweenModal: React.FC<HalloweenModalProps> = ({ open, onOpenChange }) => {
  const { fireHalloweenConfetti, prefersReducedMotion, closeModal } = useHolidayEffects({ 
    holiday: 'halloween',
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
        fireHalloweenConfetti();
      }, 500);
    }
  }, [open, prefersReducedMotion, fireHalloweenConfetti]);

  const handleCelebrate = () => {
    setCelebrating(true);
    fireHalloweenConfetti();
    
    if (!hasBadge('halloween_celebrated')) {
      earnBadge.mutate('halloween_celebrated');
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-lg border-0 overflow-hidden"
        hideCloseButton
      >
        {/* Halloween gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600 via-purple-900 to-gray-900 -z-10">
          {/* Floating spooky elements */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 90 + 5}%`,
                top: `${Math.random() * 90 + 5}%`,
                animationDelay: `${Math.random() * 3}s`,
                fontSize: `${Math.random() * 14 + 14}px`,
                opacity: 0.3,
              }}
            >
              {['👻', '🦇', '🕷️', '💀', '🕸️'][i % 5]}
            </div>
          ))}

          {/* Spooky moon glow */}
          <div className="absolute top-10 right-10 w-16 h-16 rounded-full bg-yellow-200/20 blur-xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4 text-center text-white">
          {/* Main decoration */}
          <div className="relative mb-6">
            {!celebrating ? (
              <div className="relative animate-egg-wobble">
                <div className="text-7xl">🎃</div>
                <div className="absolute -top-3 -right-3 text-2xl animate-float">👻</div>
              </div>
            ) : (
              <div className="relative animate-scale-in">
                <div className="text-7xl">💀</div>
                <div className="absolute -top-2 -right-2 text-3xl animate-bounce">🦇</div>
                <div className="absolute -bottom-2 -left-2 text-2xl animate-pulse">🕷️</div>
              </div>
            )}
          </div>

          {/* Decorations */}
          <div className="absolute top-20 left-8">
            <Ghost className="w-8 h-8 text-white/30" />
          </div>
          <div className="absolute top-24 right-10">
            <Skull className="w-6 h-6 text-orange-300/40" />
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-orange-400 via-purple-400 to-gray-300 bg-clip-text text-transparent">
            {celebrating ? 'Buuuu!' : 'Feliz Halloween!'}
          </h2>

          {/* Message */}
          <p className="text-lg text-white/90 mb-8 max-w-sm">
            {celebrating 
              ? 'Os espíritos aprovaram! Que sua noite seja assustadoramente divertida! 👻🎃🦇'
              : 'Gostosuras ou travessuras? A noite mais assustadora do ano chegou!'
            }
          </p>

          {/* Action buttons */}
          {!celebrating ? (
            <Button
              onClick={handleCelebrate}
              className="bg-gradient-to-r from-orange-500 via-purple-600 to-gray-700 hover:from-orange-600 hover:via-purple-700 hover:to-gray-800 text-white font-bold px-8 py-3 text-lg rounded-full shadow-lg shadow-orange-500/30 transition-all hover:scale-105"
            >
              <Ghost className="w-5 h-5 mr-2" />
              Gostosuras!
            </Button>
          ) : (
            <div className="flex gap-2 text-4xl animate-fade-in">
              <span className="animate-bounce" style={{ animationDelay: '0s' }}>🎃</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>👻</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🦇</span>
              <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>💀</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🕷️</span>
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
