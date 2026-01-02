import React, { useState } from 'react';
import { X, Flame } from 'lucide-react';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { FestaJuninaModal } from './FestaJuninaModal';

interface FestaJuninaBannerProps {
  onDismiss?: () => void;
}

export const FestaJuninaBanner: React.FC<FestaJuninaBannerProps> = ({ onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { fireMiniEffect, clickCount } = useHolidayEffects({ 
    holiday: 'festa_junina',
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
          background: 'linear-gradient(135deg, #ea580c 0%, #eab308 50%, #dc2626 100%)',
        }}
      >
        {/* Bandeirinhas pattern */}
        <div className="absolute top-0 left-0 right-0 h-6 flex justify-around items-start">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-5 animate-sway"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                backgroundColor: ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#9333ea'][i % 5],
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        {/* Floating elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-xl opacity-30 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            >
              {['🌽', '🔥', '🎵', '🎸', '🥜'][i % 5]}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-3xl">
              <span className="animate-bounce">🌽</span>
              <span className="animate-pulse">🔥</span>
            </div>

            <div className="text-white">
              <p className="font-bold text-lg flex items-center gap-2">
                É Festa Junina! 
                <Flame className="w-4 h-4 text-yellow-300" />
              </p>
              <p className="text-sm text-white/80">
                Arraiá! Vamos dançar quadrilha!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-medium transition-colors backdrop-blur-sm"
            >
              🎸 Celebrar
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
            A fogueira está esquentando! 🔥 ({clickCount}/5)
          </p>
        )}
        {clickCount >= 5 && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white animate-pulse">
            O forró começou! 🎵🌽🔥
          </p>
        )}
      </div>

      <FestaJuninaModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
};
