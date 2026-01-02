import React, { useState } from 'react';
import { X, Egg, Flower2 } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { EasterModal } from './EasterModal';

interface EasterBannerProps {
  onDismiss?: () => void;
}

export const EasterBanner: React.FC<EasterBannerProps> = ({ onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [bunnyJump, setBunnyJump] = useState(false);
  const { fireMiniEffect, clickCount } = useHolidayEffects({ 
    holiday: 'easter',
    enabled: false 
  });

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleBannerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    fireMiniEffect();
    setBunnyJump(true);
    setTimeout(() => setBunnyJump(false), 500);
  };

  if (dismissed) return null;

  return (
    <>
      <div
        onClick={handleBannerClick}
        className="relative overflow-hidden rounded-xl p-4 mb-4 cursor-pointer select-none transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: 'linear-gradient(135deg, #fce7f3 0%, #ddd6fe 50%, #bfdbfe 100%)',
        }}
      >
        {/* Floating eggs pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-xl opacity-20 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 3 + 4}s`,
              }}
            >
              {['🥚', '🐣', '🌸', '🌷'][i % 4]}
            </div>
          ))}
        </div>

        {/* Flower decorations */}
        <div className="absolute top-2 right-20">
          <Flower2 className="w-6 h-6 text-pink-400/40" />
        </div>
        <div className="absolute bottom-2 left-20">
          <Flower2 className="w-5 h-5 text-purple-400/40" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icons */}
            <div className="flex gap-2 text-3xl">
              <span className={`${bunnyJump ? 'animate-bounce' : ''}`}>🐰</span>
              <span className="animate-pulse">🥚</span>
            </div>

            {/* Message */}
            <div className="text-purple-800">
              <p className="font-bold text-lg flex items-center gap-2">
                Feliz Páscoa! 
                <span className="text-pink-500">🌸</span>
              </p>
              <p className="text-sm text-purple-600/80">
                Renove suas energias e conquiste seus objetivos!
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-700 rounded-full text-sm font-medium transition-colors"
            >
              <Egg className="w-4 h-4" />
              Celebrar
            </button>
            
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-purple-500/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-purple-500/70" />
            </button>
          </div>
        </div>

        {/* Easter egg hint */}
        {clickCount > 0 && clickCount < 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-purple-500/60 animate-fade-in">
            O coelho está pulando! 🐰 ({clickCount}/5)
          </p>
        )}
        {clickCount >= 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-purple-600 animate-pulse">
            Você encontrou o segredo do coelho! 🐰🥚✨
          </p>
        )}
      </div>

      <EasterModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
};
