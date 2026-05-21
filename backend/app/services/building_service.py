from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import BuildingCreate, BuildingUpdate
from app.repositories.building_repository import BuildingRepository


class BuildingService:
    def __init__(self, repo: BuildingRepository) -> None:
        self._repo = repo

    async def get_all(self) -> list[dict]:
        return await self._repo.get_all()

    async def get_by_id(self, building_id: UUID) -> dict:
        building = await self._repo.get_by_id(building_id)
        if not building:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Edificio no encontrado",
            )
        return building

    async def create(self, data: BuildingCreate) -> dict:
        return await self._repo.create(data)

    async def update(self, building_id: UUID, data: BuildingUpdate) -> dict:
        # Verificar que existe
        await self.get_by_id(building_id)
        
        updated = await self._repo.update(building_id, data)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Edificio no encontrado",
            )
        return updated

    async def delete(self, building_id: UUID) -> bool:
        # Verificar que existe
        await self.get_by_id(building_id)
        
        success = await self._repo.delete(building_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Edificio no encontrado",
            )
        return success
