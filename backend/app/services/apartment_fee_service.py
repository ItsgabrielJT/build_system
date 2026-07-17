from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import ApartmentFeeCreate, ApartmentFeeUpdate, BulkFeeCreate
from app.repositories.apartment_fee_repository import ApartmentFeeRepository


class ApartmentFeeService:
    def __init__(self, repo: ApartmentFeeRepository) -> None:
        self._repo = repo

    async def get_by_period(self, period: str) -> list[dict]:
        return await self._repo.get_by_period(period)

    async def create(self, data: ApartmentFeeCreate) -> dict:
        if await self._repo.fee_exists(data.apartment_id, data.period):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cuota ya existe para este período",
            )
        return await self._repo.create(data)

    async def update(self, fee_id: UUID, data: ApartmentFeeUpdate) -> dict:
        existing = await self._repo.get_by_id(fee_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuota no encontrada",
            )
        updated = await self._repo.update_amount(fee_id, data.amount)
        return updated

    async def bulk_upsert(self, data: BulkFeeCreate) -> dict:
        created = 0
        updated = 0
        for item in data.fees:
            _, was_created = await self._repo.upsert(
                item.apartment_id, data.period, item.amount
            )
            if was_created:
                created += 1
            else:
                updated += 1
        return {"created": created, "updated": updated}

    async def get_stats(self, period: str) -> dict:
        import re
        if not re.match(r"^\d{4}-\d{2}$", period):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Período debe tener formato YYYY-MM",
            )
        return await self._repo.get_stats(period)

    async def get_periods_summary(
        self, page: int, page_size: int, year: Optional[int]
    ) -> dict:
        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="page debe ser >= 1",
            )
        if page_size > 100:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="page_size no puede ser mayor a 100",
            )
        return await self._repo.get_periods_summary(page, page_size, year)

    async def delete(self, fee_id: UUID) -> dict:
        existing = await self._repo.get_by_id(fee_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuota no encontrada",
            )
        return await self._repo.delete(fee_id)

    async def bulk_delete(self, fee_ids: list[UUID]) -> dict:
        if not fee_ids:
            return {"deleted_fees": 0, "deleted_payments": 0}
        return await self._repo.bulk_delete(fee_ids)
