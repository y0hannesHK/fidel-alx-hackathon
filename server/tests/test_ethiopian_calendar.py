from datetime import date, timedelta

import pytest

from app.ethiopian_calendar import format_both, to_ethiopian, to_gregorian

# (Gregorian, Ethiopian (year, month, day))
KNOWN = [
    # From the official site, given in the brief:
    (date(2026, 11, 13), (2019, 3, 4)),   # ህዳር 4 2019
    (date(2026, 11, 14), (2019, 3, 5)),
    (date(2026, 11, 15), (2019, 3, 6)),
    # New Year: 11 September ...
    (date(2026, 9, 10), (2018, 13, 5)),   # Pagume 5 (2018 is not a leap year)
    (date(2026, 9, 11), (2019, 1, 1)),    # Meskerem 1, 2019
    # ... or 12 September in the year before a Gregorian leap year (2028):
    (date(2027, 9, 11), (2019, 13, 6)),   # Pagume 6: 2019 is an Ethiopian leap year
    (date(2027, 9, 12), (2020, 1, 1)),    # Meskerem 1, 2020
    # Holidays: Genna (Tahsas 29) and Timket (Tir 11)
    (date(2027, 1, 7), (2019, 4, 29)),
    (date(2027, 1, 19), (2019, 5, 11)),
]


@pytest.mark.parametrize("gregorian,ethiopian", KNOWN)
def test_known_dates(gregorian, ethiopian):
    assert to_ethiopian(gregorian) == ethiopian
    assert to_gregorian(*ethiopian) == gregorian


def test_every_day_for_twelve_years_round_trips_and_is_consecutive():
    day = date(2020, 1, 1)
    previous = to_ethiopian(day - timedelta(days=1))
    while day < date(2032, 1, 1):
        eth = to_ethiopian(day)
        assert to_gregorian(*eth) == day
        y, m, d = previous
        pagume_days = 6 if y % 4 == 3 else 5
        if m < 13 and d < 30 or m == 13 and d < pagume_days:
            expected = (y, m, d + 1)
        elif m < 13:
            expected = (y, m + 1, 1)
        else:
            expected = (y + 1, 1, 1)
        assert eth == expected, (day, previous, eth)
        previous = eth
        day += timedelta(days=1)


def test_new_year_2016_was_12_september_2023():
    # Enkutatash 2016 E.C.: 12 Sep 2023 (the year before Gregorian leap year 2024).
    assert to_ethiopian(date(2023, 9, 12)) == (2016, 1, 1)
    assert to_ethiopian(date(2023, 9, 11)) == (2015, 13, 6)


def test_pagume_has_six_days_only_in_leap_years():
    to_gregorian(2019, 13, 6)  # leap year: fine
    with pytest.raises(ValueError):
        to_gregorian(2018, 13, 6)
    with pytest.raises(ValueError):
        to_gregorian(2019, 14, 1)


def test_format_both_calendars():
    assert format_both(date(2026, 11, 15)) == {
        "gregorian": "15 Nov 2026", "ethiopian": "ህዳር 6 2019", "ethiopian_en": "Hidar 6, 2019",
    }
