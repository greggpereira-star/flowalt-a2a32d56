import { useCallback, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [hasShownModal, setHasShownModal] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  /**
   * Tuning responsivo: mobile recebe menos partículas e ticks menores
   * para preservar 60fps em GPUs limitadas. Desktop ganha mais densidade.
   */
  const tuning = useMemo(
    () =>
      isMobile
        ? { subtle: 36, cannon: 32, mini: 12, ticks: 140, scalar: 0.75, gravity: 1.2 }
        : { subtle: 70, cannon: 55, mini: 20, ticks: 200, scalar: 0.95, gravity: 1.05 },
    [isMobile],
  );

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
      particleCount: tuning.subtle,
      spread: isMobile ? 60 : 75,
      startVelocity: isMobile ? 28 : 35,
      gravity: tuning.gravity,
      ticks: tuning.ticks,
      scalar: tuning.scalar,
      origin: { x: 0.5, y: isMobile ? 0.4 : 0.35 },
      colors: PREMIUM_PALETTE,
      disableForReducedMotion: true,
      zIndex: 9999,
    });
  }, [prefersReducedMotion, enabled, tuning, isMobile]);

  // Dois disparos laterais discretos
  const fireConfettiCannons = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    const baseCount = intensity === 'epic' ? (isMobile ? 70 : 120) : tuning.cannon;
    const defaults = {
      ticks: tuning.ticks,
      gravity: tuning.gravity,
      scalar: tuning.scalar,
      colors: PREMIUM_PALETTE,
      disableForReducedMotion: true,
      zIndex: 9999,
    };

    confetti({
      ...defaults,
      particleCount: baseCount,
      angle: 60,
      spread: isMobile ? 45 : 55,
      origin: { x: isMobile ? 0.1 : 0.05, y: 0.7 },
    });

    confetti({
      ...defaults,
      particleCount: baseCount,
      angle: 120,
      spread: isMobile ? 45 : 55,
      origin: { x: isMobile ? 0.9 : 0.95, y: 0.7 },
    });
  }, [prefersReducedMotion, enabled, intensity, tuning, isMobile]);

  // Easter egg: pequeno burst (clique no banner)
  const fireMiniConfetti = useCallback(() => {
    if (prefersReducedMotion || !enabled) return;

    confetti({
      particleCount: tuning.mini + clickCount * (isMobile ? 4 : 6),
      spread: isMobile ? 40 : 50,
      startVelocity: isMobile ? 20 : 25,
      scalar: tuning.scalar - 0.1,
      ticks: Math.max(120, tuning.ticks - 40),
      origin: { x: 0.5, y: 0.6 },
      colors: PREMIUM_PALETTE,
      disableForReducedMotion: true,
      zIndex: 9999,
    });

    setClickCount((prev) => Math.min(prev + 1, 5));
  }, [prefersReducedMotion, enabled, clickCount, tuning, isMobile]);

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
