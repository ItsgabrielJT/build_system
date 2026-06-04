from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.config.settings import settings
from app.repositories.delinquency_repository import DelinquencyRepository


def _saldo(esperado: Decimal, multas: Decimal, pagado: Decimal) -> Decimal:
    return esperado + multas - pagado


def _period_status(period: str, saldo: Decimal, due_day: int, esperado: Decimal = Decimal("0")) -> str:
    if saldo <= 0:
        return "CURRENT"
    try:
        due_date = _period_due_date(period, due_day)
        if date.today() > due_date:
            return "OVERDUE"
        return "OVERDUE" if saldo > esperado else "CURRENT"
    except (ValueError, TypeError):
        return "CURRENT"


def _period_due_date(period: str, due_day: int) -> date:
    year, month = map(int, period.split("-"))
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(due_day, last_day))


def _previous_period(period: str) -> str:
    year, month = map(int, period.split("-"))
    if month == 1:
        return f"{year - 1}-12"
    return f"{year}-{month - 1:02d}"


def _aging_bucket(period: str, due_day: int) -> str:
    try:
        days_overdue = max((date.today() - _period_due_date(period, due_day)).days, 0)
    except (ValueError, TypeError):
        return "30_days"
    if days_overdue <= 30:
        return "30_days"
    if days_overdue <= 60:
        return "60_days"
    return "90_plus_days"


