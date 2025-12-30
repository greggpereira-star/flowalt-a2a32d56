import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { BADGE_DEFINITIONS } from '@/hooks/useBadges';
import { cn } from '@/lib/utils';

interface BadgeToastProps {
  badgeType: string;
  onClose: () => void;
}

export function BadgeToast({ badgeType, onClose }: BadgeToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const badge = BADGE_DEFINITIONS[badgeType];

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100);
    
    // Auto close after 4 seconds
    const timeout = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [onClose]);

  if (!badge) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[100] transition-all duration-300 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
    >
      <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-lg shadow-lg p-4 flex items-center gap-4 min-w-[300px]">
        <div className="relative">
          <div className="absolute inset-0 animate-ping bg-white/30 rounded-full" />
          <div className="relative bg-white/20 rounded-full p-3">
            <span className="text-3xl">{badge.icon}</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-4 w-4" />
            <span className="text-xs font-medium opacity-90">Nova Conquista!</span>
          </div>
          <p className="font-bold text-lg">{badge.name}</p>
          <p className="text-sm opacity-90">{badge.description}</p>
        </div>
      </div>
    </div>
  );
}
