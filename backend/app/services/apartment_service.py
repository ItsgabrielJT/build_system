from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import ApartmentCreate, ApartmentUpdate, OwnerAssign
from app.repositories.apartment_repository import ApartmentRepository

_VALID_APARTMENT_STATUSES = {"OCUPADO", "VACANTE", "MANTENIMIENTO", "ACTIVO", "ACTIVA"}


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
        if data.status:
            normalized = data.status.upper()
            if normalized not in _VALID_APARTMENT_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Estado inválido. Use Vacante, Ocupado o En mantenimiento",
                )
            if normalized in {"ACTIVO", "ACTIVA"}:
                normalized = "OCUPADO"
            data.status = normalized
        return await self._repo.update(apartment_id, data)

    async def assign_owner(
        self, apartment_id: UUID, owner_id: UUID, data: OwnerAssign
    ) -> dict:
        return await self._repo.assign_owner(
            apartment_id, owner_id, data.is_primary if data.is_primary is not None else True
        )

    async def remove_owner(self, apartment_id: UUID, owner_id: UUID) -> bool:
        return await self._repo.remove_owner(apartment_id, owner_id)

    async def get_statistics(self, building_id: Optional[UUID] = None) -> dict:
        """Get occupancy statistics."""
        return await self._repo.get_statistics(building_id)

    async def get_apartments_paginated(
        self,
        page: int = 1,
        per_page: int = 4,
        status: Optional[str] = None,
        building_id: Optional[UUID] = None,
    ) -> tuple[list[dict], int]:
        """Get paginated apartments with filters."""
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 4

        if status:
            status = status.upper()
            if status == "ACTIVO":
                status = "OCUPADO"
            elif status == "ACTIVA":
                status = "VACANTE"

        return await self._repo.get_by_filter_paginated(
            page=page,
            per_page=per_page,
            status=status,
            building_id=building_id,
        )

    async def get_by_owner_id(self, owner_id: UUID) -> list[dict]:
        return await self._repo.get_by_owner_id(owner_id)
