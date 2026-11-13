"""Ethiopian calendar conversion (written for Fidel, no library needed).

The Ethiopian year has 12 months of 30 days and a 13th month, Pagume, of 5
days (6 in a leap year). New Year (Meskerem 1) is 11 September, or 12
September in the year before a Gregorian leap year.

Method: convert through the Julian Day Number (JDN), a simple count of days.
"""

from datetime import date

ETHIOPIC_EPOCH = 1724221  # JDN of Meskerem 1, year 1 (Amete Mihret era)

MONTHS_AM = ["መስከረም", "ጥቅምት", "ህዳር", "ታህሳስ", "ጥር", "የካቲት",
             "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜ"]
MONTHS_EN = ["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit",
             "Megabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"]


def _new_year_jdn(year: int) -> int:
    """JDN of Meskerem 1 of an Ethiopian year."""
    return ETHIOPIC_EPOCH + 365 * (year - 1) + year // 4


def to_ethiopian(day: date) -> tuple[int, int, int]:
    """Gregorian date -> (year, month 1-13, day).

    Method from "Calendrical Calculations" (Dershowitz & Reingold): find the
    year first, then count days from its New Year.
    """
    jdn = day.toordinal() + 1721425  # date.toordinal() counts from 1 Jan year 1
    year = (4 * (jdn - ETHIOPIC_EPOCH) + 1463) // 1461
    days_into_year = jdn - _new_year_jdn(year)
    return year, days_into_year // 30 + 1, days_into_year % 30 + 1


def to_gregorian(year: int, month: int, day: int) -> date:
    """(Ethiopian year, month, day) -> Gregorian date."""
    if not (1 <= month <= 13 and 1 <= day <= 30) or (month == 13 and day > (6 if year % 4 == 3 else 5)):
        raise ValueError("Not a valid Ethiopian date.")
    jdn = _new_year_jdn(year) + 30 * (month - 1) + day - 1
    return date.fromordinal(jdn - 1721425)


def format_both(day: date) -> dict[str, str]:
    """{'gregorian': '15 Nov 2026', 'ethiopian': 'ህዳር 6 2019', 'ethiopian_en': 'Hidar 6, 2019'}"""
    year, month, d = to_ethiopian(day)
    return {
        "gregorian": f"{day.day} {day.strftime('%b')} {day.year}",
        "ethiopian": f"{MONTHS_AM[month - 1]} {d} {year}",
        "ethiopian_en": f"{MONTHS_EN[month - 1]} {d}, {year}",
    }
