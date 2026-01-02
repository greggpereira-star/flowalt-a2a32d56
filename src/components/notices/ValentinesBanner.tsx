import React, { useState } from 'react';
import { X, Heart } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { ValentinesModal } from './ValentinesModal';

interface ValentinesBannerProps {
  onDismiss?: () => void;
}

export const ValentinesBanner: React.FC<ValentinesBannerProps> = ({ onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { fireMiniEffect, clickCount } = useHolidayEffects({ 
    holiday: 'valentines',
    enabled: false 
  });

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleBannerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    fireMiniEffect();
  };

  if (dismissed) return null;

  return (
    <>
      <div
        onClick={handleBannerClick}
        className="relative overflow-hidden rounded-xl p-4 mb-4 cursor-pointer select-none transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #ef4444 100%)',
        }}
      >
        {/* Floating hearts */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-float-up"
              style={{
                left: `${Math.random() * 100}%`,
                bottom: '-20px',
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 4 + 6}s`,
              }}
            >
              <Heart 
                className="text-white/30"
                fill="currentColor"
                style={{
                  width: `${Math.random() * 12 + 8}px`,
                  height: `${Math.random() * 12 + 8}px`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-3xl">
              <span className="animate-pulse">💕</span>
              <span className="animate-bounce">💘</span>
            </div>

            <div className="text-white">
              <p className="font-bold text-lg flex items-center gap-2">
                Dia dos Namorados! 
                <Heart className="w-4 h-4 text-pink-200 fill-current" />
              </p>
              <p className="text-sm text-white/80">
                Celebre o amor com quem você ama!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-medium transition-colors backdrop-blur-sm"
            >
              <Heart className="w-4 h-4" />
              Celebrar
            </button>
            
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {clickCount > 0 && clickCount < 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white/60 animate-fade-in">
            O amor está no ar! 💕 ({clickCount}/5)
          </p>
        )}
        {clickCount >= 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white animate-pulse">
            Amor infinito! 💕💘💖
          </p>
        )}
      </div>

      <ValentinesModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
};
