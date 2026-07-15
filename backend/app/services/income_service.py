from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import IncomeCreate, IncomeUpdate
from app.repositories.income_repository import IncomeRepository

_VALID_TRANSITIONS = {"REGISTRADO": {"ANULADO"}}


class IncomeService:
    def __init__(self, repo: IncomeRepository) -> None:
        self._repo = repo

    async def get_all(self, period=None, status_filter=None, start_date=None, end_date=None) -> list[dict]:
        return await self._repo.get_all(
            period=period,
            status=status_filter,
            start_date=start_date,
            end_date=end_date,
        )

    async def create(self, data: IncomeCreate, created_by: str) -> dict:
        return await self._repo.create(data, created_by)

    async def update_status(self, income_id: UUID, data: IncomeUpdate) -> dict:
        income = await self._repo.get_by_id(income_id)
        if not income:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingreso no encontrado")
        allowed = _VALID_TRANSITIONS.get(income["status"], set())
        if data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transición inválida: {income['status']} → {data.status}",
            )
        updated = await self._repo.update_status(income_id, data.status)
        return updated

    async def delete(self, income_id: UUID) -> None:
        income = await self._repo.get_by_id(income_id)
        if not income:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingreso no encontrado")
        if income["status"] != "ANULADO":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo se pueden eliminar ingresos anulados",
            )
        deleted = await self._repo.delete(income_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ingreso no encontrado",
            )
