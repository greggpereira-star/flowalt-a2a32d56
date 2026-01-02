import React, { useState } from 'react';
import { X, PartyPopper, Music } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { CarnivalModal } from './CarnivalModal';

interface CarnivalBannerProps {
  onDismiss?: () => void;
}

export const CarnivalBanner: React.FC<CarnivalBannerProps> = ({ onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { fireMiniEffect, clickCount } = useHolidayEffects({ 
    holiday: 'carnival',
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
          background: 'linear-gradient(135deg, #9333ea 0%, #eab308 33%, #22c55e 66%, #3b82f6 100%)',
        }}
      >
        {/* Confetti particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                width: `${Math.random() * 8 + 4}px`,
                height: `${Math.random() * 8 + 4}px`,
                backgroundColor: ['#ff0080', '#7c3aed', '#fbbf24', '#22c55e', '#3b82f6', '#f43f5e'][i % 6],
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 3 + 4}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>

        {/* Music notes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`note-${i}`}
              className="absolute text-xl opacity-30 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            >
              {['🎵', '🎶', '🎷', '🥁'][i % 4]}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icons */}
            <div className="flex gap-2 text-3xl">
              <span className="animate-bounce">🎭</span>
              <span className="animate-pulse">🎊</span>
            </div>

            {/* Message */}
            <div className="text-white">
              <p className="font-bold text-lg flex items-center gap-2">
                É Carnaval! 
                <Music className="w-4 h-4 text-yellow-300" />
              </p>
              <p className="text-sm text-white/80">
                Vamos celebrar com muita alegria e energia!
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-medium transition-colors backdrop-blur-sm"
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
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white/60 animate-fade-in">
            O bloco está chegando! 🎭 ({clickCount}/5)
          </p>
        )}
        {clickCount >= 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white animate-pulse">
            Bloquinho ativado! 🎉🎭🥳
          </p>
        )}
      </div>

      <CarnivalModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
};
