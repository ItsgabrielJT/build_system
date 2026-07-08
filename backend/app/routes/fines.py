from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import FineCreate, FineUpdate
from app.repositories.fine_repository import FineRepository
from app.services.fine_service import FineService

router = APIRouter(tags=["fines"])


@router.get("/fines")
async def list_fines(
    period: Optional[str] = None,
    status: Optional[str] = None,
    owner_id: Optional[UUID] = None,
    reason: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = FineService(FineRepository(db))
    return await service.get_all(
        period=period,
        status_filter=status,
        owner_id=owner_id,
        reason=reason,
        search=search,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )


@router.get("/fines/stats")
async def fine_stats(
    period: Optional[str] = None,
    status: Optional[str] = None,
    owner_id: Optional[UUID] = None,
    reason: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = FineService(FineRepository(db))
    return await service.get_stats(
        period=period,
        status_filter=status,
        owner_id=owner_id,
        reason=reason,
        search=search,
        start_date=start_date,
        end_date=end_date,
    )


@router.post("/fines", status_code=status.HTTP_201_CREATED)
async def create_fine(
    body: FineCreate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = FineService(FineRepository(db))
    return await service.create(body, created_by=user["user_id"])


@router.put("/fines/{fine_id}")
async def update_fine(
    fine_id: UUID,
    body: FineUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = FineService(FineRepository(db))
    return await service.update_status(fine_id, body)
