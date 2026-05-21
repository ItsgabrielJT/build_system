from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import ApartmentCreate, ApartmentUpdate, OwnerAssign
from app.repositories.apartment_repository import ApartmentRepository


class ApartmentService:
    def __init__(self, repo: ApartmentRepository) -> None:
        self._repo = repo

    async def get_all(self) -> list[dict]:
        return await self._repo.get_all()

    async def get_by_id(self, apartment_id: UUID) -> dict | None:
        return await self._repo.get_by_id(apartment_id)

    async def create(self, data: ApartmentCreate) -> dict:
        if await self._repo.code_exists(data.code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Código de departamento ya existe",
            )
        return await self._repo.create(data)

    async def update(self, apartment_id: UUID, data: ApartmentUpdate) -> dict | None:
        if data.code:
            if await self._repo.code_exists(data.code, exclude_id=apartment_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Código de departamento ya existe",
                )
        return await self._repo.update(apartment_id, data)

    async def assign_owner(
        self, apartment_id: UUID, owner_id: UUID, data: OwnerAssign
    ) -> dict:
        return await self._repo.assign_owner(
            apartment_id, owner_id, data.is_primary if data.is_primary is not None else True
        )

    async def remove_owner(self, apartment_id: UUID, owner_id: UUID) -> bool:
        return await self._repo.remove_owner(apartment_id, owner_id)
