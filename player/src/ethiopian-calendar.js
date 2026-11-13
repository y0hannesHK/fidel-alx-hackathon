// Ethiopian calendar conversion (same method as server/app/ethiopian_calendar.py).
// 12 months of 30 days + Pagume (5 days, 6 in a leap year). New Year
// (Meskerem 1) is 11 September, or 12 September in the year before a
// Gregorian leap year. We count days with the Julian Day Number (JDN).

const ETHIOPIC_EPOCH = 1724221; // JDN of Meskerem 1, year 1
const UNIX_EPOCH_JDN = 2440588; // JDN of 1 January 1970

export const MONTHS_AM = ['መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'];
export const MONTHS_EN = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];
const GREGORIAN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const newYearJdn = (year) => ETHIOPIC_EPOCH + 365 * (year - 1) + Math.floor(year / 4);

/** Gregorian (year, month 1-12, day) -> { year, month 1-13, day } */
export function toEthiopian(gYear, gMonth, gDay) {
  const jdn = Math.floor(Date.UTC(gYear, gMonth - 1, gDay) / 86400000) + UNIX_EPOCH_JDN;
  const year = Math.floor((4 * (jdn - ETHIOPIC_EPOCH) + 1463) / 1461);
  const daysIntoYear = jdn - newYearJdn(year);
  return { year, month: Math.floor(daysIntoYear / 30) + 1, day: (daysIntoYear % 30) + 1 };
}

/** "2026-11-15" -> { gregorian: '15 Nov 2026', ethiopian: 'ህዳር 6 2019', ethiopianEn: 'Hidar 6, 2019' } */
export function formatBoth(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const eth = toEthiopian(y, m, d);
  return {
    gregorian: `${d} ${GREGORIAN_MONTHS[m - 1]} ${y}`,
    ethiopian: `${MONTHS_AM[eth.month - 1]} ${eth.day} ${eth.year}`,
    ethiopianEn: `${MONTHS_EN[eth.month - 1]} ${eth.day}, ${eth.year}`,
  };
}
