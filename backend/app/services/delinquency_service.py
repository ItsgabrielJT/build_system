from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.config.settings import settings
from app.repositories.delinquency_repository import DelinquencyRepository


def _saldo(esperado: Decimal, multas: Decimal, pagado: Decimal) -> Decimal:
    return max(Decimal("0"), esperado + multas - pagado)


def _period_status(period: str, saldo: Decimal, due_day: int) -> str:
    if saldo <= 0:
        return "CURRENT"
    try:
        year, month = map(int, period.split("-"))
        due_date = date(year, month, due_day)
        return "OVERDUE" if date.today() > due_date else "CURRENT"
    except (ValueError, TypeError):
        return "CURRENT"


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
            ps = _period_status(row["period"], s, settings.due_day)

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
            ps = _period_status(row["period"], s, settings.due_day)

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
