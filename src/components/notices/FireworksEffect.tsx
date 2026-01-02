import React, { useEffect, useState, useCallback } from 'react';
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
  interval = 4000,
}) => {
  const [isVisible, setIsVisible] = useState(enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  const fireFirework = useCallback(() => {
    const colors = ['#FFD700', '#C0C0C0', '#4169E1', '#9400D3', '#FF6347'];
    
    // Random position
    const x = Math.random() * 0.6 + 0.2; // 20-80% of screen
    const y = Math.random() * 0.3 + 0.2; // 20-50% of screen

    // Rising effect
    confetti({
      particleCount: 1,
      startVelocity: 40,
      spread: 0,
      origin: { x, y: 1 },
      colors: ['#FFD700'],
      shapes: ['circle'],
      ticks: 50,
      gravity: 2,
    });

    // Explosion after "rise"
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { x, y },
        colors: colors,
        shapes: ['star', 'circle'],
        ticks: 100,
      });
    }, 300);
  }, []);

  useEffect(() => {
    if (!isVisible || prefersReducedMotion) return;

    const endTime = Date.now() + duration * 1000;
    
    // Initial firework
    fireFirework();

    const intervalId = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(intervalId);
        setIsVisible(false);
        return;
      }
      fireFirework();
    }, interval);

    return () => clearInterval(intervalId);
  }, [isVisible, prefersReducedMotion, duration, interval, fireFirework]);

  if (!isVisible || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Starry background overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent" />
      
      {/* Twinkling stars */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 50}%`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
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
