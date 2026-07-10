from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import OwnerCreate, OwnerUpdate, OwnerProfileUpdate
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

    async def get_directory_paginated(
        self,
        page: int = 1,
        per_page: int = 10,
        search: Optional[str] = None,
        start_date=None,
        end_date=None,
    ) -> tuple[list[dict], int]:
        """Get paginated owners directory with balance."""
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 10

        return await self._repo.get_directory_paginated(
            page=page,
            per_page=per_page,
            search=search,
            start_date=start_date,
            end_date=end_date,
        )

    async def get_owner_detail(self, owner_id: UUID) -> dict | None:
        """Get owner details with recent transactions."""
        return await self._repo.get_detail_with_transactions(owner_id)

    async def get_profile_by_user_id(self, user_id: UUID) -> dict | None:
        owner = await self._repo.get_by_user_id(user_id)
        if not owner:
            return None
        return await self._repo.get_by_id_with_apartments(owner["id"])

    async def update_profile(self, owner_id: UUID, data: OwnerProfileUpdate) -> dict | None:
        return await self._repo.update_profile(owner_id, data)