class DelinquencyService:
    def __init__(self, repo: DelinquencyRepository) -> None:
        self._repo = repo

    async def list_owners(self, status_filter: Optional[str] = None) -> list[dict]:
        rows = await self._repo.get_all_period_data()
        owners: dict[UUID, dict] = {}

        for row in rows:
            oid = row["owner_id"]
            s = _saldo(
                Decimal(str(row["esperado"])),
                Decimal(str(row["multas"])),
                Decimal(str(row["pagado"])),
            )
            ps = _period_status(row["period"], s, settings.due_day, Decimal(str(row["esperado"])))

            if oid not in owners:
                owners[oid] = {
                    "id": oid,
                    "owner_id": oid,
                    "owner_name": row["full_name"],
                    "email": row["email"],
                    "document_id": row["document_id"],
                    "deuda_total": Decimal("0"),
                    "periodos_vencidos": 0,
                    "departamentos": set(),
                    "status": "CURRENT",
                }

            owner = owners[oid]
            owner["departamentos"].add(row["apartment_code"])

            if ps == "OVERDUE":
                owner["deuda_total"] += s
                owner["periodos_vencidos"] += 1
                owner["status"] = "OVERDUE"

        result = []
        for owner in owners.values():
            owner["departamentos"] = list(owner["departamentos"])
            owner["deuda_total"] = float(owner["deuda_total"])
            if status_filter == "OVERDUE" and owner["status"] != "OVERDUE":
                continue
            result.append(owner)

        return sorted(result, key=lambda x: x["deuda_total"], reverse=True)

    async def get_stats(self) -> dict:
        rows = await self._repo.get_all_period_data()
        total_apartments = await self._repo.get_active_apartment_count()

        if not rows:
            return {
                "summary": {
                    "total_debt": 0.0,
                    "debt_change_percent": 0.0,
                    "delinquent_units": 0,
                    "total_units": total_apartments,
                    "affected_percent": 0.0,
                    "average_debt": 0.0,
                },
                "aging": {
                    "30_days": {"amount": 0.0, "percent": 0.0},
                    "60_days": {"amount": 0.0, "percent": 0.0},
                    "90_plus_days": {"amount": 0.0, "percent": 0.0},
                },
                "units": [],
            }

        periods = [row["period"] for row in rows if row.get("period")]
        if not periods:
            return {
                "summary": {
                    "total_debt": 0.0,
                    "debt_change_percent": 0.0,
                    "delinquent_units": 0,
                    "total_units": total_apartments,
                    "affected_percent": 0.0,
                    "average_debt": 0.0,
                },
                "aging": {
                    "30_days": {"amount": 0.0, "percent": 0.0},
                    "60_days": {"amount": 0.0, "percent": 0.0},
                    "90_plus_days": {"amount": 0.0, "percent": 0.0},
                },
                "units": [],
            }

        latest_period = max(periods)
        prev_period = _previous_period(latest_period)
        units: dict[UUID, dict] = {}
        aging_amounts = {
            "30_days": Decimal("0"),
            "60_days": Decimal("0"),
            "90_plus_days": Decimal("0"),
        }
        current_period_debt = Decimal("0")
        previous_period_debt = Decimal("0")

        for row in rows:
            s = _saldo(
                Decimal(str(row["esperado"])),
                Decimal(str(row["multas"])),
                Decimal(str(row["pagado"])),
            )
            if _period_status(row["period"], s, settings.due_day, Decimal(str(row["esperado"]))) != "OVERDUE":
                continue

            if row["period"] == latest_period:
                current_period_debt += s
            if row["period"] == prev_period:
                previous_period_debt += s

            aid = row["apartment_id"]
            bucket = _aging_bucket(row["period"], settings.due_day)
            aging_amounts[bucket] += s

            if aid not in units:
                units[aid] = {
                    "apartment_id": aid,
                    "unit": row["apartment_code"],
                    "owner_id": row["owner_id"],
                    "owner_name": row["full_name"],
                    "email": row["email"],
                    "floor": row.get("floor"),
                    "30_days": Decimal("0"),
                    "60_days": Decimal("0"),
                    "90_plus_days": Decimal("0"),
                    "total_debt": Decimal("0"),
                }

            units[aid][bucket] += s
            units[aid]["total_debt"] += s

        total_debt = sum((unit["total_debt"] for unit in units.values()), Decimal("0"))
        delinquent_units = len(units)
        affected_percent = (
            (delinquent_units / total_apartments) * 100 if total_apartments else 0.0
        )
        average_debt = total_debt / delinquent_units if delinquent_units else Decimal("0")
        debt_change_percent = 0.0
        if previous_period_debt > 0:
            debt_change_percent = float(
                ((current_period_debt - previous_period_debt) / previous_period_debt) * 100
            )

        aging = {}
        for bucket, amount in aging_amounts.items():
            percent = (float(amount / total_debt * 100) if total_debt > 0 else 0.0)
            aging[bucket] = {"amount": float(amount), "percent": round(percent, 2)}

        unit_rows = []
        for unit in units.values():
            unit_rows.append(
                {
                    **unit,
                    "30_days": float(unit["30_days"]),
                    "60_days": float(unit["60_days"]),
                    "90_plus_days": float(unit["90_plus_days"]),
                    "total_debt": float(unit["total_debt"]),
                }
            )

        return {
            "summary": {
                "total_debt": float(total_debt),
                "debt_change_percent": round(debt_change_percent, 2),
                "delinquent_units": delinquent_units,
                "total_units": total_apartments,
                "affected_percent": round(affected_percent, 2),
                "average_debt": float(average_debt),
            },
            "aging": aging,
            "units": sorted(unit_rows, key=lambda x: x["total_debt"], reverse=True),
        }

    async def get_owner_detail(self, owner_id: UUID) -> dict | None:
        rows = await self._repo.get_period_data_for_owner(owner_id)
        if not rows:
            return None

        first = rows[0]
        apartments: dict[UUID, dict] = {}

        for row in rows:
            aid = row["apartment_id"]
            s = _saldo(
                Decimal(str(row["esperado"])),
                Decimal(str(row["multas"])),
                Decimal(str(row["pagado"])),
            )
            ps = _period_status(row["period"], s, settings.due_day, Decimal(str(row["esperado"])))

            if aid not in apartments:
                apartments[aid] = {
                    "apartment": {
                        "id": aid,
                        "code": row["apartment_code"],
                        "floor": row.get("floor"),
                    },
                    "periods": [],
                }

            apartments[aid]["periods"].append(
                {
                    "period": row["period"],
                    "esperado": float(row["esperado"]),
                    "multas": float(row["multas"]),
                    "pagado": float(row["pagado"]),
                    "saldo": float(s),
                    "status": ps,
                }
            )

        return {
            "owner_id": first["owner_id"],
            "full_name": first["full_name"],
            "email": first["email"],
            "apartments": list(apartments.values()),
        }
