import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ParticleType = 'crystal' | 'mini-crystal' | 'present';

interface ParticleProps {
  id: number;
  type: ParticleType;
  size: number;
  left: number;
  animationDuration: number;
  delay: number;
  opacity: number;
  presentColor?: 'red' | 'green' | 'blue';
}

// SVG Ice Crystal Component
const IceCrystal: React.FC<{ size: number; isMini?: boolean }> = ({ size, isMini }) => (
  <svg
    viewBox="0 0 24 24"
    style={{ width: size, height: size }}
    className="drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]"
  >
    <defs>
      <linearGradient id={`crystal-gradient${isMini ? '-mini' : ''}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" />
        <stop offset="50%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0EA5E9" />
      </linearGradient>
    </defs>
    {/* Main vertical line */}
    <line x1="12" y1="2" x2="12" y2="22" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1.5" strokeLinecap="round" />
    {/* Horizontal line */}
    <line x1="2" y1="12" x2="22" y2="12" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1.5" strokeLinecap="round" />
    {/* Diagonal lines */}
    <line x1="5" y1="5" x2="19" y2="19" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="19" y1="5" x2="5" y2="19" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1.5" strokeLinecap="round" />
    {/* Crystal branches */}
    <line x1="12" y1="2" x2="9" y2="5" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1" strokeLinecap="round" />
    <line x1="12" y1="2" x2="15" y2="5" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1" strokeLinecap="round" />
    <line x1="12" y1="22" x2="9" y2="19" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1" strokeLinecap="round" />
    <line x1="12" y1="22" x2="15" y2="19" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1" strokeLinecap="round" />
    <line x1="2" y1="12" x2="5" y2="9" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1" strokeLinecap="round" />
    <line x1="2" y1="12" x2="5" y2="15" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1" strokeLinecap="round" />
    <line x1="22" y1="12" x2="19" y2="9" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1" strokeLinecap="round" />
    <line x1="22" y1="12" x2="19" y2="15" stroke={`url(#crystal-gradient${isMini ? '-mini' : ''})`} strokeWidth="1" strokeLinecap="round" />
  </svg>
);

// Gift Box Component
const GiftBox: React.FC<{ size: number; color: 'red' | 'green' | 'blue' }> = ({ size, color }) => {
  const colors = {
    red: { box: '#EF4444', ribbon: '#F59E0B', shadow: '#DC2626' },
    green: { box: '#22C55E', ribbon: '#DC2626', shadow: '#16A34A' },
    blue: { box: '#3B82F6', ribbon: '#CBD5E1', shadow: '#2563EB' },
  };

  const c = colors[color];

  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
      {/* Box shadow */}
      <rect x="4" y="10" width="16" height="12" rx="1" fill={c.shadow} />
      {/* Main box */}
      <rect x="3" y="9" width="18" height="12" rx="1" fill={c.box} />
      {/* Lid */}
      <rect x="2" y="6" width="20" height="4" rx="1" fill={c.box} />
      <rect x="2" y="6" width="20" height="1" rx="0.5" fill={c.shadow} opacity="0.3" />
      {/* Vertical ribbon */}
      <rect x="10.5" y="6" width="3" height="15" fill={c.ribbon} />
      {/* Horizontal ribbon */}
      <rect x="2" y="7" width="20" height="2" fill={c.ribbon} />
      {/* Bow */}
      <ellipse cx="9" cy="5" rx="2.5" ry="1.5" fill={c.ribbon} />
      <ellipse cx="15" cy="5" rx="2.5" ry="1.5" fill={c.ribbon} />
      <circle cx="12" cy="5" r="1.5" fill={c.ribbon} />
      {/* Bow shine */}
      <ellipse cx="9" cy="4.5" rx="1" ry="0.5" fill="white" opacity="0.3" />
      <ellipse cx="15" cy="4.5" rx="1" ry="0.5" fill="white" opacity="0.3" />
    </svg>
  );
};

const Particle: React.FC<ParticleProps> = ({ type, size, left, animationDuration, delay, opacity, presentColor }) => {
  const getAnimationClass = () => {
    if (type === 'present') return 'animate-present-fall';
    return 'animate-crystal-fall';
  };

  return (
    <div
      className={`absolute top-0 pointer-events-none ${getAnimationClass()}`}
      style={{
        left: `${left}%`,
        animationDuration: `${animationDuration}s`,
        animationDelay: `${delay}s`,
        opacity,
      }}
    >
      {type === 'crystal' && <IceCrystal size={size} />}
      {type === 'mini-crystal' && <IceCrystal size={size} isMini />}
      {type === 'present' && <GiftBox size={size} color={presentColor || 'red'} />}
    </div>
  );
};

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

  const particles = useMemo(() => {
    const count = intensity * 12;
    const presentColors: Array<'red' | 'green' | 'blue'> = ['red', 'green', 'blue'];
    
    return Array.from({ length: count }, (_, i) => {
      // Distribution: 60% crystals, 25% mini-crystals, 15% presents
      const rand = Math.random();
      let type: ParticleType;
      let size: number;
      
      if (rand < 0.15) {
        type = 'present';
        size = Math.random() * 12 + 20; // 20-32px
      } else if (rand < 0.40) {
        type = 'mini-crystal';
        size = Math.random() * 6 + 8; // 8-14px
      } else {
        type = 'crystal';
        size = Math.random() * 10 + 16; // 16-26px
      }

      return {
        id: i,
        type,
        size,
        left: Math.random() * 100,
        animationDuration: type === 'present' 
          ? Math.random() * 4 + 10 // 10-14s for presents (slower)
          : Math.random() * 5 + 8, // 8-13s for crystals
        delay: Math.random() * 8,
        opacity: type === 'mini-crystal' ? Math.random() * 0.4 + 0.3 : Math.random() * 0.3 + 0.7,
        presentColor: presentColors[Math.floor(Math.random() * presentColors.length)],
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
        className="absolute top-4 right-4 pointer-events-auto bg-background/20 hover:bg-background/40 text-white"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
