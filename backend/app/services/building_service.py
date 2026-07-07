from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import BuildingCreate, BuildingUpdate
from app.repositories.building_repository import BuildingRepository


class BuildingService:
    def __init__(self, repo: BuildingRepository) -> None:
        self._repo = repo

    async def get_all(self) -> list[dict]:
        return await self._repo.get_all()

    async def get_config(self) -> dict:
        building = await self._repo.get_default()
        if building:
            return building
        return await self._repo.create(
            BuildingCreate(
                name="Edificio Principal",
            )
        )

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

    async def update_assets(
        self,
        building_id: UUID,
        *,
        photo_meta: dict | None = None,
        logo_meta: dict | None = None,
    ) -> dict:
        await self.get_by_id(building_id)

        payload = SimpleNamespace(
            name=None,
            address=None,
            phone=None,
            email=None,
            photo_file_name=photo_meta["file_name"] if photo_meta else None,
            photo_content_type=photo_meta["content_type"] if photo_meta else None,
            photo_storage_path=photo_meta["storage_path"] if photo_meta else None,
            logo_file_name=logo_meta["file_name"] if logo_meta else None,
            logo_content_type=logo_meta["content_type"] if logo_meta else None,
            logo_storage_path=logo_meta["storage_path"] if logo_meta else None,
        )
        updated = await self._repo.update(building_id, payload)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Edificio no encontrado",
            )
        return updated

    async def update_config(
        self,
        data: BuildingUpdate,
        *,
        photo_meta: dict | None = None,
        logo_meta: dict | None = None,
    ) -> dict:
        building = await self.get_config()
        payload = SimpleNamespace(
            name=data.name,
            address=data.address,
            phone=data.phone,
            email=data.email,
            photo_file_name=photo_meta["file_name"] if photo_meta else None,
            photo_content_type=photo_meta["content_type"] if photo_meta else None,
            photo_storage_path=photo_meta["storage_path"] if photo_meta else None,
            logo_file_name=logo_meta["file_name"] if logo_meta else None,
            logo_content_type=logo_meta["content_type"] if logo_meta else None,
            logo_storage_path=logo_meta["storage_path"] if logo_meta else None,
        )
        updated = await self._repo.update(building["id"], payload)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuración del edificio no encontrada",
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
