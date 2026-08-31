from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import BulkOtherChargeCreate, OtherChargeCreate, OtherChargeUpdate
from app.repositories.other_charge_repository import OtherChargeRepository


class OtherChargeService:
    def __init__(self, repo: OtherChargeRepository) -> None:
        self._repo = repo

    async def get_by_period(self, period: str, periodicity: Optional[str] = None) -> list[dict]:
        return await self._repo.get_by_period(period, periodicity)

    async def create(self, data: OtherChargeCreate, created_by: str) -> dict:
        if not data.concept.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Concepto requerido")
        if await self._repo.charge_exists(data.apartment_id, data.period, data.concept):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cobro ya existe para este período y concepto")
        return await self._repo.create(data, created_by)

    async def update(self, charge_id: UUID, data: OtherChargeUpdate) -> dict:
        existing = await self._repo.get_by_id(charge_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cobro no encontrado")
        updated = await self._repo.update(charge_id, data.concept, data.amount, data.periodicity)
        return updated

    async def bulk_upsert(self, data: BulkOtherChargeCreate, created_by: str) -> dict:
        if not data.concept.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Concepto requerido")
        created = 0
        updated = 0
        for item in data.charges:
            _, was_created = await self._repo.upsert(
                item.apartment_id,
                data.period,
                data.concept,
                item.amount,
                data.periodicity,
                created_by,
            )
            if was_created:
                created += 1
            else:
                updated += 1
        return {"created": created, "updated": updated}

    async def get_stats(self, period: str) -> dict:
        import re
        if not re.match(r"^\d{4}-\d{2}$", period):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Período debe tener formato YYYY-MM")
        return await self._repo.get_stats(period)

    async def get_periods_summary(self, page: int, page_size: int, year: Optional[int]) -> dict:
        if page < 1:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="page debe ser >= 1")
        if page_size > 100:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="page_size no puede ser mayor a 100")
        return await self._repo.get_periods_summary(page, page_size, year)

    async def delete(self, charge_id: UUID) -> dict:
        existing = await self._repo.get_by_id(charge_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cobro no encontrado")
        return await self._repo.delete(charge_id)

    async def bulk_delete(self, charge_ids: list[UUID]) -> dict:
        if not charge_ids:
            return {"deleted_charges": 0, "deleted_payments": 0}
        return await self._repo.bulk_delete(charge_ids)
