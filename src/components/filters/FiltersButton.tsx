import React from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FiltersButtonProps {
  activeCount: number;
  onClick: () => void;
  className?: string;
}

export const FiltersButton: React.FC<FiltersButtonProps> = ({
  activeCount,
  onClick,
  className,
}) => {
  return (
    <Button
      variant={activeCount > 0 ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className={cn('gap-2', className)}
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
};
