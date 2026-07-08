from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user, require_admin
from app.config.database import get_db
from app.models.schemas import (
    OwnerCreate,
    OwnerDetailResponse,
    OwnerDirectoryResponse,
    OwnerDirectoryItemResponse,
    OwnerUpdate,
    OwnerUnitResponse,
    TransactionResponse,
)
from app.repositories.owner_repository import OwnerRepository
from app.services.owner_service import OwnerService

router = APIRouter(tags=["owners"])


# ─── DASHBOARD ENDPOINTS (v1 API) ────────────────────────────────────────────

@router.get("/owners/directory", response_model=OwnerDirectoryResponse)
async def get_owners_directory(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Get paginated owners directory with consolidated balance."""
    service = OwnerService(OwnerRepository(db))
    items, total = await service.get_directory_paginated(
        page=page,
        per_page=per_page,
        search=search,
        start_date=start_date,
        end_date=end_date,
    )

    total_pages = (total + per_page - 1) // per_page

    owner_items = []
    for item in items:
        # Get units for this owner
        units_data = await db.fetch(
            """
            SELECT a.id, a.code, a.tower, a.floor
            FROM apartments a
            JOIN owner_apartments oa ON a.id = oa.apartment_id
            WHERE oa.owner_id = $1
            ORDER BY a.code
            """,
            item["id"],
        )

        units = [
            OwnerUnitResponse(
                id=u["id"],
                code=u["code"],
                tower=u["tower"],
                floor=u["floor"],
            )
            for u in units_data
        ]

        owner_items.append(
            OwnerDirectoryItemResponse(
                id=item["id"],
                full_name=item["full_name"],
                document_id=item["document_id"],
                email=item.get("email"),
                phone=item.get("phone"),
                units=units,
                ingress_date=item.get("ingress_date").date() if item.get("ingress_date") else None,
                balance=item["balance"],
                currency=item.get("currency", "USD"),
            )
        )

    return OwnerDirectoryResponse(
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        items=owner_items,
    )


@router.get("/owners/{owner_id}/detail", response_model=OwnerDetailResponse)
async def get_owner_detail(
    owner_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Get owner details with recent transactions."""
    service = OwnerService(OwnerRepository(db))
    result = await service.get_owner_detail(owner_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )

    # Extract and format owner data
    units_data = result.get("apartments", [])
    units = [
        OwnerUnitResponse(
            id=u["id"],
            code=u["code"],
            tower=u.get("tower"),
            floor=u.get("floor"),
        )
        for u in units_data
    ]

    transactions_data = result.get("recent_transactions", [])
    transactions = [
        TransactionResponse(
            type=t["type"],
            period=t["period"],
            amount=t["amount"],
            date=t["date"],
            reference=t["reference"],
        )
        for t in transactions_data
    ]

    return OwnerDetailResponse(
        id=result["id"],
        full_name=result["full_name"],
        document_id=result["document_id"],
        email=result.get("email"),
        phone=result.get("phone"),
        status=result.get("status", "ACTIVO"),
        units=units,
        ingress_date=result.get("created_at").date() if result.get("created_at") else None,
        balance_consolidated=result["balance_consolidated"],
        recent_transactions=transactions,
        currency="USD",
    )


# ─── LEGACY ENDPOINTS ────────────────────────────────────────────────────────────

@router.get("/owners")
async def list_owners(
    status: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    return await service.get_all(status)


@router.post("/owners", status_code=status.HTTP_201_CREATED)
async def create_owner(
    body: OwnerCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    return await service.create(body)


@router.get("/owners/{owner_id}")
async def get_owner(
    owner_id: UUID,
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    result = await service.get_by_id_with_apartments(owner_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )
    return result


@router.put("/owners/{owner_id}")
async def update_owner(
    owner_id: UUID,
    body: OwnerUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    result = await service.update(owner_id, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )
    return result


@router.delete("/owners/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_owner(
    owner_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    found = await service.soft_delete(owner_id)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )
