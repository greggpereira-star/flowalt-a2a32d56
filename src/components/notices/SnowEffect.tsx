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
  blur: number;
}

const Snowflake: React.FC<SnowflakeProps> = ({ size, left, animationDuration, delay, opacity, blur }) => (
  <div
    className="absolute top-0 rounded-full pointer-events-none animate-snow-fall"
    style={{
      width: size,
      height: size,
      left: `${left}%`,
      animationDuration: `${animationDuration}s`,
      animationDelay: `${delay}s`,
      opacity,
      filter: `blur(${blur}px)`,
      background: 'linear-gradient(135deg, #a8d4ff 0%, #e8f4ff 50%, #cce5ff 100%)',
      boxShadow: `
        0 0 ${size}px rgba(100, 180, 255, 0.6),
        0 0 ${size * 2}px rgba(100, 180, 255, 0.3),
        inset 0 0 ${size / 2}px rgba(255, 255, 255, 0.8)
      `,
    }}
  />
);

// Additional crystalline snowflake
const CrystalSnowflake: React.FC<{ left: number; delay: number; duration: number }> = ({ left, delay, duration }) => (
  <div
    className="absolute top-0 pointer-events-none animate-snow-fall text-blue-300/70"
    style={{
      left: `${left}%`,
      animationDuration: `${duration}s`,
      animationDelay: `${delay}s`,
      fontSize: `${Math.random() * 12 + 10}px`,
      textShadow: '0 0 8px rgba(100, 180, 255, 0.8), 0 0 16px rgba(100, 180, 255, 0.4)',
    }}
  >
    ❄
  </div>
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
    const count = intensity * 12;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 10 + 6,
      left: Math.random() * 100,
      animationDuration: Math.random() * 5 + 8,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.4 + 0.6,
      blur: Math.random() * 0.5,
    }));
  }, [intensity]);

  const crystalFlakes = useMemo(() => {
    const count = intensity * 5;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: Math.random() * 6 + 10,
    }));
  }, [intensity]);

  if (!isVisible || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Subtle blue overlay for winter atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-blue-500/10 pointer-events-none" />
      
      {snowflakes.map((flake) => (
        <Snowflake key={flake.id} {...flake} />
      ))}
      
      {crystalFlakes.map((flake) => (
        <CrystalSnowflake key={`crystal-${flake.id}`} {...flake} />
      ))}
      
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 pointer-events-auto bg-background/80 hover:bg-background text-foreground shadow-md"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
