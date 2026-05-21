from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import ApartmentFeeCreate, BulkFeeCreate
from app.repositories.apartment_fee_repository import ApartmentFeeRepository
from app.services.apartment_fee_service import ApartmentFeeService

router = APIRouter(tags=["apartment-fees"])


@router.get("/apartment-fees")
async def list_fees(
    period: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    repo = ApartmentFeeRepository(db)
    if period:
        return await repo.get_by_period(period)
    return await repo.get_all()


@router.post("/apartment-fees", status_code=status.HTTP_201_CREATED)
async def create_fee(
    body: ApartmentFeeCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.create(body)


@router.post("/apartment-fees/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_upload_fees(
    body: BulkFeeCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.bulk_upsert(body)
