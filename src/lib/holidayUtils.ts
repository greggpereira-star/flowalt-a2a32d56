export type HolidayType = 'new_year' | 'christmas' | 'easter' | 'carnival';
export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';
export type CelebrationEventType = HolidayType | SeasonType;

export interface HolidayConfig {
  type: CelebrationEventType;
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
 * Calculate Carnival date (47 days before Easter - Shrove Tuesday)
 */
export function calculateCarnivalDate(year: number): Date {
  const easter = calculateEasterDate(year);
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  return carnival;
}

/**
 * Get the current season based on date (Southern Hemisphere - Brazil)
 */
export function getCurrentSeason(date: Date = new Date()): SeasonType {
  const month = date.getMonth();
  const day = date.getDate();
  
  // Southern Hemisphere seasons (Brazil)
  // Summer: Dec 21 - Mar 20
  // Autumn: Mar 21 - Jun 20
  // Winter: Jun 21 - Sep 22
  // Spring: Sep 23 - Dec 20
  
  if ((month === 11 && day >= 21) || month === 0 || month === 1 || (month === 2 && day <= 20)) {
    return 'summer';
  } else if ((month === 2 && day >= 21) || month === 3 || month === 4 || (month === 5 && day <= 20)) {
    return 'autumn';
  } else if ((month === 5 && day >= 21) || month === 6 || month === 7 || (month === 8 && day <= 22)) {
    return 'winter';
  } else {
    return 'spring';
  }
}

/**
 * Get the start date of a season (Southern Hemisphere)
 */
export function getSeasonStartDate(season: SeasonType, year: number): Date {
  switch (season) {
    case 'summer':
      return new Date(year - 1, 11, 21); // Dec 21 of previous year
    case 'autumn':
      return new Date(year, 2, 21); // Mar 21
    case 'winter':
      return new Date(year, 5, 21); // Jun 21
    case 'spring':
      return new Date(year, 8, 23); // Sep 23
  }
}

/**
 * Check if today is the first day of a season
 */
export function isSeasonStart(season: SeasonType): boolean {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  
  switch (season) {
    case 'summer':
      return month === 11 && day === 21;
    case 'autumn':
      return month === 2 && day === 21;
    case 'winter':
      return month === 5 && day === 21;
    case 'spring':
      return month === 8 && day === 23;
  }
}

/**
 * Check if we're in the season start window (day before, day of, day after)
 */
export function isInSeasonStartWindow(season: SeasonType): boolean {
  const today = new Date();
  const year = today.getFullYear();
  
  let startDate: Date;
  
  switch (season) {
    case 'summer':
      startDate = new Date(year, 11, 21);
      break;
    case 'autumn':
      startDate = new Date(year, 2, 21);
      break;
    case 'winter':
      startDate = new Date(year, 5, 21);
      break;
    case 'spring':
      startDate = new Date(year, 8, 23);
      break;
  }
  
  const dayBefore = new Date(startDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  
  const dayAfter = new Date(startDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayBeforeStart = new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate());
  const dayAfterEnd = new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate() + 1);
  
  return todayStart >= dayBeforeStart && todayStart < dayAfterEnd;
}

/**
 * Get current active season if in start window
 */
export function getActiveSeasonInWindow(): SeasonType | null {
  if (isInSeasonStartWindow('summer')) return 'summer';
  if (isInSeasonStartWindow('autumn')) return 'autumn';
  if (isInSeasonStartWindow('winter')) return 'winter';
  if (isInSeasonStartWindow('spring')) return 'spring';
  return null;
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
    case 'carnival': {
      const carnival = calculateCarnivalDate(year);
      // Carnival is celebrated from Saturday to Tuesday (4 days)
      const carnivalStart = new Date(carnival);
      carnivalStart.setDate(carnival.getDate() - 2); // Saturday before
      const carnivalEnd = new Date(carnival);
      carnivalEnd.setDate(carnival.getDate() + 1); // Wednesday (Ash Wednesday)
      
      const todayTime = today.getTime();
      return todayTime >= carnivalStart.getTime() && todayTime <= carnivalEnd.getTime();
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
  if (isHolidayToday('carnival')) return 'carnival';
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
    case 'carnival': {
      const carnival = calculateCarnivalDate(year);
      // Extended window for Carnival (Friday before to Wednesday after)
      const carnivalStart = new Date(carnival);
      carnivalStart.setDate(carnival.getDate() - 4); // Friday before
      const carnivalEnd = new Date(carnival);
      carnivalEnd.setDate(carnival.getDate() + 1); // Wednesday (Ash Wednesday)
      
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return todayStart >= carnivalStart && todayStart <= carnivalEnd;
    }
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
  if (isInHolidayWindow('carnival')) return 'carnival';
  return null;
}

/**
 * Get configuration for a specific holiday or season
 */
export function getHolidayConfig(event: CelebrationEventType): HolidayConfig {
  const configs: Record<CelebrationEventType, HolidayConfig> = {
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
    carnival: {
      type: 'carnival',
      name: 'Carnaval',
      message: 'É Carnaval! Vamos celebrar com alegria!',
      icon: '🎭',
      colors: {
        primary: 'hsl(280, 80%, 50%)',
        secondary: 'hsl(45, 100%, 50%)',
        accent: 'hsl(160, 80%, 45%)',
      },
      gradient: 'from-purple-600 via-yellow-400 to-green-500',
    },
    spring: {
      type: 'spring',
      name: 'Primavera',
      message: 'A Primavera chegou! Tempo de renovação e florescimento!',
      icon: '🌸',
      colors: {
        primary: 'hsl(330, 70%, 65%)',
        secondary: 'hsl(90, 60%, 50%)',
        accent: 'hsl(50, 90%, 60%)',
      },
      gradient: 'from-pink-400 via-rose-300 to-green-400',
    },
    summer: {
      type: 'summer',
      name: 'Verão',
      message: 'O Verão chegou! Aproveite o calor e a energia!',
      icon: '☀️',
      colors: {
        primary: 'hsl(40, 100%, 50%)',
        secondary: 'hsl(200, 80%, 50%)',
        accent: 'hsl(25, 95%, 55%)',
      },
      gradient: 'from-yellow-400 via-orange-400 to-sky-400',
    },
    autumn: {
      type: 'autumn',
      name: 'Outono',
      message: 'O Outono chegou! Tempo de colheita e reflexão!',
      icon: '🍂',
      colors: {
        primary: 'hsl(25, 80%, 50%)',
        secondary: 'hsl(45, 90%, 45%)',
        accent: 'hsl(0, 70%, 45%)',
      },
      gradient: 'from-orange-500 via-amber-400 to-red-500',
    },
    winter: {
      type: 'winter',
      name: 'Inverno',
      message: 'O Inverno chegou! Tempo de aconchego e planejamento!',
      icon: '❄️',
      colors: {
        primary: 'hsl(200, 60%, 70%)',
        secondary: 'hsl(220, 50%, 80%)',
        accent: 'hsl(180, 40%, 90%)',
      },
      gradient: 'from-slate-400 via-blue-300 to-cyan-200',
    },
  };

  return configs[event];
}

/**
 * Get the session storage key for a holiday
 */
export function getHolidaySessionKey(event: CelebrationEventType): string {
  const today = new Date();
  return `holiday_${event}_${today.getFullYear()}_shown`;
}

/**
 * Check if holiday modal was already shown today
 */
export function wasHolidayModalShown(event: CelebrationEventType): boolean {
  const key = getHolidaySessionKey(event);
  return sessionStorage.getItem(key) === 'true';
}

/**
 * Mark holiday modal as shown
 */
export function markHolidayModalShown(event: CelebrationEventType): void {
  const key = getHolidaySessionKey(event);
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
