from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user, require_admin
from app.config.database import get_db
from app.models.schemas import BuildingCreate, BuildingUpdate
from app.repositories.building_repository import BuildingRepository
from app.services.building_service import BuildingService

router = APIRouter(tags=["buildings"])


@router.get("/buildings")
async def list_buildings(
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Listar todos los edificios."""
    service = BuildingService(BuildingRepository(db))
    return await service.get_all()


@router.post("/buildings", status_code=status.HTTP_201_CREATED)
async def create_building(
    body: BuildingCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Crear un nuevo edificio (solo admin)."""
    service = BuildingService(BuildingRepository(db))
    return await service.create(body)


@router.get("/buildings/{building_id}")
async def get_building(
    building_id: UUID,
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Obtener detalles de un edificio."""
    service = BuildingService(BuildingRepository(db))
    return await service.get_by_id(building_id)


@router.put("/buildings/{building_id}")
async def update_building(
    building_id: UUID,
    body: BuildingUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Actualizar información del edificio (solo admin)."""
    service = BuildingService(BuildingRepository(db))
    return await service.update(building_id, body)


@router.delete("/buildings/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_building(
    building_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Eliminar un edificio (solo admin)."""
    service = BuildingService(BuildingRepository(db))
    await service.delete(building_id)
