import { useCallback, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface UseBirthdayEffectsOptions {
  enabled?: boolean;
  intensity?: 'normal' | 'epic';
}

export function useBirthdayEffects(options: UseBirthdayEffectsOptions = {}) {
  const { enabled = true, intensity = 'normal' } = options;
  const [hasShownModal, setHasShownModal] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const getSessionKey = (type: string) => 
    `birthday-${type}-${new Date().toDateString()}`;

  // Check if modal was already shown today
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const modalKey = getSessionKey('modal');
      setHasShownModal(!!sessionStorage.getItem(modalKey));
    }
  }, []);

  // Fire confetti cannons from both sides
  const fireConfettiCannons = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    const count = intensity === 'epic' ? 200 : 100;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    // Left cannon
    confetti({
      ...defaults,
      particleCount: count,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9ff3', '#ffeaa7'],
    });

    // Right cannon
    confetti({
      ...defaults,
      particleCount: count,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9ff3', '#ffeaa7'],
    });

    // Extra burst from center for epic intensity
    if (intensity === 'epic') {
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { x: 0.5, y: 0.5 },
          colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1', '#9370DB'],
          shapes: ['star', 'circle'],
          scalar: 1.2,
          zIndex: 9999,
        });
      }, 300);
    }
  }, [prefersReducedMotion, enabled, intensity]);

  // Fire a small burst of confetti (for easter eggs)
  const fireMiniConfetti = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    confetti({
      particleCount: 30 + (clickCount * 10),
      spread: 60,
      origin: { x: 0.5, y: 0.6 },
      colors: ['#FFD700', '#FF69B4', '#00CED1'],
      zIndex: 9999,
    });

    setClickCount(prev => Math.min(prev + 1, 5));
  }, [prefersReducedMotion, enabled, clickCount]);

  // Celebration sequence for modal
  const fireCelebration = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    // Initial burst
    fireConfettiCannons();

    // Staggered bursts
    setTimeout(fireConfettiCannons, 500);
    setTimeout(fireConfettiCannons, 1000);

    // Final big burst
    setTimeout(() => {
      confetti({
        particleCount: 200,
        spread: 180,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1', '#9370DB', '#32CD32'],
        shapes: ['star', 'circle', 'square'],
        scalar: 1.5,
        gravity: 0.8,
        zIndex: 9999,
      });
    }, 1500);
  }, [fireConfettiCannons, prefersReducedMotion, enabled]);

  // Mark modal as shown
  const markModalShown = useCallback(() => {
    const modalKey = getSessionKey('modal');
    sessionStorage.setItem(modalKey, 'shown');
    setHasShownModal(true);
  }, []);

  // Check if should show modal
  const shouldShowModal = !hasShownModal && enabled;

  return {
    fireConfettiCannons,
    fireMiniConfetti,
    fireCelebration,
    shouldShowModal,
    markModalShown,
    clickCount,
    prefersReducedMotion,
  };
}
