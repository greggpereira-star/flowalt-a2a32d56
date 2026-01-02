import React, { useState } from 'react';
import { X, Gift, TreePine, Snowflake } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { ChristmasModal } from './ChristmasModal';

interface ChristmasBannerProps {
  onDismiss?: () => void;
}

export const ChristmasBanner: React.FC<ChristmasBannerProps> = ({ onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { fireMiniEffect, clickCount } = useHolidayEffects({ 
    holiday: 'christmas',
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
          background: 'linear-gradient(135deg, #166534 0%, #991b1b 50%, #166534 100%)',
        }}
      >
        {/* Christmas lights border */}
        <div className="absolute top-0 left-0 right-0 h-3 flex justify-around items-center">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-christmas-lights shadow-lg"
              style={{
                animationDelay: `${i * 0.15}s`,
                backgroundColor: ['#ff0000', '#00ff00', '#ffff00', '#0066ff', '#ff00ff'][i % 5],
                boxShadow: `0 0 6px ${['#ff0000', '#00ff00', '#ffff00', '#0066ff', '#ff00ff'][i % 5]}`,
              }}
            />
          ))}
        </div>

        {/* Snowflakes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => (
            <Snowflake
              key={i}
              className="absolute text-white/30 animate-snow-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                width: `${Math.random() * 10 + 8}px`,
                height: `${Math.random() * 10 + 8}px`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 5 + 8}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between mt-2">
          <div className="flex items-center gap-4">
            {/* Icons */}
            <div className="flex gap-2 text-3xl">
              <span className="animate-bounce">🎄</span>
              <span className="animate-pulse">🎁</span>
            </div>

            {/* Message */}
            <div className="text-white">
              <p className="font-bold text-lg flex items-center gap-2">
                Feliz Natal! 
                <TreePine className="w-4 h-4 text-green-300" />
              </p>
              <p className="text-sm text-white/80">
                Boas festas para você e sua equipe!
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/30 hover:bg-red-500/40 text-white rounded-full text-sm font-medium transition-colors"
            >
              <Gift className="w-4 h-4" />
              Abrir Presente
            </button>
            
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* Easter egg hint */}
        {clickCount > 0 && clickCount < 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white/60 animate-fade-in">
            Mais neve chegando... ❄️ ({clickCount}/5)
          </p>
        )}
        {clickCount >= 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white animate-pulse">
            Nevasca ativada! ⛄❄️✨
          </p>
        )}
      </div>

      <ChristmasModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
};
