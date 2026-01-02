import { useState, useCallback, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { HolidayType, SeasonType, CelebrationEventType, wasHolidayModalShown, markHolidayModalShown } from '@/lib/holidayUtils';

interface UseHolidayEffectsOptions {
  holiday: CelebrationEventType;
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

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.5 },
      colors: pastelColors,
      shapes: ['circle'],
      scalar: 1.5,
    });

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

  const fireCarnivalConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const carnivalColors = ['#9333ea', '#eab308', '#22c55e', '#3b82f6', '#f43f5e', '#ff0080'];
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
        colors: carnivalColors,
      });
      
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.7 },
        colors: carnivalColors,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Big colorful burst
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.5 },
        colors: carnivalColors,
        shapes: ['circle', 'square'],
      });
    }, 500);

    // Side bursts
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 45,
        spread: 50,
        origin: { x: 0.1, y: 0.5 },
        colors: carnivalColors,
      });
      confetti({
        particleCount: 50,
        angle: 135,
        spread: 50,
        origin: { x: 0.9, y: 0.5 },
        colors: carnivalColors,
      });
    }, 800);
  }, [prefersReducedMotion]);

  const fireSpringConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const springColors = ['#FFB6C1', '#98FB98', '#FAFAD2', '#FFD700', '#87CEEB'];

    // Flower petals effect
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.4 },
      colors: springColors,
      shapes: ['circle'],
      gravity: 0.5,
      scalar: 1.2,
      drift: 0.5,
    });

    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 60,
        origin: { x: 0.2, y: 0.5 },
        colors: ['#FFB6C1', '#FF69B4'],
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 60,
        origin: { x: 0.8, y: 0.5 },
        colors: ['#98FB98', '#90EE90'],
      });
    }, 300);
  }, [prefersReducedMotion]);

  const fireSummerConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const summerColors = ['#FFD700', '#FFA500', '#FF6347', '#87CEEB', '#00CED1'];

    // Sun rays effect
    const duration = 2500;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: Math.random() * 360,
        spread: 30,
        origin: { x: 0.5, y: 0.3 },
        colors: summerColors,
        startVelocity: 20,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 180,
        origin: { y: 0.4 },
        colors: summerColors,
      });
    }, 400);
  }, [prefersReducedMotion]);

  const fireAutumnConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const autumnColors = ['#D2691E', '#CD853F', '#DEB887', '#8B4513', '#A0522D', '#F4A460'];

    // Falling leaves effect
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        startVelocity: 5,
        ticks: 300,
        origin: {
          x: Math.random(),
          y: 0,
        },
        colors: autumnColors,
        shapes: ['circle'],
        gravity: 0.4,
        scalar: 1.5,
        drift: Math.random() * 2 - 1,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.5 },
        colors: autumnColors,
        shapes: ['circle'],
      });
    }, 500);
  }, [prefersReducedMotion]);

  const fireWinterConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const winterColors = ['#FFFFFF', '#E0F2FE', '#BAE6FD', '#7DD3FC', '#38BDF8'];

    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        startVelocity: 0,
        ticks: 300,
        origin: {
          x: Math.random(),
          y: 0,
        },
        colors: winterColors,
        shapes: ['circle'],
        gravity: 0.2,
        scalar: 1.3,
        drift: Math.random() - 0.5,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    setTimeout(() => {
      confetti({
        particleCount: 70,
        spread: 90,
        origin: { y: 0.5 },
        colors: winterColors,
        shapes: ['circle'],
        scalar: 1.5,
      });
    }, 400);
  }, [prefersReducedMotion]);

  const fireFestaJuninaConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const juninaColors = ['#ea580c', '#eab308', '#dc2626', '#16a34a', '#7c3aed'];

    // Bonfire sparks effect
    const duration = 2500;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: Math.random() * 60 + 60,
        spread: 40,
        origin: { x: 0.5, y: 0.8 },
        colors: ['#f97316', '#fbbf24', '#ef4444'],
        startVelocity: 25,
        gravity: 0.8,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.5 },
        colors: juninaColors,
      });
    }, 500);
  }, [prefersReducedMotion]);

  const fireValentinesConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const loveColors = ['#ec4899', '#f43f5e', '#ef4444', '#fb7185', '#fda4af'];

    // Hearts floating up
    const duration = 2500;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 90,
        spread: 60,
        origin: { x: Math.random(), y: 1 },
        colors: loveColors,
        shapes: ['circle'],
        gravity: -0.2,
        drift: Math.random() - 0.5,
        scalar: 1.5,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 120,
        origin: { y: 0.5 },
        colors: loveColors,
        shapes: ['circle'],
      });
    }, 400);
  }, [prefersReducedMotion]);

  const fireHalloweenConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    const spookyColors = ['#f97316', '#7c3aed', '#1f2937', '#22c55e', '#ffffff'];

    // Spooky effect
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.5 },
      colors: spookyColors,
    });

    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 50,
        origin: { x: 0, y: 0.6 },
        colors: ['#f97316', '#7c3aed'],
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 50,
        origin: { x: 1, y: 0.6 },
        colors: ['#f97316', '#7c3aed'],
      });
    }, 300);

    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.4 },
        colors: spookyColors,
      });
    }, 600);
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
      case 'carnival':
        confetti({
          particleCount: 25 * intensity,
          spread: 60 + intensity * 10,
          origin: { y: 0.6 },
          colors: ['#9333ea', '#eab308', '#22c55e', '#3b82f6', '#f43f5e'],
        });
        break;
      case 'spring':
        confetti({
          particleCount: 15 * intensity,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#FFB6C1', '#98FB98', '#FAFAD2'],
          gravity: 0.6,
        });
        break;
      case 'summer':
        confetti({
          particleCount: 20 * intensity,
          spread: 60,
          origin: { y: 0.5 },
          colors: ['#FFD700', '#FFA500', '#87CEEB'],
        });
        break;
      case 'autumn':
        confetti({
          particleCount: 15 * intensity,
          spread: 40,
          origin: { y: 0.5 },
          colors: ['#D2691E', '#CD853F', '#8B4513'],
          gravity: 0.5,
        });
        break;
      case 'winter':
        confetti({
          particleCount: 12 * intensity,
          startVelocity: 5,
          origin: { x: Math.random(), y: 0 },
          colors: ['#FFFFFF', '#E0F2FE', '#BAE6FD'],
          gravity: 0.3,
        });
        break;
      case 'festa_junina':
        confetti({
          particleCount: 20 * intensity,
          spread: 50,
          origin: { y: 0.7 },
          colors: ['#ea580c', '#eab308', '#dc2626'],
        });
        break;
      case 'valentines':
        confetti({
          particleCount: 15 * intensity,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#ec4899', '#f43f5e', '#ef4444'],
        });
        break;
      case 'halloween':
        confetti({
          particleCount: 18 * intensity,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#f97316', '#7c3aed', '#1f2937'],
        });
        break;
    }
  }, [holiday, clickCount, prefersReducedMotion]);

  const fireCelebration = useCallback(() => {
    switch (holiday) {
      case 'new_year': fireNewYearFireworks(); break;
      case 'christmas': fireChristmasSnow(); break;
      case 'easter': fireEasterConfetti(); break;
      case 'carnival': fireCarnivalConfetti(); break;
      case 'spring': fireSpringConfetti(); break;
      case 'summer': fireSummerConfetti(); break;
      case 'autumn': fireAutumnConfetti(); break;
      case 'winter': fireWinterConfetti(); break;
      case 'festa_junina': fireFestaJuninaConfetti(); break;
      case 'valentines': fireValentinesConfetti(); break;
      case 'halloween': fireHalloweenConfetti(); break;
    }
  }, [holiday, fireNewYearFireworks, fireChristmasSnow, fireEasterConfetti, fireCarnivalConfetti, fireSpringConfetti, fireSummerConfetti, fireAutumnConfetti, fireWinterConfetti, fireFestaJuninaConfetti, fireValentinesConfetti, fireHalloweenConfetti]);

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
    fireCarnivalConfetti,
    fireSpringConfetti,
    fireSummerConfetti,
    fireAutumnConfetti,
    fireWinterConfetti,
    fireFestaJuninaConfetti,
    fireValentinesConfetti,
    fireHalloweenConfetti,
    fireMiniEffect,
    fireCelebration,
    handleCelebrate,
  };
}
