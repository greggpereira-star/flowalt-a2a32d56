import React from 'react';
import { getActiveHolidayInWindow, getCurrentHoliday, getActiveSeasonInWindow, isSeasonStart } from '@/lib/holidayUtils';
import { NewYearBanner } from './NewYearBanner';
import { ChristmasBanner } from './ChristmasBanner';
import { EasterBanner } from './EasterBanner';
import { CarnivalBanner } from './CarnivalBanner';
import { SeasonBanner } from './SeasonBanner';
import { NewYearModal } from './NewYearModal';
import { ChristmasModal } from './ChristmasModal';
import { EasterModal } from './EasterModal';
import { CarnivalModal } from './CarnivalModal';
import { SeasonModal } from './SeasonModal';
import { useHolidayEffects } from '@/hooks/useHolidayEffects';

export const HolidayBanner: React.FC = () => {
  const activeHoliday = getActiveHolidayInWindow();
  const isExactHoliday = getCurrentHoliday();
  const activeSeason = getActiveSeasonInWindow();
  
  const { showModal: showHolidayModal, setShowModal: setShowHolidayModal } = useHolidayEffects({ 
    holiday: activeHoliday || 'new_year',
    enabled: !!isExactHoliday
  });

  const { showModal: showSeasonModal, setShowModal: setShowSeasonModal } = useHolidayEffects({ 
    holiday: activeSeason || 'spring',
    enabled: activeSeason ? isSeasonStart(activeSeason) : false
  });

  return (
    <>
      {/* Holiday Banners */}
      {activeHoliday === 'new_year' && <NewYearBanner />}
      {activeHoliday === 'christmas' && <ChristmasBanner />}
      {activeHoliday === 'easter' && <EasterBanner />}
      {activeHoliday === 'carnival' && <CarnivalBanner />}

      {/* Season Banners */}
      {!activeHoliday && activeSeason && <SeasonBanner season={activeSeason} />}

      {/* Holiday Modals */}
      {isExactHoliday === 'new_year' && (
        <NewYearModal open={showHolidayModal} onOpenChange={setShowHolidayModal} />
      )}
      {isExactHoliday === 'christmas' && (
        <ChristmasModal open={showHolidayModal} onOpenChange={setShowHolidayModal} />
      )}
      {isExactHoliday === 'easter' && (
        <EasterModal open={showHolidayModal} onOpenChange={setShowHolidayModal} />
      )}
      {isExactHoliday === 'carnival' && (
        <CarnivalModal open={showHolidayModal} onOpenChange={setShowHolidayModal} />
      )}

      {/* Season Modals */}
      {!isExactHoliday && activeSeason && isSeasonStart(activeSeason) && (
        <SeasonModal season={activeSeason} open={showSeasonModal} onOpenChange={setShowSeasonModal} />
      )}
    </>
  );
};
