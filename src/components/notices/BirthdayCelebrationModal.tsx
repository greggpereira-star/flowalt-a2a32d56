import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Cake, Sparkles } from 'lucide-react';
import { useBirthdayEffects } from '@/hooks/useBirthdayEffects';
import { cn } from '@/lib/utils';

interface BirthdayCelebrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  /** Persiste no perfil que o usuário não quer ver mais este modal. */
  onDontShowAgain?: () => void | Promise<void>;
}

/**
 * Modal premium de celebração de aniversário.
 * - Confete sutil e único (paleta refinada)
 * - Respeita prefers-reduced-motion (zero animação se ativo)
 * - Acessível: foco automático, ESC/overlay fecham, aria-live
 * - Auto-dismiss opcional (8s) — pausado se o usuário interagir
 */
export function BirthdayCelebrationModal({
  open,
  onOpenChange,
  userName = 'Você',
  onDontShowAgain,
}: BirthdayCelebrationModalProps) {
  const {
    fireSubtleBurst,
    fireCelebration,
    markModalShown,
    prefersReducedMotion,
  } = useBirthdayEffects({ enabled: true, intensity: 'subtle' });

  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const interactedRef = useRef(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Reset checkbox toda vez que o modal reabre
  useEffect(() => {
    if (open) setDontShowAgain(false);
  }, [open]);

  // Disparo único e foco no botão primário
  useEffect(() => {
    if (!open) return;

    const t = setTimeout(() => {
      fireSubtleBurst();
      primaryBtnRef.current?.focus({ preventScroll: true });
    }, 250);

    return () => clearTimeout(t);
  }, [open, fireSubtleBurst]);

  const persistPreferenceIfNeeded = () => {
    if (dontShowAgain && onDontShowAgain) {
      try {
        void onDontShowAgain();
      } catch {
        /* silencioso — UI já fechou */
      }
    }
  };

  // Auto-dismiss elegante após 8s — pausa se houver interação
  useEffect(() => {
    if (!open) return;
    interactedRef.current = false;

    const t = setTimeout(() => {
      if (!interactedRef.current) {
        markModalShown();
        onOpenChange(false);
      }
    }, 8000);

    return () => clearTimeout(t);
  }, [open, markModalShown, onOpenChange]);

  const markInteraction = () => {
    interactedRef.current = true;
  };

  const handleCelebrate = () => {
    markInteraction();
    fireCelebration();
    markModalShown();
    persistPreferenceIfNeeded();
    setTimeout(() => onOpenChange(false), 1200);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      markInteraction();
      markModalShown();
      persistPreferenceIfNeeded();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'sm:max-w-md border-0 bg-transparent shadow-none p-0',
          'overflow-visible focus-visible:outline-none',
        )}
        hideCloseButton
        onPointerDownOutside={markInteraction}
        onEscapeKeyDown={markInteraction}
      >
        <DialogTitle className="sr-only">
          Feliz aniversário, {userName}!
        </DialogTitle>
        <DialogDescription className="sr-only">
          Mensagem de celebração do seu aniversário. Pressione Esc para fechar.
        </DialogDescription>

        {/* Glow background — desativado em reduced-motion */}
        {!prefersReducedMotion && (
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="absolute inset-0 bg-gradient-radial from-amber-400/15 via-pink-400/8 to-transparent blur-3xl" />
          </div>
        )}

        <div
          role="status"
          aria-live="polite"
          className={cn(
            'relative rounded-2xl overflow-hidden',
            'bg-card/95 backdrop-blur-xl',
            'border border-border/60',
            'shadow-xl',
            'p-8 text-center',
            !prefersReducedMotion && 'animate-scale-in',
          )}
          onMouseEnter={markInteraction}
        >
          {/* Faixa decorativa superior — gradiente sutil */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-pink-400 to-violet-400"
          />

          {/* Ícone principal */}
          <div className="relative mx-auto mb-6 w-20 h-20">
            <div
              className={cn(
                'absolute inset-0 rounded-full',
                'bg-gradient-to-br from-amber-400/30 to-pink-500/30',
                !prefersReducedMotion && 'animate-pulse-glow',
              )}
              aria-hidden
            />
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-amber-50 to-pink-50 dark:from-amber-950/60 dark:to-pink-950/60 flex items-center justify-center">
              <Cake className="h-9 w-9 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight mb-1.5 bg-gradient-to-r from-amber-600 via-pink-600 to-violet-600 bg-clip-text text-transparent">
            Feliz Aniversário
          </h2>

          <p className="text-base font-medium text-foreground mb-1">
            {userName}
          </p>

          <p className="text-sm text-muted-foreground mb-7 max-w-sm mx-auto leading-relaxed">
            Que seu dia seja tão especial quanto a sua jornada com a gente. 🎂
          </p>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-center">
            <Button
              ref={primaryBtnRef}
              onClick={handleCelebrate}
              size="lg"
              className={cn(
                'relative overflow-hidden order-1 sm:order-2',
                'bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500',
                'hover:from-amber-600 hover:via-pink-600 hover:to-violet-600',
                'text-white font-medium px-6',
                'border-0 shadow-md shadow-pink-500/20',
                'transition-transform duration-200 hover:scale-[1.02]',
              )}
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              Celebrar
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={() => handleClose(false)}
              className="order-2 sm:order-1 text-muted-foreground hover:text-foreground"
            >
              Obrigado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
