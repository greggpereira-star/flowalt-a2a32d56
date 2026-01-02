import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Egg } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { useBadges } from '@/hooks/useBadges';

interface EasterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EasterModal: React.FC<EasterModalProps> = ({ open, onOpenChange }) => {
  const { fireEasterConfetti, prefersReducedMotion, closeModal } = useHolidayEffects({ 
    holiday: 'easter',
    enabled: false 
  });
  const { earnBadge, hasBadge } = useBadges();
  const [eggCracked, setEggCracked] = useState(false);

  useEffect(() => {
    if (open) {
      setEggCracked(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && !prefersReducedMotion) {
      setTimeout(() => {
        fireEasterConfetti();
      }, 500);
    }
  }, [open, prefersReducedMotion, fireEasterConfetti]);

  const handleCrackEgg = () => {
    setEggCracked(true);
    fireEasterConfetti();
    
    if (!hasBadge('easter_celebrated')) {
      earnBadge.mutate('easter_celebrated');
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

  // Pastel colors for decorations
  const pastelColors = ['#FFB6C1', '#DDA0DD', '#B0E0E6', '#98FB98', '#FAFAD2', '#FFE4B5'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-lg border-0 overflow-hidden"
        hideCloseButton
      >
        {/* Pastel gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 -z-10">
          {/* Floating eggs pattern */}
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl opacity-20 animate-float"
              style={{
                left: `${Math.random() * 90 + 5}%`,
                top: `${Math.random() * 90 + 5}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 3 + 4}s`,
              }}
            >
              🥚
            </div>
          ))}

          {/* Flower decorations */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`flower-${i}`}
              className="absolute text-xl opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
            >
              {['🌸', '🌷', '🌼', '🌺'][i % 4]}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4 text-center">
          {/* Main decoration */}
          <div className="relative mb-6">
            {!eggCracked ? (
              <div className="relative">
                <div 
                  className="text-8xl animate-egg-wobble cursor-pointer"
                  onClick={handleCrackEgg}
                >
                  🥚
                </div>
                {/* Decorative stripes on egg */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {pastelColors.slice(0, 3).map((color, i) => (
                    <div
                      key={i}
                      className="absolute w-12 h-1 rounded-full opacity-60"
                      style={{
                        backgroundColor: color,
                        top: `${35 + i * 15}%`,
                        transform: 'rotate(-5deg)',
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative animate-scale-in">
                <div className="text-7xl">🐰</div>
                <div className="absolute -top-2 -right-4 text-3xl animate-bounce">🐣</div>
                <div className="absolute -bottom-2 -left-4 text-2xl animate-pulse">🌷</div>
              </div>
            )}
          </div>

          {/* Bunny ears decoration */}
          {!eggCracked && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 flex gap-6 -z-10 opacity-30">
              <span className="text-5xl transform -rotate-12">👂</span>
              <span className="text-5xl transform rotate-12 scale-x-[-1]">👂</span>
            </div>
          )}

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            {eggCracked ? 'Feliz Páscoa!' : 'Hora de Celebrar!'}
          </h2>

          {/* Message */}
          <p className="text-lg text-purple-800/90 mb-8 max-w-sm">
            {eggCracked 
              ? 'Renove suas energias e continue conquistando seus objetivos! Que esta Páscoa traga renovação e esperança! 🐰🌸'
              : 'Temos uma surpresa de Páscoa para você! Clique no ovo para descobrir!'
            }
          </p>

          {/* Action buttons */}
          {!eggCracked ? (
            <Button
              onClick={handleCrackEgg}
              className="bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white font-bold px-8 py-3 text-lg rounded-full shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
            >
              <Egg className="w-5 h-5 mr-2" />
              Quebrar o Ovo!
            </Button>
          ) : (
            <div className="flex gap-2 text-4xl animate-fade-in">
              <span className="animate-bounce" style={{ animationDelay: '0s' }}>🐰</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🥚</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🐣</span>
              <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🌸</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🍫</span>
            </div>
          )}

          {/* Skip link */}
          <button
            onClick={handleClose}
            className="mt-4 text-sm text-purple-600/50 hover:text-purple-600/80 transition-colors"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
