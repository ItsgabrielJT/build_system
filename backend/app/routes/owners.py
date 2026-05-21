from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user, require_admin
from app.config.database import get_db
from app.models.schemas import OwnerCreate, OwnerUpdate
from app.repositories.owner_repository import OwnerRepository
from app.services.owner_service import OwnerService

router = APIRouter(tags=["owners"])


@router.get("/owners")
async def list_owners(
    status: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    return await service.get_all(status)


@router.post("/owners", status_code=status.HTTP_201_CREATED)
async def create_owner(
    body: OwnerCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    return await service.create(body)


@router.get("/owners/{owner_id}")
async def get_owner(
    owner_id: UUID,
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    result = await service.get_by_id_with_apartments(owner_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )
    return result


@router.put("/owners/{owner_id}")
async def update_owner(
    owner_id: UUID,
    body: OwnerUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    result = await service.update(owner_id, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )
    return result


@router.delete("/owners/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_owner(
    owner_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    found = await service.soft_delete(owner_id)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )
