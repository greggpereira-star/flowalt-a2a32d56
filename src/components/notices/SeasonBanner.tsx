import React, { useState } from 'react';
import { X, Sun, Leaf, Snowflake, Flower2 } from 'lucide-react';
import { SeasonType, getHolidayConfig } from '@/lib/holidayUtils';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';
import { SeasonModal } from './SeasonModal';

interface SeasonBannerProps {
  season: SeasonType;
  onDismiss?: () => void;
}

const seasonIcons: Record<SeasonType, React.ReactNode> = {
  spring: <Flower2 className="w-5 h-5" />,
  summer: <Sun className="w-5 h-5" />,
  autumn: <Leaf className="w-5 h-5" />,
  winter: <Snowflake className="w-5 h-5" />,
};

const seasonEmojis: Record<SeasonType, string[]> = {
  spring: ['🌸', '🌷', '🦋', '🌺'],
  summer: ['☀️', '🌊', '🏖️', '🍉'],
  autumn: ['🍂', '🍁', '🎃', '🌰'],
  winter: ['❄️', '⛄', '🧣', '☕'],
};

const seasonGradients: Record<SeasonType, string> = {
  spring: 'linear-gradient(135deg, #f472b6 0%, #a3e635 100%)',
  summer: 'linear-gradient(135deg, #fbbf24 0%, #38bdf8 100%)',
  autumn: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
  winter: 'linear-gradient(135deg, #94a3b8 0%, #67e8f9 100%)',
};

export const SeasonBanner: React.FC<SeasonBannerProps> = ({ season, onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const config = getHolidayConfig(season);
  const { fireMiniEffect } = useHolidayEffects({ holiday: season, enabled: false });

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <>
      <div
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) fireMiniEffect();
        }}
        className="relative overflow-hidden rounded-xl p-4 mb-4 cursor-pointer select-none transition-all hover:scale-[1.01]"
        style={{ background: seasonGradients[season] }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-xl opacity-20 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            >
              {seasonEmojis[season][i % 4]}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-3xl">
              <span className="animate-bounce">{config.icon}</span>
            </div>
            <div className="text-white">
              <p className="font-bold text-lg flex items-center gap-2">
                {config.name} chegou! {seasonIcons[season]}
              </p>
              <p className="text-sm text-white/80">{config.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-medium transition-colors"
            >
              Celebrar
            </button>
            <button onClick={handleDismiss} className="p-1.5 hover:bg-white/10 rounded-full">
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      </div>
      <SeasonModal season={season} open={showModal} onOpenChange={setShowModal} />
    </>
  );
};
