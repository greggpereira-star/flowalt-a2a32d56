import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flame } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { useBadges } from '@/hooks/useBadges';

interface FestaJuninaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FestaJuninaModal: React.FC<FestaJuninaModalProps> = ({ open, onOpenChange }) => {
  const { fireFestaJuninaConfetti, prefersReducedMotion, closeModal } = useHolidayEffects({ 
    holiday: 'festa_junina',
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
        fireFestaJuninaConfetti();
      }, 500);
    }
  }, [open, prefersReducedMotion, fireFestaJuninaConfetti]);

  const handleCelebrate = () => {
    setCelebrating(true);
    fireFestaJuninaConfetti();
    
    if (!hasBadge('festa_junina_celebrated')) {
      earnBadge.mutate('festa_junina_celebrated');
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
        {/* Festa Junina gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-yellow-500 to-red-600 -z-10">
          {/* Bandeirinhas */}
          <div className="absolute top-0 left-0 right-0 h-8 flex justify-around items-start">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-6 animate-sway"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                  backgroundColor: ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#9333ea'][i % 5],
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>

          {/* Floating elements */}
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={`elem-${i}`}
              className="absolute text-2xl opacity-30 animate-float"
              style={{
                left: `${Math.random() * 90 + 5}%`,
                top: `${Math.random() * 90 + 5}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            >
              {['🌽', '🔥', '🎵', '🥜', '🎸'][i % 5]}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4 text-center text-white">
          {/* Main decoration */}
          <div className="relative mb-6">
            {!celebrating ? (
              <div className="relative animate-egg-wobble">
                <div className="text-7xl">🌽</div>
                <div className="absolute -top-3 -right-3 text-2xl animate-bounce">🔥</div>
              </div>
            ) : (
              <div className="relative animate-scale-in">
                <div className="text-7xl">🎸</div>
                <div className="absolute -top-2 -right-2 text-3xl animate-sparkle">🎵</div>
                <div className="absolute -bottom-2 -left-2 text-2xl animate-pulse">💃</div>
              </div>
            )}
          </div>

          {/* Decorations */}
          <div className="absolute top-20 left-8">
            <Flame className="w-8 h-8 text-orange-300/60" />
          </div>
          <div className="absolute top-24 right-10">
            <Flame className="w-6 h-6 text-yellow-300/60" />
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-yellow-200 via-orange-200 to-red-200 bg-clip-text text-transparent">
            {celebrating ? 'Ôh do Balão!' : 'É Festa Junina!'}
          </h2>

          {/* Message */}
          <p className="text-lg text-white/90 mb-8 max-w-sm">
            {celebrating 
              ? 'Que São João abençoe sua jornada! Bora dançar forró, comer paçoca e aproveitar o arraiá! 🌽🔥🎵'
              : 'O arraiá começou! Vamos celebrar com quentão, quadrilha e muita alegria!'
            }
          </p>

          {/* Action buttons */}
          {!celebrating ? (
            <Button
              onClick={handleCelebrate}
              className="bg-gradient-to-r from-orange-600 via-yellow-500 to-red-600 hover:from-orange-700 hover:via-yellow-600 hover:to-red-700 text-white font-bold px-8 py-3 text-lg rounded-full shadow-lg shadow-orange-500/30 transition-all hover:scale-105"
            >
              <Flame className="w-5 h-5 mr-2" />
              Bora pro Arraiá!
            </Button>
          ) : (
            <div className="flex gap-2 text-4xl animate-fade-in">
              <span className="animate-bounce" style={{ animationDelay: '0s' }}>🌽</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🔥</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🎵</span>
              <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>💃</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🥜</span>
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
