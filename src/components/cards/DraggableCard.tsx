import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface DraggableCardProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({ 
  id, 
  children,
  disabled = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ 
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    cursor: disabled ? 'default' : 'grab',
    zIndex: isDragging ? 1000 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'touch-none select-none',
        isDragging && 'pointer-events-none'
      )}
    >
      {children}
    </div>
  );
};
