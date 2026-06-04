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

    async def create(
        self,
        data: ExpenseCreate,
        created_by: str,
        receipt_file_name: Optional[str] = None,
        receipt_content_type: Optional[str] = None,
        receipt_storage_path: Optional[str] = None,
    ) -> dict:
        return await self._repo.create(
            data,
            created_by,
            receipt_file_name=receipt_file_name,
            receipt_content_type=receipt_content_type,
            receipt_storage_path=receipt_storage_path,
        )

    async def get_monthly_stats(self, month: str) -> dict:
        from app.config.settings import settings
        category_rows = await self._repo.get_monthly_stats(month)
        total_spend = sum(Decimal(str(r["total"])) for r in category_rows)
        budget = Decimal(str(settings.budget_monthly))
        percentage_used = float((total_spend / budget * 100).quantize(Decimal("0.01"))) if budget > 0 else 0.0

        maintenance_spend = Decimal("0")
        for r in category_rows:
            if r["category"] == "Mantenimiento":
                maintenance_spend = Decimal(str(r["total"]))
                break
        maintenance_budget = Decimal(str(settings.budget_maintenance))

        categories = []
        for r in category_rows:
            cat_budget = settings.budget_maintenance if r["category"] == "Mantenimiento" else None
            cat_pct = float((Decimal(str(r["total"])) / Decimal(str(cat_budget)) * 100).quantize(Decimal("0.01"))) if cat_budget else None
            categories.append({
                "category": r["category"],
                "amount": float(Decimal(str(r["total"]))),
                "budget": cat_budget,
                "percentage_used": cat_pct,
            })

        return {
            "month": month,
            "total_spend": float(total_spend),
            "budget": float(budget),
            "percentage_used": percentage_used,
            "maintenance_spend": float(maintenance_spend),
            "maintenance_budget": float(maintenance_budget),
            "maintenance_percentage": float((maintenance_spend / maintenance_budget * 100).quantize(Decimal("0.01"))) if maintenance_budget > 0 else 0.0,
            "categories": categories,
        }

    async def get_chart_data(self) -> dict:
        return await self._repo.get_chart_data()

    async def get_recent(self, limit: int = 10) -> list[dict]:
        return await self._repo.get_recent(limit)

    async def get_by_id(self, expense_id: UUID) -> dict | None:
        return await self._repo.get_by_id(expense_id)

    async def update(
        self,
        expense_id: UUID,
        data: ExpenseCreate,
        receipt_file_name: Optional[str] = None,
        receipt_content_type: Optional[str] = None,
        receipt_storage_path: Optional[str] = None,
    ) -> dict | None:
        return await self._repo.update(
            expense_id,
            data,
            receipt_file_name=receipt_file_name,
            receipt_content_type=receipt_content_type,
            receipt_storage_path=receipt_storage_path,
        )

    async def delete(self, expense_id: UUID) -> bool:
        return await self._repo.delete(expense_id)

