import React from 'react';
import { getActiveHolidayInWindow, getCurrentHoliday } from '@/lib/holidayUtils';
import { NewYearBanner } from './NewYearBanner';
import { ChristmasBanner } from './ChristmasBanner';
import { EasterBanner } from './EasterBanner';
import { NewYearModal } from './NewYearModal';
import { ChristmasModal } from './ChristmasModal';
import { EasterModal } from './EasterModal';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';

export const HolidayBanner: React.FC = () => {
  const activeHoliday = getActiveHolidayInWindow();
  const isExactHoliday = getCurrentHoliday();
  
  // Only show modal on exact holiday date
  const { showModal, setShowModal } = useHolidayEffects({ 
    holiday: activeHoliday || 'new_year',
    enabled: !!isExactHoliday
  });

  if (!activeHoliday) return null;

  return (
    <>
      {activeHoliday === 'new_year' && <NewYearBanner />}
      {activeHoliday === 'christmas' && <ChristmasBanner />}
      {activeHoliday === 'easter' && <EasterBanner />}

      {/* Auto-show modal on exact holiday */}
      {isExactHoliday === 'new_year' && (
        <NewYearModal open={showModal} onOpenChange={setShowModal} />
      )}
      {isExactHoliday === 'christmas' && (
        <ChristmasModal open={showModal} onOpenChange={setShowModal} />
      )}
      {isExactHoliday === 'easter' && (
        <EasterModal open={showModal} onOpenChange={setShowModal} />
      )}
    </>
  );
};
