import React, { useState } from 'react';
import { X, Sparkles, Clock, PartyPopper } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { NewYearModal } from './NewYearModal';

interface NewYearBannerProps {
  onDismiss?: () => void;
}

export const NewYearBanner: React.FC<NewYearBannerProps> = ({ onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { fireMiniEffect, clickCount } = useHolidayEffects({ 
    holiday: 'new_year',
    enabled: false 
  });

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleBannerClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on buttons
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
          background: 'linear-gradient(135deg, #1e3a5f 0%, #4c1d95 50%, #312e81 100%)',
        }}
      >
        {/* Animated stars background */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <Sparkles
              key={i}
              className="absolute text-yellow-300/40 animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 8 + 6}px`,
                height: `${Math.random() * 8 + 6}px`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icons */}
            <div className="flex gap-2 text-3xl">
              <span className="animate-bounce">🎆</span>
              <span className="animate-pulse">🥂</span>
            </div>

            {/* Message */}
            <div className="text-white">
              <p className="font-bold text-lg flex items-center gap-2">
                Feliz Ano Novo! 
                <Clock className="w-4 h-4 text-yellow-300" />
              </p>
              <p className="text-sm text-white/80">
                Que este ano traga novas conquistas!
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 rounded-full text-sm font-medium transition-colors"
            >
              <PartyPopper className="w-4 h-4" />
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

        {/* Easter egg hint */}
        {clickCount > 0 && clickCount < 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-yellow-300/60 animate-fade-in">
            Continue clicando... {5 - clickCount} fogos restantes! 🎇
          </p>
        )}
        {clickCount >= 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-yellow-300 animate-pulse">
            Você é o mestre dos fogos! 🎆✨
          </p>
        )}
      </div>

      <NewYearModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
};
