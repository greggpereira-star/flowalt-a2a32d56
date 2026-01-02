import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Cake, PartyPopper, Sparkles, Gift } from 'lucide-react';
import { useBirthdayEffects } from '@/hooks/useBirthdayEffects';
import { cn } from '@/lib/utils';

interface BirthdayCelebrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
}

export const BirthdayCelebrationModal: React.FC<BirthdayCelebrationModalProps> = ({
  open,
  onOpenChange,
  userName = 'Você',
}) => {
  const { fireCelebration, markModalShown, prefersReducedMotion } = useBirthdayEffects({ 
    enabled: true, 
    intensity: 'epic' 
  });

  useEffect(() => {
    if (open && !prefersReducedMotion) {
      // Fire initial confetti when modal opens
      const timer = setTimeout(() => {
        fireCelebration();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, fireCelebration, prefersReducedMotion]);

  const handleCelebrate = () => {
    fireCelebration();
    markModalShown();
    setTimeout(() => onOpenChange(false), 2000);
  };

  const handleClose = () => {
    markModalShown();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className={cn(
          'sm:max-w-md border-0 bg-transparent shadow-none',
          'overflow-visible'
        )}
        hideCloseButton
      >
        <DialogTitle className="sr-only">Feliz Aniversário!</DialogTitle>
        
        {/* Glow background effect */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-radial from-amber-400/20 via-pink-400/10 to-transparent blur-3xl" />
        </div>

        {/* Main card */}
        <div 
          className={cn(
            'relative rounded-2xl overflow-hidden',
            'bg-gradient-to-br from-amber-50 via-pink-50 to-purple-50',
            'dark:from-amber-950/80 dark:via-pink-950/80 dark:to-purple-950/80',
            'border border-amber-200/50 dark:border-amber-700/50',
            'shadow-2xl shadow-amber-500/20',
            'p-8 text-center',
            'animate-scale-in'
          )}
        >
          {/* Floating decorations */}
          <div className="absolute top-4 left-4 animate-bounce-slow">
            <Sparkles className="h-6 w-6 text-amber-400" />
          </div>
          <div className="absolute top-4 right-4 animate-bounce-slow delay-150">
            <Gift className="h-6 w-6 text-pink-400" />
          </div>
          <div className="absolute bottom-4 left-4 animate-bounce-slow delay-300">
            <PartyPopper className="h-6 w-6 text-purple-400" />
          </div>
          <div className="absolute bottom-4 right-4 animate-bounce-slow delay-75">
            <PartyPopper className="h-6 w-6 text-purple-400 scale-x-[-1]" />
          </div>

          {/* Main icon */}
          <div className="relative mx-auto mb-6 w-24 h-24">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-pink-500 rounded-full animate-pulse-glow" />
            <div className="absolute inset-1 bg-gradient-to-br from-amber-100 to-pink-100 dark:from-amber-900 dark:to-pink-900 rounded-full flex items-center justify-center">
              <Cake className="h-12 w-12 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-amber-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
            Feliz Aniversário!
          </h2>

          {/* Subtitle */}
          <p className="text-xl font-medium text-foreground mb-2">
            {userName}
          </p>

          {/* Message */}
          <p className="text-muted-foreground mb-6">
            🎉 Desejamos um dia incrível cheio de alegria! 🎈
          </p>

          {/* Celebrate button */}
          <Button
            onClick={handleCelebrate}
            className={cn(
              'relative overflow-hidden',
              'bg-gradient-to-r from-amber-500 via-pink-500 to-purple-500',
              'hover:from-amber-600 hover:via-pink-600 hover:to-purple-600',
              'text-white font-semibold px-8 py-3 text-lg',
              'shadow-lg shadow-pink-500/30',
              'transition-all duration-300 hover:scale-105',
              'border-0'
            )}
            size="lg"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Celebrar! 🎊
          </Button>

          {/* Skip link */}
          <button
            onClick={handleClose}
            className="block mx-auto mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Talvez depois
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
