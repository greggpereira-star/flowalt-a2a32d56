import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuroraBorealisEffectProps {
  enabled?: boolean;
  intensity?: number; // 1-3
}

export const AuroraBorealisEffect: React.FC<AuroraBorealisEffectProps> = ({
  enabled = true,
  intensity = 2,
}) => {
  const [isVisible, setIsVisible] = useState(enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  if (!isVisible || prefersReducedMotion) return null;

  const waveCount = intensity + 2; // 3, 4, or 5 waves

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {/* Aurora waves */}
      <div className="absolute inset-0">
        {Array.from({ length: waveCount }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-x-0 top-0 h-[60vh] animate-aurora-wave"
            style={{
              background: `linear-gradient(
                180deg,
                transparent 0%,
                hsla(${160 + i * 30}, 80%, 50%, ${0.08 - i * 0.01}) 20%,
                hsla(${180 + i * 25}, 70%, 45%, ${0.12 - i * 0.015}) 40%,
                hsla(${200 + i * 20}, 75%, 55%, ${0.1 - i * 0.012}) 60%,
                hsla(${280 + i * 15}, 65%, 50%, ${0.06 - i * 0.008}) 80%,
                transparent 100%
              )`,
              animationDelay: `${i * 1.5}s`,
              animationDuration: `${8 + i * 2}s`,
              transform: `translateX(${i * 5 - 10}%)`,
              filter: 'blur(30px)',
            }}
          />
        ))}
      </div>

      {/* Shimmer overlay */}
      <div className="absolute inset-0 animate-aurora-shimmer opacity-30">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 0%, hsla(160, 80%, 60%, 0.15), transparent),
              radial-gradient(ellipse 60% 40% at 30% 10%, hsla(200, 70%, 55%, 0.12), transparent),
              radial-gradient(ellipse 70% 45% at 70% 5%, hsla(280, 65%, 50%, 0.1), transparent)
            `,
          }}
        />
      </div>

      {/* Stars twinkling */}
      <div className="absolute inset-0">
        {Array.from({ length: intensity * 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-star-twinkle"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 50}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 2 + 2}s`,
            }}
          />
        ))}
      </div>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 pointer-events-auto bg-background/20 hover:bg-background/40 text-white"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
