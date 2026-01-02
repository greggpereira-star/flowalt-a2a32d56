export type HolidayType = 'new_year' | 'christmas' | 'easter';

export interface HolidayConfig {
  type: HolidayType;
  name: string;
  message: string;
  icon: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  gradient: string;
}

/**
 * Calculate Easter date using the Anonymous Gregorian algorithm
 * Works for years 1583-4099
 */
export function calculateEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

/**
 * Check if a specific holiday is today
 */
export function isHolidayToday(holiday: HolidayType): boolean {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  switch (holiday) {
    case 'new_year':
      return month === 0 && day === 1;
    case 'christmas':
      return month === 11 && day === 25;
    case 'easter': {
      const easter = calculateEasterDate(year);
      return month === easter.getMonth() && day === easter.getDate();
    }
    default:
      return false;
  }
}

/**
 * Get the current active holiday, if any
 */
export function getCurrentHoliday(): HolidayType | null {
  if (isHolidayToday('new_year')) return 'new_year';
  if (isHolidayToday('christmas')) return 'christmas';
  if (isHolidayToday('easter')) return 'easter';
  return null;
}

/**
 * Check if we're in the holiday "window" (day before, day of, day after)
 */
export function isInHolidayWindow(holiday: HolidayType): boolean {
  const today = new Date();
  const year = today.getFullYear();
  
  let holidayDate: Date;
  
  switch (holiday) {
    case 'new_year':
      holidayDate = new Date(year, 0, 1);
      // Also check Dec 31 of previous year
      const newYearsEve = new Date(year, 11, 31);
      const jan2 = new Date(year, 0, 2);
      if (today >= newYearsEve || today <= jan2) return true;
      return false;
    case 'christmas':
      holidayDate = new Date(year, 11, 25);
      break;
    case 'easter':
      holidayDate = calculateEasterDate(year);
      break;
    default:
      return false;
  }

  const dayBefore = new Date(holidayDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  
  const dayAfter = new Date(holidayDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayBeforeStart = new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate());
  const dayAfterEnd = new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate() + 1);

  return todayStart >= dayBeforeStart && todayStart < dayAfterEnd;
}

/**
 * Get active holiday in window (for showing banners)
 */
export function getActiveHolidayInWindow(): HolidayType | null {
  if (isInHolidayWindow('new_year')) return 'new_year';
  if (isInHolidayWindow('christmas')) return 'christmas';
  if (isInHolidayWindow('easter')) return 'easter';
  return null;
}

/**
 * Get configuration for a specific holiday
 */
export function getHolidayConfig(holiday: HolidayType): HolidayConfig {
  const configs: Record<HolidayType, HolidayConfig> = {
    new_year: {
      type: 'new_year',
      name: 'Ano Novo',
      message: 'Feliz Ano Novo! Que este ano traga novas conquistas!',
      icon: '🎆',
      colors: {
        primary: 'hsl(230, 80%, 30%)',
        secondary: 'hsl(270, 70%, 40%)',
        accent: 'hsl(45, 100%, 50%)',
      },
      gradient: 'from-blue-900 via-purple-800 to-indigo-900',
    },
    christmas: {
      type: 'christmas',
      name: 'Natal',
      message: 'Feliz Natal! Boas festas para você e sua equipe!',
      icon: '🎄',
      colors: {
        primary: 'hsl(120, 60%, 25%)',
        secondary: 'hsl(0, 70%, 45%)',
        accent: 'hsl(45, 100%, 50%)',
      },
      gradient: 'from-green-800 via-red-700 to-green-900',
    },
    easter: {
      type: 'easter',
      name: 'Páscoa',
      message: 'Feliz Páscoa! Renove suas energias!',
      icon: '🐰',
      colors: {
        primary: 'hsl(330, 60%, 70%)',
        secondary: 'hsl(270, 50%, 70%)',
        accent: 'hsl(180, 50%, 70%)',
      },
      gradient: 'from-pink-300 via-purple-300 to-blue-300',
    },
  };

  return configs[holiday];
}

/**
 * Get the session storage key for a holiday
 */
export function getHolidaySessionKey(holiday: HolidayType): string {
  const today = new Date();
  return `holiday_${holiday}_${today.getFullYear()}_shown`;
}

/**
 * Check if holiday modal was already shown today
 */
export function wasHolidayModalShown(holiday: HolidayType): boolean {
  const key = getHolidaySessionKey(holiday);
  return sessionStorage.getItem(key) === 'true';
}

/**
 * Mark holiday modal as shown
 */
export function markHolidayModalShown(holiday: HolidayType): void {
  const key = getHolidaySessionKey(holiday);
  sessionStorage.setItem(key, 'true');
}

/**
 * Check if it's New Year's Eve after 6pm (for countdown)
 */
export function isNewYearsEveEvening(): boolean {
  const now = new Date();
  return now.getMonth() === 11 && now.getDate() === 31 && now.getHours() >= 18;
}

/**
 * Get time until midnight for New Year countdown
 */
export function getTimeUntilMidnight(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const midnight = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds };
}
