import React, { useEffect, useState, useMemo } from 'react';

interface Confetti {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
  type: 'square' | 'circle' | 'streamer';
}

interface CarnivalEffectProps {
  intensity?: 'low' | 'medium' | 'high';
}

export const CarnivalEffect: React.FC<CarnivalEffectProps> = ({ intensity = 'medium' }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsVisible(false);
    }
  }, []);

  const confettiCount = intensity === 'low' ? 30 : intensity === 'medium' ? 50 : 80;

  const confetti = useMemo<Confetti[]>(() => {
    const carnivalColors = [
      '#9333ea', // Purple
      '#eab308', // Yellow
      '#22c55e', // Green
      '#3b82f6', // Blue
      '#f43f5e', // Pink
      '#ff0080', // Magenta
      '#06b6d4', // Cyan
      '#f97316', // Orange
    ];

    return Array.from({ length: confettiCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 8,
      duration: Math.random() * 4 + 6,
      color: carnivalColors[Math.floor(Math.random() * carnivalColors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      type: ['square', 'circle', 'streamer'][Math.floor(Math.random() * 3)] as 'square' | 'circle' | 'streamer',
    }));
  }, [confettiCount]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {confetti.map((c) => (
        <div
          key={c.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${c.x}%`,
            top: '-30px',
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
          }}
        >
          {c.type === 'circle' && (
            <div
              className="rounded-full"
              style={{
                width: c.size,
                height: c.size,
                backgroundColor: c.color,
                transform: `rotate(${c.rotation}deg)`,
              }}
            />
          )}
          {c.type === 'square' && (
            <div
              style={{
                width: c.size,
                height: c.size,
                backgroundColor: c.color,
                transform: `rotate(${c.rotation}deg)`,
              }}
            />
          )}
          {c.type === 'streamer' && (
            <div
              className="rounded-full"
              style={{
                width: c.size / 2,
                height: c.size * 3,
                backgroundColor: c.color,
                transform: `rotate(${c.rotation}deg)`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};
