import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { useBadges } from '@/hooks/useBadges';

interface ValentinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ValentinesModal: React.FC<ValentinesModalProps> = ({ open, onOpenChange }) => {
  const { fireValentinesConfetti, prefersReducedMotion, closeModal } = useHolidayEffects({ 
    holiday: 'valentines',
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
        fireValentinesConfetti();
      }, 500);
    }
  }, [open, prefersReducedMotion, fireValentinesConfetti]);

  const handleCelebrate = () => {
    setCelebrating(true);
    fireValentinesConfetti();
    
    if (!hasBadge('valentines_celebrated')) {
      earnBadge.mutate('valentines_celebrated');
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
        {/* Valentines gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 -z-10">
          {/* Floating hearts */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-float-up"
              style={{
                left: `${Math.random() * 90 + 5}%`,
                bottom: '-30px',
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 5 + 8}s`,
              }}
            >
              <Heart 
                className="text-white/30"
                fill="currentColor"
                style={{
                  width: `${Math.random() * 16 + 10}px`,
                  height: `${Math.random() * 16 + 10}px`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4 text-center text-white">
          {/* Main decoration */}
          <div className="relative mb-6">
            {!celebrating ? (
              <div className="relative animate-pulse">
                <div className="text-7xl">💕</div>
                <div className="absolute -top-3 -right-3 text-2xl animate-bounce">💘</div>
              </div>
            ) : (
              <div className="relative animate-scale-in">
                <div className="text-7xl">💖</div>
                <div className="absolute -top-2 -right-2 text-3xl animate-sparkle">✨</div>
                <div className="absolute -bottom-2 -left-2 text-2xl animate-pulse">💝</div>
              </div>
            )}
          </div>

          {/* Decorations */}
          <div className="absolute top-20 left-8">
            <Heart className="w-8 h-8 text-pink-200/40 fill-current" />
          </div>
          <div className="absolute top-24 right-10">
            <Heart className="w-6 h-6 text-red-200/40 fill-current" />
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-pink-200 via-white to-red-200 bg-clip-text text-transparent">
            {celebrating ? 'Amor Eterno!' : 'Feliz Dia dos Namorados!'}
          </h2>

          {/* Message */}
          <p className="text-lg text-white/90 mb-8 max-w-sm">
            {celebrating 
              ? 'Que o amor ilumine seu caminho e traga felicidade! Celebre cada momento com quem você ama! 💕✨'
              : 'Um dia especial para celebrar o amor em todas as suas formas!'
            }
          </p>

          {/* Action buttons */}
          {!celebrating ? (
            <Button
              onClick={handleCelebrate}
              className="bg-gradient-to-r from-pink-400 via-rose-400 to-red-400 hover:from-pink-500 hover:via-rose-500 hover:to-red-500 text-white font-bold px-8 py-3 text-lg rounded-full shadow-lg shadow-pink-500/30 transition-all hover:scale-105"
            >
              <Heart className="w-5 h-5 mr-2 fill-current" />
              Espalhar Amor!
            </Button>
          ) : (
            <div className="flex gap-2 text-4xl animate-fade-in">
              <span className="animate-bounce" style={{ animationDelay: '0s' }}>💕</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>💘</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>💖</span>
              <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>💝</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>❤️</span>
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
