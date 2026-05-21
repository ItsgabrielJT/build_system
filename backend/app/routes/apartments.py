from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import ApartmentCreate, ApartmentUpdate, OwnerAssign
from app.repositories.apartment_repository import ApartmentRepository
from app.services.apartment_service import ApartmentService

router = APIRouter(tags=["apartments"])


@router.get("/apartments")
async def list_apartments(
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    return await service.get_all()


@router.post("/apartments", status_code=status.HTTP_201_CREATED)
async def create_apartment(
    body: ApartmentCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    return await service.create(body)


@router.get("/apartments/{apartment_id}")
async def get_apartment(
    apartment_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    result = await service.get_by_id(apartment_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Departamento no encontrado",
        )
    return result


@router.put("/apartments/{apartment_id}")
async def update_apartment(
    apartment_id: UUID,
    body: ApartmentUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    result = await service.update(apartment_id, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Departamento no encontrado",
        )
    return result


@router.post(
    "/apartments/{apartment_id}/owners/{owner_id}",
    status_code=status.HTTP_201_CREATED,
)
async def assign_owner(
    apartment_id: UUID,
    owner_id: UUID,
    body: OwnerAssign = OwnerAssign(),
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    return await service.assign_owner(apartment_id, owner_id, body)


@router.delete(
    "/apartments/{apartment_id}/owners/{owner_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_owner(
    apartment_id: UUID,
    owner_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    found = await service.remove_owner(apartment_id, owner_id)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada",
        )
