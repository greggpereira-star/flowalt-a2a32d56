import React, { useState, useEffect, useMemo } from 'react';

interface SnowEffectProps {
  enabled?: boolean;
  intensity?: number; // 1-3
  autoHide?: number; // seconds to auto-hide, 0 = never
}

export const SnowEffect: React.FC<SnowEffectProps> = ({ 
  enabled = true, 
  intensity = 2,
  autoHide = 0,
}) => {
  const [isVisible, setIsVisible] = useState(enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  useEffect(() => {
    if (autoHide > 0 && isVisible) {
      const timer = setTimeout(() => setIsVisible(false), autoHide * 1000);
      return () => clearTimeout(timer);
    }
  }, [autoHide, isVisible]);

  // Generate diverse snowflakes
  const snowflakes = useMemo(() => {
    const count = intensity * 25;
    return Array.from({ length: count }, (_, i) => {
      const type = Math.random();
      return {
        id: i,
        // Vary sizes more dramatically
        size: type < 0.3 ? Math.random() * 4 + 2 : // tiny
              type < 0.7 ? Math.random() * 8 + 5 : // medium
              Math.random() * 14 + 10, // large fluffy
        left: Math.random() * 100,
        duration: Math.random() * 8 + 6, // 6-14s
        delay: Math.random() * 8,
        opacity: type < 0.3 ? 0.4 : type < 0.7 ? 0.7 : 0.9,
        drift: (Math.random() - 0.5) * 100, // horizontal drift
        spin: Math.random() > 0.5,
      };
    });
  }, [intensity]);

  // Crystal emoji snowflakes
  const crystals = useMemo(() => {
    const count = intensity * 8;
    const types = ['❄', '❅', '❆', '✦', '✧'];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      char: types[Math.floor(Math.random() * types.length)],
      left: Math.random() * 100,
      size: Math.random() * 16 + 12,
      duration: Math.random() * 10 + 8,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.5 + 0.3,
    }));
  }, [intensity]);

  if (!isVisible || prefersReducedMotion) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
      onClick={() => setIsVisible(false)}
    >
      {/* Frost overlay on edges */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at top left, rgba(200, 230, 255, 0.15) 0%, transparent 40%),
            radial-gradient(ellipse at top right, rgba(200, 230, 255, 0.15) 0%, transparent 40%),
            radial-gradient(ellipse at bottom, rgba(220, 240, 255, 0.1) 0%, transparent 50%)
          `,
        }}
      />

      {/* Soft gradient snowflakes */}
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute rounded-full"
          style={{
            width: flake.size,
            height: flake.size,
            left: `${flake.left}%`,
            top: -20,
            opacity: flake.opacity,
            background: `radial-gradient(circle at 30% 30%, 
              rgba(255, 255, 255, 0.95) 0%, 
              rgba(200, 225, 255, 0.8) 40%, 
              rgba(180, 210, 255, 0.6) 70%, 
              transparent 100%
            )`,
            boxShadow: flake.size > 10 
              ? `0 0 ${flake.size}px rgba(180, 210, 255, 0.5), 0 0 ${flake.size * 2}px rgba(180, 210, 255, 0.2)`
              : `0 0 ${flake.size / 2}px rgba(200, 220, 255, 0.4)`,
            animation: `snowfall ${flake.duration}s linear ${flake.delay}s infinite`,
            '--drift': `${flake.drift}px`,
            '--spin': flake.spin ? '360deg' : '0deg',
          } as React.CSSProperties}
        />
      ))}

      {/* Crystal emoji snowflakes */}
      {crystals.map((crystal) => (
        <div
          key={`crystal-${crystal.id}`}
          className="absolute select-none"
          style={{
            left: `${crystal.left}%`,
            top: -30,
            fontSize: crystal.size,
            opacity: crystal.opacity,
            color: 'rgba(180, 220, 255, 0.8)',
            textShadow: `
              0 0 10px rgba(150, 200, 255, 0.8),
              0 0 20px rgba(150, 200, 255, 0.4),
              0 0 30px rgba(150, 200, 255, 0.2)
            `,
            animation: `snowfall ${crystal.duration}s linear ${crystal.delay}s infinite`,
            '--drift': `${(Math.random() - 0.5) * 80}px`,
            '--spin': '720deg',
          } as React.CSSProperties}
        >
          {crystal.char}
        </div>
      ))}

      {/* Subtle shimmer particles */}
      {Array.from({ length: intensity * 15 }).map((_, i) => (
        <div
          key={`shimmer-${i}`}
          className="absolute rounded-full animate-twinkle"
          style={{
            width: 2,
            height: 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: 'white',
            boxShadow: '0 0 4px rgba(255, 255, 255, 0.8), 0 0 8px rgba(200, 220, 255, 0.5)',
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${Math.random() * 2 + 1}s`,
          }}
        />
      ))}

      {/* Hint to dismiss - appears after 3 seconds */}
      <div 
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-blue-300/50 animate-fade-in pointer-events-auto cursor-pointer hover:text-blue-300/80 transition-colors"
        style={{ animationDelay: '3s', animationFillMode: 'backwards' }}
        onClick={() => setIsVisible(false)}
      >
        toque para fechar ❄
      </div>
    </div>
  );
};
