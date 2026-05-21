from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import OwnerCreate, OwnerUpdate
from app.repositories.owner_repository import OwnerRepository


class OwnerService:
    def __init__(self, repo: OwnerRepository) -> None:
        self._repo = repo

    async def get_all(self, status_filter: Optional[str] = None) -> list[dict]:
        return await self._repo.get_all(status_filter)

    async def get_by_id_with_apartments(self, owner_id: UUID) -> dict | None:
        return await self._repo.get_by_id_with_apartments(owner_id)

    async def create(self, data: OwnerCreate) -> dict:
        if await self._repo.document_id_exists(data.document_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Documento ya registrado",
            )
        return await self._repo.create(data)

    async def update(self, owner_id: UUID, data: OwnerUpdate) -> dict | None:
        if data.document_id:
            if await self._repo.document_id_exists(data.document_id, exclude_id=owner_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Documento ya registrado",
                )
        return await self._repo.update(owner_id, data)

    async def soft_delete(self, owner_id: UUID) -> bool:
        return await self._repo.soft_delete(owner_id)
