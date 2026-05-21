from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import FineCreate, FineUpdate
from app.repositories.fine_repository import FineRepository

_VALID_TRANSITIONS = {"ACTIVA": {"ANULADA"}}


class FineService:
    def __init__(self, repo: FineRepository) -> None:
        self._repo = repo

    async def get_all(self, period=None, status_filter=None) -> list[dict]:
        return await self._repo.get_all(period=period, status=status_filter)

    async def create(self, data: FineCreate, created_by: str) -> dict:
        return await self._repo.create(data, created_by)

    async def update_status(self, fine_id: UUID, data: FineUpdate) -> dict:
        fine = await self._repo.get_by_id(fine_id)
        if not fine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Multa no encontrada",
            )
        allowed = _VALID_TRANSITIONS.get(fine["status"], set())
        if data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transición inválida: {fine['status']} → {data.status}",
            )
        updated = await self._repo.update_status(fine_id, data.status)
        return updated
