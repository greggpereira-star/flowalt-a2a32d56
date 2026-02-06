import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface CardPropertyRowProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const CardPropertyRow: React.FC<CardPropertyRowProps> = ({
  icon: Icon,
  label,
  children,
  className,
}) => {
  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      <div className="flex items-center gap-2 w-36 flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
};
