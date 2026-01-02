import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SnowflakeProps {
  id: number;
  size: number;
  left: number;
  animationDuration: number;
  delay: number;
  opacity: number;
}

const Snowflake: React.FC<SnowflakeProps> = ({ size, left, animationDuration, delay, opacity }) => (
  <div
    className="absolute top-0 rounded-full bg-white pointer-events-none animate-snow-fall"
    style={{
      width: size,
      height: size,
      left: `${left}%`,
      animationDuration: `${animationDuration}s`,
      animationDelay: `${delay}s`,
      opacity,
      boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
    }}
  />
);

interface SnowEffectProps {
  enabled?: boolean;
  intensity?: number; // 1-3
}

export const SnowEffect: React.FC<SnowEffectProps> = ({ 
  enabled = true, 
  intensity = 2 
}) => {
  const [isVisible, setIsVisible] = useState(enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  const snowflakes = useMemo(() => {
    const count = intensity * 15; // 15, 30, or 45 snowflakes
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 8 + 4, // 4-12px
      left: Math.random() * 100,
      animationDuration: Math.random() * 5 + 8, // 8-13s
      delay: Math.random() * 5,
      opacity: Math.random() * 0.5 + 0.5,
    }));
  }, [intensity]);

  if (!isVisible || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {snowflakes.map((flake) => (
        <Snowflake key={flake.id} {...flake} />
      ))}
      
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
