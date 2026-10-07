import React from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FiltersButtonProps extends Omit<React.ComponentPropsWithoutRef<typeof Button>, 'variant' | 'size'> {
  activeCount: number;
}

// Repassa ref e props: quando usado como gatilho de popover (asChild), o painel se ancora neste botão.
export const FiltersButton = React.forwardRef<HTMLButtonElement, FiltersButtonProps>(
  ({ activeCount, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={activeCount > 0 ? 'default' : 'outline'}
        size="sm"
        className={cn('gap-2', className)}
        {...props}
      >
        <Filter className="h-4 w-4" />
        Filtros
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
            {activeCount}
          </Badge>
        )}
      </Button>
    );
  }
);
FiltersButton.displayName = 'FiltersButton';
