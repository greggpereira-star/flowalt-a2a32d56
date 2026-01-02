import React, { useEffect, useState, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FireworksEffectProps {
  enabled?: boolean;
  duration?: number; // in seconds
  interval?: number; // in milliseconds
}

export const FireworksEffect: React.FC<FireworksEffectProps> = ({
  enabled = true,
  duration = 20,
  interval = 2000,
}) => {
  const [isVisible, setIsVisible] = useState(enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  const fireRocketFirework = useCallback(() => {
    // Firework colors
    const colorSets = [
      ['#ff0000', '#ff6b6b', '#ffa500'], // Red/Orange
      ['#00ff00', '#90EE90', '#32CD32'], // Green
      ['#FFD700', '#FFA500', '#FF8C00'], // Gold
      ['#4169E1', '#00BFFF', '#87CEEB'], // Blue
      ['#FF1493', '#FF69B4', '#FFB6C1'], // Pink
      ['#9400D3', '#BA55D3', '#DDA0DD'], // Purple
      ['#00FFFF', '#40E0D0', '#48D1CC'], // Cyan
    ];
    
    const colors = colorSets[Math.floor(Math.random() * colorSets.length)];
    const x = Math.random() * 0.6 + 0.2;
    const y = Math.random() * 0.3 + 0.15;

    // Main explosion
    confetti({
      particleCount: 80,
      spread: 360,
      startVelocity: 30,
      origin: { x, y },
      colors: colors,
      shapes: ['circle'],
      ticks: 80,
      gravity: 0.8,
      scalar: 1.2,
      drift: 0,
    });

    // Secondary sparkle burst
    setTimeout(() => {
      confetti({
        particleCount: 30,
        spread: 360,
        startVelocity: 15,
        origin: { x, y },
        colors: ['#FFFFFF', '#FFD700'],
        shapes: ['star'],
        ticks: 50,
        gravity: 0.5,
        scalar: 0.8,
      });
    }, 100);
  }, []);

  const fireMultipleFireworks = useCallback(() => {
    // Fire 2-3 fireworks at slightly different times
    fireRocketFirework();
    
    setTimeout(() => {
      fireRocketFirework();
    }, 300);
    
    if (Math.random() > 0.5) {
      setTimeout(() => {
        fireRocketFirework();
      }, 600);
    }
  }, [fireRocketFirework]);

  useEffect(() => {
    if (!isVisible || prefersReducedMotion) return;

    const endTime = Date.now() + duration * 1000;
    
    // Initial burst
    fireMultipleFireworks();

    const intervalId = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(intervalId);
        setIsVisible(false);
        return;
      }
      fireMultipleFireworks();
    }, interval);

    return () => clearInterval(intervalId);
  }, [isVisible, prefersReducedMotion, duration, interval, fireMultipleFireworks]);

  if (!isVisible || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Dark gradient overlay for night sky effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/30 via-transparent to-purple-950/20" />
      
      {/* Twinkling stars */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 40}%`,
            width: `${Math.random() * 2 + 1}px`,
            height: `${Math.random() * 2 + 1}px`,
            animationDelay: `${Math.random() * 3}s`,
            boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
          }}
        />
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
