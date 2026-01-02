import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gift, TreePine, Snowflake } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { useBadges } from '@/hooks/useBadges';

interface ChristmasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChristmasModal: React.FC<ChristmasModalProps> = ({ open, onOpenChange }) => {
  const { fireChristmasSnow, prefersReducedMotion, closeModal } = useHolidayEffects({ 
    holiday: 'christmas',
    enabled: false 
  });
  const { earnBadge, hasBadge } = useBadges();
  const [giftOpened, setGiftOpened] = useState(false);

  useEffect(() => {
    if (open) {
      setGiftOpened(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && !prefersReducedMotion) {
      setTimeout(() => {
        fireChristmasSnow();
      }, 500);
    }
  }, [open, prefersReducedMotion, fireChristmasSnow]);

  const handleOpenGift = () => {
    setGiftOpened(true);
    fireChristmasSnow();
    
    if (!hasBadge('christmas_celebrated')) {
      earnBadge.mutate('christmas_celebrated');
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
        {/* Christmas gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-red-700 to-green-900 -z-10">
          {/* Snow particles */}
          {Array.from({ length: 25 }).map((_, i) => (
            <Snowflake
              key={i}
              className="absolute text-white/40 animate-snow-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 5 + 8}s`,
                width: `${Math.random() * 12 + 8}px`,
                height: `${Math.random() * 12 + 8}px`,
              }}
            />
          ))}

          {/* Christmas lights border */}
          <div className="absolute top-0 left-0 right-0 h-4 flex justify-around">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full animate-christmas-lights"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  backgroundColor: ['#ff0000', '#00ff00', '#ffff00', '#0000ff'][i % 4],
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4 text-center text-white">
          {/* Main decoration */}
          <div className="relative mb-6">
            {!giftOpened ? (
              <div className="relative animate-egg-wobble">
                <div className="text-7xl">🎁</div>
                <div className="absolute -top-3 -right-3 text-2xl animate-bounce">🎀</div>
              </div>
            ) : (
              <div className="relative animate-scale-in">
                <div className="text-7xl">🎄</div>
                <div className="absolute -top-2 -right-2 text-3xl animate-sparkle">⭐</div>
                <div className="absolute -bottom-2 -left-2 text-2xl animate-pulse">🎅</div>
              </div>
            )}
          </div>

          {/* Tree decorations */}
          <div className="absolute top-20 left-8">
            <TreePine className="w-8 h-8 text-green-400/60" />
          </div>
          <div className="absolute top-24 right-10">
            <TreePine className="w-6 h-6 text-green-400/40" />
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-red-300 via-white to-green-300 bg-clip-text text-transparent">
            {giftOpened ? 'Feliz Natal!' : 'Um presente para você!'}
          </h2>

          {/* Message */}
          <p className="text-lg text-white/90 mb-8 max-w-sm">
            {giftOpened 
              ? 'Boas festas para você e sua equipe! Que este Natal seja repleto de alegria, paz e momentos especiais! 🎄✨'
              : 'Temos uma surpresa especial de Natal para você!'
            }
          </p>

          {/* Action buttons */}
          {!giftOpened ? (
            <Button
              onClick={handleOpenGift}
              className="bg-gradient-to-r from-red-500 to-green-600 hover:from-red-600 hover:to-green-700 text-white font-bold px-8 py-3 text-lg rounded-full shadow-lg shadow-red-500/30 transition-all hover:scale-105"
            >
              <Gift className="w-5 h-5 mr-2" />
              Abrir Presente!
            </Button>
          ) : (
            <div className="flex gap-2 text-4xl animate-fade-in">
              <span className="animate-bounce" style={{ animationDelay: '0s' }}>🎉</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🎊</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🎁</span>
              <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🎄</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>⭐</span>
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
