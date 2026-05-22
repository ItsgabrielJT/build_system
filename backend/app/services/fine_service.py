from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import FineCreate, FineUpdate
from app.repositories.fine_repository import FineRepository

_VALID_TRANSITIONS = {"ACTIVA": {"ANULADA"}}


class FineService:
    def __init__(self, repo: FineRepository) -> None:
        self._repo = repo

    async def get_all(
        self,
        period=None,
        status_filter=None,
        owner_id=None,
        reason=None,
        search=None,
        page: int | None = None,
        page_size: int | None = None,
    ):
        if page is None or page_size is None:
            return await self._repo.get_all(
                period=period,
                status=status_filter,
                owner_id=owner_id,
                reason=reason,
                search=search,
            )

        safe_page = max(page, 1)
        safe_page_size = min(max(page_size, 1), 100)
        offset = (safe_page - 1) * safe_page_size
        items = await self._repo.get_all(
            period=period,
            status=status_filter,
            owner_id=owner_id,
            reason=reason,
            search=search,
            limit=safe_page_size,
            offset=offset,
        )
        total = await self._repo.count_all(
            period=period,
            status=status_filter,
            owner_id=owner_id,
            reason=reason,
            search=search,
        )
        return {
            "items": items,
            "total": total,
            "page": safe_page,
            "page_size": safe_page_size,
            "total_pages": (total + safe_page_size - 1) // safe_page_size,
        }

    async def get_stats(
        self,
        period=None,
        status_filter=None,
        owner_id=None,
        reason=None,
        search=None,
    ) -> dict:
        return await self._repo.get_stats(
            period=period,
            status=status_filter,
            owner_id=owner_id,
            reason=reason,
            search=search,
        )

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
