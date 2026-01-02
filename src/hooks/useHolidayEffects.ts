import { useState, useCallback, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { HolidayType, wasHolidayModalShown, markHolidayModalShown } from '@/lib/holidayUtils';

interface UseHolidayEffectsOptions {
  holiday: HolidayType;
  enabled?: boolean;
}

export function useHolidayEffects({ holiday, enabled = true }: UseHolidayEffectsOptions) {
  const [showModal, setShowModal] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (enabled && !wasHolidayModalShown(holiday)) {
      setShowModal(true);
    }
  }, [holiday, enabled]);

  const fireNewYearFireworks = useCallback(() => {
    if (prefersReducedMotion) return;

    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ['#FFD700', '#C0C0C0', '#4169E1', '#9400D3'];

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: colors,
        shapes: ['star', 'circle'],
      });
      
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: colors,
        shapes: ['star', 'circle'],
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Big burst
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.6 },
        colors: colors,
        shapes: ['star'],
      });
    }, 500);
  }, [prefersReducedMotion]);

  const fireChristmasSnow = useCallback(() => {
    if (prefersReducedMotion) return;

    const duration = 2000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        startVelocity: 0,
        ticks: 200,
        origin: {
          x: Math.random(),
          y: 0,
        },
        colors: ['#FFFFFF', '#E8E8E8', '#D0D0D0'],
        shapes: ['circle'],
        gravity: 0.3,
        scalar: 1.2,
        drift: Math.random() - 0.5,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Festive burst
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#FF0000', '#00FF00', '#FFD700', '#FFFFFF'],
      });
    }, 300);
  }, [prefersReducedMotion]);

  const fireEasterConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const pastelColors = ['#FFB6C1', '#DDA0DD', '#B0E0E6', '#98FB98', '#FAFAD2', '#FFE4B5'];

    // Egg-shaped burst pattern
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.5 },
      colors: pastelColors,
      shapes: ['circle'],
      scalar: 1.5,
    });

    // Side bursts
    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 40,
        origin: { x: 0.2, y: 0.6 },
        colors: pastelColors,
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 40,
        origin: { x: 0.8, y: 0.6 },
        colors: pastelColors,
      });
    }, 200);
  }, [prefersReducedMotion]);

  const fireMiniEffect = useCallback(() => {
    if (prefersReducedMotion) return;
    
    setClickCount(prev => prev + 1);
    const intensity = Math.min(clickCount + 1, 5);

    switch (holiday) {
      case 'new_year':
        confetti({
          particleCount: 15 * intensity,
          spread: 40 + intensity * 10,
          origin: { y: 0.7 },
          colors: ['#FFD700', '#C0C0C0', '#4169E1'],
          shapes: ['star'],
        });
        break;
      case 'christmas':
        confetti({
          particleCount: 10 * intensity,
          startVelocity: 10,
          ticks: 100,
          origin: { x: Math.random(), y: 0 },
          colors: ['#FFFFFF'],
          shapes: ['circle'],
          gravity: 0.5,
        });
        break;
      case 'easter':
        confetti({
          particleCount: 20 * intensity,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#FFB6C1', '#DDA0DD', '#B0E0E6', '#98FB98'],
          shapes: ['circle'],
        });
        break;
    }
  }, [holiday, clickCount, prefersReducedMotion]);

  const fireCelebration = useCallback(() => {
    switch (holiday) {
      case 'new_year':
        fireNewYearFireworks();
        break;
      case 'christmas':
        fireChristmasSnow();
        break;
      case 'easter':
        fireEasterConfetti();
        break;
    }
  }, [holiday, fireNewYearFireworks, fireChristmasSnow, fireEasterConfetti]);

  const closeModal = useCallback(() => {
    markHolidayModalShown(holiday);
    setShowModal(false);
  }, [holiday]);

  const handleCelebrate = useCallback(() => {
    fireCelebration();
    setTimeout(() => {
      closeModal();
    }, 1500);
  }, [fireCelebration, closeModal]);

  return {
    showModal,
    setShowModal,
    closeModal,
    clickCount,
    prefersReducedMotion,
    fireNewYearFireworks,
    fireChristmasSnow,
    fireEasterConfetti,
    fireMiniEffect,
    fireCelebration,
    handleCelebrate,
  };
}
