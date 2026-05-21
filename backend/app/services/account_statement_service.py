from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.config.settings import settings
from app.repositories.delinquency_repository import DelinquencyRepository
from app.repositories.owner_repository import OwnerRepository
from app.services.delinquency_service import _period_status, _saldo


class AccountStatementService:
    def __init__(
        self,
        delinquency_repo: DelinquencyRepository,
        owner_repo: OwnerRepository,
    ) -> None:
        self._delinquency_repo = delinquency_repo
        self._owner_repo = owner_repo

    async def resolve_owner_id(
        self, user: dict, requested_owner_id: Optional[UUID] = None
    ) -> UUID | None:
        """
        ADMIN puede pasar owner_id explícito.
        PROPIETARIO se resuelve automáticamente por firebase_uid.
        """
        if user.get("role") == "ADMIN" and requested_owner_id:
            return requested_owner_id

        owner = await self._owner_repo.get_by_firebase_uid(user["user_id"])
        return owner["id"] if owner else None

    async def get_statement(
        self,
        owner_id: UUID,
        start_period: Optional[str],
        end_period: Optional[str],
    ) -> list[dict]:
        rows = await self._delinquency_repo.get_statement_data(
            owner_id, start_period, end_period
        )
        result = []
        for row in rows:
            s = _saldo(
                Decimal(str(row["esperado"])),
                Decimal(str(row["multas"])),
                Decimal(str(row["pagado"])),
            )
            ps = _period_status(row["period"], s, settings.due_day)
            result.append(
                {
                    "period": row["period"],
                    "apartment_id": row["apartment_id"],
                    "apartment_code": row["apartment_code"],
                    "esperado": float(row["esperado"]),
                    "multas": float(row["multas"]),
                    "pagado": float(row["pagado"]),
                    "saldo": float(s),
                    "status": ps,
                }
            )
        return result
