import React from 'react';
import symbol from '@/assets/flowalt-symbol.png';
import { cn } from '@/lib/utils';

interface FlowaltLogoProps {
  /** Show the wordmark next to the symbol. */
  showWordmark?: boolean;
  /** Pixel size of the symbol (defaults to 32). */
  size?: number;
  className?: string;
  wordmarkClassName?: string;
}

/**
 * FlowAlt brand mark.
 * The symbol is the vibrant "F" (three organic blades) —
 * clareza, ação e progresso sem atrito.
 */
export const FlowaltLogo: React.FC<FlowaltLogoProps> = ({
  showWordmark = true,
  size = 32,
  className,
  wordmarkClassName,
}) => {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={symbol}
        alt="Flowalt"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-[22%] object-contain"
        draggable={false}
      />
      {showWordmark && (
        <span
          className={cn(
            'font-semibold tracking-tight text-foreground',
            'text-[1.15rem] leading-none',
            wordmarkClassName,
          )}
        >
          Flow<span className="text-brand-gradient font-bold">alt</span>
        </span>
      )}
    </div>
  );
};

export default FlowaltLogo;
