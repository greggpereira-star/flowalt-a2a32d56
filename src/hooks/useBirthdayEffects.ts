import { useCallback, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface UseBirthdayEffectsOptions {
  enabled?: boolean;
  /**
   * `subtle`  → confete único, sóbrio (default no modal premium)
   * `normal`  → 2 disparos discretos
   * `epic`    → sequência completa (apenas easter egg)
   */
  intensity?: 'subtle' | 'normal' | 'epic';
}

// Paleta premium alinhada ao design system (tons quentes refinados)
const PREMIUM_PALETTE = [
  '#F59E0B', // amber-500
  '#FBBF24', // amber-400
  '#FB7185', // rose-400
  '#F472B6', // pink-400
  '#A78BFA', // violet-400
  '#FDE68A', // amber-200 (highlight)
];

export function useBirthdayEffects(options: UseBirthdayEffectsOptions = {}) {
  const { enabled = true, intensity = 'subtle' } = options;
  const [hasShownModal, setHasShownModal] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Reactive prefers-reduced-motion (acompanha mudança em tempo real)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const getSessionKey = (type: string) =>
    `birthday-${type}-${new Date().toDateString()}`;

  // Check if modal was already shown today
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const modalKey = getSessionKey('modal');
      setHasShownModal(!!sessionStorage.getItem(modalKey));
    }
  }, []);

  // Disparo único, refinado — para o modal premium
  const fireSubtleBurst = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    confetti({
      particleCount: 60,
      spread: 70,
      startVelocity: 35,
      gravity: 1.1,
      ticks: 180,
      scalar: 0.9,
      origin: { x: 0.5, y: 0.35 },
      colors: PREMIUM_PALETTE,
      disableForReducedMotion: true,
      zIndex: 9999,
    });
  }, [prefersReducedMotion, enabled]);

  // Dois disparos laterais discretos
  const fireConfettiCannons = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    const baseCount = intensity === 'epic' ? 120 : 50;
    const defaults = {
      ticks: 200,
      gravity: 1,
      scalar: 0.95,
      colors: PREMIUM_PALETTE,
      disableForReducedMotion: true,
      zIndex: 9999,
    };

    confetti({
      ...defaults,
      particleCount: baseCount,
      angle: 60,
      spread: 50,
      origin: { x: 0.05, y: 0.7 },
    });

    confetti({
      ...defaults,
      particleCount: baseCount,
      angle: 120,
      spread: 50,
      origin: { x: 0.95, y: 0.7 },
    });
  }, [prefersReducedMotion, enabled, intensity]);

  // Easter egg: pequeno burst (clique no banner)
  const fireMiniConfetti = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    confetti({
      particleCount: 18 + clickCount * 6,
      spread: 50,
      startVelocity: 25,
      scalar: 0.8,
      ticks: 150,
      origin: { x: 0.5, y: 0.6 },
      colors: PREMIUM_PALETTE,
      disableForReducedMotion: true,
      zIndex: 9999,
    });

    setClickCount((prev) => Math.min(prev + 1, 5));
  }, [prefersReducedMotion, enabled, clickCount]);

  // Sequência principal — agora curta e elegante
  const fireCelebration = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    if (intensity === 'subtle') {
      fireSubtleBurst();
      return;
    }

    fireConfettiCannons();

    if (intensity === 'epic') {
      setTimeout(fireConfettiCannons, 600);
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 140,
          startVelocity: 30,
          ticks: 200,
          scalar: 1,
          origin: { x: 0.5, y: 0.4 },
          colors: PREMIUM_PALETTE,
          disableForReducedMotion: true,
          zIndex: 9999,
        });
      }, 1100);
    }
  }, [intensity, fireSubtleBurst, fireConfettiCannons, prefersReducedMotion, enabled]);

  const markModalShown = useCallback(() => {
    const modalKey = getSessionKey('modal');
    sessionStorage.setItem(modalKey, 'shown');
    setHasShownModal(true);
  }, []);

  const shouldShowModal = !hasShownModal && enabled;

  return {
    fireSubtleBurst,
    fireConfettiCannons,
    fireMiniConfetti,
    fireCelebration,
    shouldShowModal,
    markModalShown,
    clickCount,
    prefersReducedMotion,
  };
}
