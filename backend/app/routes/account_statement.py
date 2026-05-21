from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.auth.dependencies import get_current_user
from app.config.database import get_db
from app.repositories.delinquency_repository import DelinquencyRepository
from app.repositories.owner_repository import OwnerRepository
from app.services.account_statement_service import AccountStatementService

router = APIRouter(tags=["account-statement"])


@router.get("/account-statement")
async def get_account_statement(
    start_period: Optional[str] = None,
    end_period: Optional[str] = None,
    owner_id: Optional[UUID] = None,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    service = AccountStatementService(DelinquencyRepository(db), OwnerRepository(db))
    resolved_id = await service.resolve_owner_id(user, owner_id)
    if not resolved_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado para este usuario",
        )
    return await service.get_statement(resolved_id, start_period, end_period)


@router.get("/account-statement/export")
async def export_account_statement(
    format: str = "csv",
    start_period: Optional[str] = None,
    end_period: Optional[str] = None,
    owner_id: Optional[UUID] = None,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    service = AccountStatementService(DelinquencyRepository(db), OwnerRepository(db))
    resolved_id = await service.resolve_owner_id(user, owner_id)
    if not resolved_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado para este usuario",
        )

    rows = await service.get_statement(resolved_id, start_period, end_period)

    import csv as csv_module
    import io

    output = io.StringIO()
    writer = csv_module.writer(output)
    writer.writerow(
        ["Período", "Departamento", "Esperado", "Multas", "Pagado", "Saldo", "Estado"]
    )
    for row in rows:
        writer.writerow(
            [
                row["period"],
                row["apartment_code"],
                row["esperado"],
                row["multas"],
                row["pagado"],
                row["saldo"],
                row["status"],
            ]
        )

    content = output.getvalue().encode("utf-8-sig")
    media_type = "text/csv"
    filename = f"estado-cuenta.csv"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
