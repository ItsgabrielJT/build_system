from datetime import date
from decimal import Decimal

from app.services.late_interest_service import calculate_late_interest


def test_late_interest_uses_annual_rate_divided_by_365():
    result = calculate_late_interest(
        principal=Decimal("80.92"),
        period="2026-08",
        due_day=5,
        annual_rates_by_period={"2026-08": Decimal("6.79")},
        as_of=date(2026, 8, 6),
    )

    assert result["interest"] == Decimal("80.92") * Decimal("6.79") / Decimal("100") / Decimal("365")
    assert result["starts_at"] == date(2026, 8, 6)


def test_late_interest_changes_rate_by_month_without_recalculating_prior_days():
    result = calculate_late_interest(
        principal=Decimal("100.00"),
        period="2026-08",
        due_day=30,
        annual_rates_by_period={
            "2026-08": Decimal("6.79"),
            "2026-09": Decimal("7.30"),
        },
        as_of=date(2026, 9, 2),
    )

    expected = (
        Decimal("100.00") * Decimal("6.79") / Decimal("100") / Decimal("365")
        + Decimal("100.00") * Decimal("7.30") / Decimal("100") / Decimal("365") * Decimal("2")
    )
    assert result["interest"] == expected


def test_late_interest_does_not_accrue_before_august_2026():
    result = calculate_late_interest(
        principal=Decimal("100.00"),
        period="2026-07",
        due_day=5,
        annual_rates_by_period={"2026-07": Decimal("6.79")},
        as_of=date(2026, 8, 10),
    )

    assert result["interest"] == Decimal("0")


def test_late_interest_stops_when_capital_is_paid():
    result = calculate_late_interest(
        principal=Decimal("100.00"),
        period="2026-08",
        due_day=5,
        annual_rates_by_period={"2026-08": Decimal("6.79")},
        payments=[{"paid_at": date(2026, 8, 8), "amount": Decimal("100.00")}],
        as_of=date(2026, 8, 31),
    )

    expected = Decimal("100.00") * Decimal("6.79") / Decimal("100") / Decimal("365") * Decimal("2")
    assert result["interest"] == expected
