from __future__ import annotations

from decimal import Decimal
from typing import Optional

from app.models.schemas import ExpenseCreate
from app.repositories.expense_repository import ExpenseRepository


class ExpenseService:
    def __init__(self, repo: ExpenseRepository) -> None:
        self._repo = repo

    async def get_by_month(self, month: Optional[str] = None) -> dict:
        rows = await self._repo.get_by_month(month)
        total = sum(Decimal(str(r.get("amount", 0))) for r in rows)
        return {"data": rows, "total": total}

    async def create(self, data: ExpenseCreate, created_by: str) -> dict:
        return await self._repo.create(data, created_by)
