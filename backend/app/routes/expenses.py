from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Form, File, UploadFile, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import ExpenseCreate
from app.repositories.expense_repository import ExpenseRepository
from app.services.expense_service import ExpenseService
from app.config.storage import validate_and_store_expense_receipt

router = APIRouter(tags=["expenses"])


@router.get("/expenses/stats/monthly")
async def get_monthly_stats(
    month: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    if not month:
        from datetime import date
        month = date.today().strftime("%Y-%m")
    return await service.get_monthly_stats(month)


@router.get("/expenses/stats/chart")
async def get_chart_stats(
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    return await service.get_chart_data()


@router.get("/expenses/recent")
async def get_recent_expenses(
    limit: int = 10,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    return await service.get_recent(limit)


@router.get("/expenses")
async def list_expenses(
    month: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    return await service.get_by_month(month)


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
async def create_expense(
    date: str = Form(...),
    concept: str = Form(...),
    amount: str = Form(...),
    provider: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    receipt_file: Optional[UploadFile] = File(None),
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    from datetime import date as date_cls
    from decimal import Decimal

    body = ExpenseCreate(
        date=date_cls.fromisoformat(date),
        provider=provider,
        category=category,
        concept=concept,
        amount=Decimal(amount),
    )

    receipt_file_name = None
    receipt_content_type = None
    receipt_storage_path = None

    if receipt_file and receipt_file.filename:
        receipt_meta = await validate_and_store_expense_receipt(receipt_file)
        receipt_file_name = receipt_meta["file_name"]
        receipt_content_type = receipt_meta["content_type"]
        receipt_storage_path = receipt_meta["storage_path"]

    service = ExpenseService(ExpenseRepository(db))
    return await service.create(
        body,
        created_by=user["user_id"],
        receipt_file_name=receipt_file_name,
        receipt_content_type=receipt_content_type,
        receipt_storage_path=receipt_storage_path,
    )
