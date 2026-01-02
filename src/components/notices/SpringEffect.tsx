import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ParticleType = 'petal' | 'butterfly' | 'sparkle';

interface ParticleProps {
  id: number;
  type: ParticleType;
  size: number;
  left: number;
  animationDuration: number;
  delay: number;
  color: string;
}

// Cherry Blossom Petal SVG
const Petal: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
    <defs>
      <linearGradient id="petal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={color} />
        <stop offset="100%" stopColor="#FBCFE8" />
      </linearGradient>
    </defs>
    <path
      d="M12 2C8 2 4 6 4 12C4 14 6 16 8 16C10 16 12 14 12 12C12 14 14 16 16 16C18 16 20 14 20 12C20 6 16 2 12 2Z"
      fill="url(#petal-gradient)"
      opacity="0.9"
    />
    <path
      d="M12 4C10 4 8 6 8 8C8 10 10 12 12 12C14 12 16 10 16 8C16 6 14 4 12 4Z"
      fill="white"
      opacity="0.3"
    />
  </svg>
);

// Butterfly SVG
const Butterfly: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 32 32" style={{ width: size, height: size }} className="animate-butterfly-flutter">
    <defs>
      <linearGradient id={`butterfly-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={color} />
        <stop offset="50%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
    </defs>
    {/* Left wing */}
    <ellipse cx="10" cy="12" rx="8" ry="10" fill={`url(#butterfly-${color})`} opacity="0.85" />
    <ellipse cx="10" cy="20" rx="5" ry="7" fill={`url(#butterfly-${color})`} opacity="0.75" />
    {/* Right wing */}
    <ellipse cx="22" cy="12" rx="8" ry="10" fill={`url(#butterfly-${color})`} opacity="0.85" />
    <ellipse cx="22" cy="20" rx="5" ry="7" fill={`url(#butterfly-${color})`} opacity="0.75" />
    {/* Body */}
    <ellipse cx="16" cy="16" rx="1.5" ry="10" fill="#1F2937" />
    {/* Antennae */}
    <path d="M15 6 Q13 3 11 2" stroke="#1F2937" strokeWidth="0.8" fill="none" />
    <path d="M17 6 Q19 3 21 2" stroke="#1F2937" strokeWidth="0.8" fill="none" />
    <circle cx="11" cy="2" r="1" fill="#1F2937" />
    <circle cx="21" cy="2" r="1" fill="#1F2937" />
    {/* Wing patterns */}
    <circle cx="10" cy="10" r="2" fill="white" opacity="0.4" />
    <circle cx="22" cy="10" r="2" fill="white" opacity="0.4" />
  </svg>
);

// Sparkle
const Sparkle: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
    <path
      d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z"
      fill="#FDE68A"
      opacity="0.8"
    />
  </svg>
);

const Particle: React.FC<ParticleProps> = ({ type, size, left, animationDuration, delay, color }) => {
  const getAnimationClass = () => {
    switch (type) {
      case 'petal':
        return 'animate-petal-fall';
      case 'butterfly':
        return 'animate-butterfly-fly';
      case 'sparkle':
        return 'animate-sparkle-float';
      default:
        return 'animate-petal-fall';
    }
  };

  return (
    <div
      className={`absolute pointer-events-none ${getAnimationClass()}`}
      style={{
        left: `${left}%`,
        top: type === 'butterfly' ? `${Math.random() * 60 + 20}%` : '-20px',
        animationDuration: `${animationDuration}s`,
        animationDelay: `${delay}s`,
      }}
    >
      {type === 'petal' && <Petal size={size} color={color} />}
      {type === 'butterfly' && <Butterfly size={size} color={color} />}
      {type === 'sparkle' && <Sparkle size={size} />}
    </div>
  );
};

interface SpringEffectProps {
  enabled?: boolean;
  intensity?: number; // 1-3
}

export const SpringEffect: React.FC<SpringEffectProps> = ({
  enabled = true,
  intensity = 2,
}) => {
  const [isVisible, setIsVisible] = useState(enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  const particles = useMemo(() => {
    const count = intensity * 10;
    const petalColors = ['#F9A8D4', '#FBCFE8', '#FDA4AF', '#FCA5A5', '#FCD34D'];
    const butterflyColors = ['#A78BFA', '#818CF8', '#60A5FA', '#34D399', '#FBBF24'];

    return Array.from({ length: count }, (_, i) => {
      const rand = Math.random();
      let type: ParticleType;
      let size: number;
      let color: string;

      if (rand < 0.1) {
        type = 'butterfly';
        size = Math.random() * 16 + 24; // 24-40px
        color = butterflyColors[Math.floor(Math.random() * butterflyColors.length)];
      } else if (rand < 0.2) {
        type = 'sparkle';
        size = Math.random() * 8 + 6; // 6-14px
        color = '#FDE68A';
      } else {
        type = 'petal';
        size = Math.random() * 12 + 14; // 14-26px
        color = petalColors[Math.floor(Math.random() * petalColors.length)];
      }

      return {
        id: i,
        type,
        size,
        left: Math.random() * 100,
        animationDuration: type === 'butterfly'
          ? Math.random() * 8 + 12 // 12-20s for butterflies
          : Math.random() * 6 + 8, // 8-14s for petals
        delay: Math.random() * 10,
        color,
      };
    });
  }, [intensity]);

  if (!isVisible || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <Particle key={particle.id} {...particle} />
      ))}

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 pointer-events-auto bg-background/20 hover:bg-background/40"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
