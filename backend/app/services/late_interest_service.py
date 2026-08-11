from __future__ import annotations

import calendar
import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable

LATE_INTEREST_START_PERIOD = "2026-08"


def period_due_date(period: str, due_day: int) -> date:
    year, month = map(int, period.split("-"))
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(due_day, last_day))


def month_period(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def next_month_start(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def normalize_payments(payments: Iterable[dict] | None) -> list[dict]:
    if isinstance(payments, str):
        payments = json.loads(payments)
    result = []
    for payment in payments or []:
        paid_at = payment.get("paid_at")
        if isinstance(paid_at, str):
            paid_at = date.fromisoformat(paid_at[:10])
        result.append(
            {
                "paid_at": paid_at,
                "amount": Decimal(str(payment.get("amount") or 0)),
            }
        )
    return sorted(result, key=lambda item: item["paid_at"])


def calculate_late_interest(
    *,
    principal: Decimal,
    period: str,
    due_day: int,
    annual_rates_by_period: dict[str, Decimal],
    payments: Iterable[dict] | None = None,
    as_of: date | None = None,
) -> dict:
    as_of = as_of or date.today()
    due_date = period_due_date(period, due_day)
    starts_at = due_date + timedelta(days=1)

    if principal <= 0 or period < LATE_INTEREST_START_PERIOD or as_of < starts_at:
        return {
            "interest": Decimal("0"),
            "starts_at": starts_at,
            "missing_rate_periods": [],
        }

    outstanding = principal
    for payment in normalize_payments(payments):
        if payment["paid_at"] <= due_date:
            outstanding -= payment["amount"]

    if outstanding <= 0:
        return {
            "interest": Decimal("0"),
            "starts_at": starts_at,
            "missing_rate_periods": [],
        }

    interest = Decimal("0")
    missing_rate_periods: set[str] = set()
    payment_idx = 0
    ordered_payments = [
        p for p in normalize_payments(payments) if p["paid_at"] > due_date
    ]
    current = starts_at

    while current <= as_of and outstanding > 0:
        while payment_idx < len(ordered_payments) and ordered_payments[payment_idx]["paid_at"] <= current:
            outstanding -= ordered_payments[payment_idx]["amount"]
            payment_idx += 1
        if outstanding <= 0:
            break

        period_key = month_period(current)
        month_end = next_month_start(current) - timedelta(days=1)
        span_end = min(month_end, as_of)
        while payment_idx < len(ordered_payments) and ordered_payments[payment_idx]["paid_at"] <= span_end:
            payment_day = ordered_payments[payment_idx]["paid_at"]
            if payment_day > current:
                days = (payment_day - current).days
                rate = annual_rates_by_period.get(period_key)
                if rate is None:
                    missing_rate_periods.add(period_key)
                else:
                    interest += outstanding * rate / Decimal("100") / Decimal("365") * Decimal(days)
            outstanding -= ordered_payments[payment_idx]["amount"]
            payment_idx += 1
            current = payment_day
            if outstanding <= 0:
                break
        if outstanding <= 0:
            break

        if current <= span_end:
            days = (span_end - current).days + 1
            rate = annual_rates_by_period.get(period_key)
            if rate is None:
                missing_rate_periods.add(period_key)
            else:
                interest += outstanding * rate / Decimal("100") / Decimal("365") * Decimal(days)
        current = span_end + timedelta(days=1)

    return {
        "interest": interest,
        "starts_at": starts_at,
        "missing_rate_periods": sorted(missing_rate_periods),
    }
