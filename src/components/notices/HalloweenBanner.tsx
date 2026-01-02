import React, { useState } from 'react';
import { X, Ghost, Skull } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { HalloweenModal } from './HalloweenModal';

interface HalloweenBannerProps {
  onDismiss?: () => void;
}

export const HalloweenBanner: React.FC<HalloweenBannerProps> = ({ onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { fireMiniEffect, clickCount } = useHolidayEffects({ 
    holiday: 'halloween',
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
          background: 'linear-gradient(135deg, #f97316 0%, #7c3aed 50%, #1f2937 100%)',
        }}
      >
        {/* Floating spooky elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                fontSize: `${Math.random() * 12 + 12}px`,
                opacity: 0.3,
              }}
            >
              {['👻', '🦇', '🕷️', '🕸️', '💀'][i % 5]}
            </div>
          ))}
        </div>

        {/* Bats flying */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`bat-${i}`}
              className="absolute text-lg animate-bat-fly"
              style={{
                left: '-20px',
                top: `${20 + i * 15}%`,
                animationDelay: `${i * 0.8}s`,
              }}
            >
              🦇
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-3xl">
              <span className="animate-bounce">🎃</span>
              <span className="animate-pulse">👻</span>
            </div>

            <div className="text-white">
              <p className="font-bold text-lg flex items-center gap-2">
                Halloween! 
                <Skull className="w-4 h-4 text-orange-300" />
              </p>
              <p className="text-sm text-white/80">
                Gostosuras ou travessuras?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/30 hover:bg-orange-500/40 text-white rounded-full text-sm font-medium transition-colors backdrop-blur-sm"
            >
              <Ghost className="w-4 h-4" />
              Assustar
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
            Os fantasmas estão chegando! 👻 ({clickCount}/5)
          </p>
        )}
        {clickCount >= 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white animate-pulse">
            Buuuu! Noite de terror! 👻🎃💀
          </p>
        )}
      </div>

      <HalloweenModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
};
