from __future__ import annotations

from fastapi import HTTPException, status

from app.models.schemas import ApartmentFeeCreate, BulkFeeCreate
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
