from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.repositories.delinquency_repository import DelinquencyRepository
from app.services.delinquency_service import DelinquencyService

router = APIRouter(tags=["delinquency"])


@router.get("/delinquency")
async def list_delinquent_owners(
    status: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = DelinquencyService(DelinquencyRepository(db))
    return await service.list_owners(status_filter=status)


@router.get("/delinquency/detail/{owner_id}")
async def get_owner_delinquency_detail(
    owner_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = DelinquencyService(DelinquencyRepository(db))
    result = await service.get_owner_detail(owner_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado o sin datos de morosidad",
        )
    return result
