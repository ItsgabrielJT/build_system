from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import require_admin, require_authenticated
from app.config.database import get_db
from app.models.schemas import (
    ApartmentCreate,
    ApartmentDirectoryResponse,
    ApartmentDirectoryItemResponse,
    ApartmentStatisticsResponse,
    ApartmentUpdate,
    OwnerAssign,
)
from app.repositories.apartment_repository import ApartmentRepository
from app.repositories.owner_repository import OwnerRepository
from app.services.apartment_service import ApartmentService

router = APIRouter(tags=["apartments"])


# ─── DASHBOARD ENDPOINTS (v1 API) ────────────────────────────────────────────

@router.get("/apartments/statistics", response_model=ApartmentStatisticsResponse)
async def get_apartment_statistics(
    building_id: Optional[UUID] = Query(None),
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Get apartment occupancy statistics."""
    service = ApartmentService(ApartmentRepository(db))
    stats = await service.get_statistics(building_id)
    return ApartmentStatisticsResponse(**stats)


@router.get("/apartments/directory", response_model=ApartmentDirectoryResponse)
async def get_apartments_directory(
    page: int = Query(1, ge=1),
    per_page: int = Query(4, ge=1, le=100),
    status: Optional[str] = Query(None),
    building_id: Optional[UUID] = Query(None),
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Get paginated apartments for directory dashboard."""
    service = ApartmentService(ApartmentRepository(db))
    items, total = await service.get_apartments_paginated(
        page=page,
        per_page=per_page,
        status=status,
        building_id=building_id,
    )

    total_pages = (total + per_page - 1) // per_page

    apartment_items = [
        ApartmentDirectoryItemResponse(
            id=item["id"],
            code=item["code"],
            floor=item["floor"],
            tower=item["tower"],
            area_sqm=item.get("area_sqm"),
            status=_map_apartment_status(item["status"], item.get("owner_id")),
            owner_name=item.get("owner_name"),
            allocated_quota_percent=float(item.get("allocated_quota_percent", 2.145)),
            image_url=item.get("image_url"),
        )
        for item in items
    ]

    return ApartmentDirectoryResponse(
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        items=apartment_items,
    )


# ─── LEGACY ENDPOINTS ────────────────────────────────────────────────────────────

@router.get("/apartments")
async def list_apartments(
    user: dict = Depends(require_authenticated),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    if user.get("role") == "ADMIN":
        return await service.get_all()
    owner = await OwnerRepository(db).get_by_firebase_uid(str(user["user_id"]))
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado para este usuario",
        )
    return await service.get_by_owner_id(owner["id"])


@router.post("/apartments", status_code=status.HTTP_201_CREATED)
async def create_apartment(
    body: ApartmentCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    return await service.create(body)


@router.get("/apartments/{apartment_id}")
async def get_apartment(
    apartment_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    result = await service.get_by_id(apartment_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Departamento no encontrado",
        )
    return result


@router.put("/apartments/{apartment_id}")
async def update_apartment(
    apartment_id: UUID,
    body: ApartmentUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    result = await service.update(apartment_id, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Departamento no encontrado",
        )
    return result


@router.post(
    "/apartments/{apartment_id}/owners/{owner_id}",
    status_code=status.HTTP_201_CREATED,
)
async def assign_owner(
    apartment_id: UUID,
    owner_id: UUID,
    body: OwnerAssign = OwnerAssign(),
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    return await service.assign_owner(apartment_id, owner_id, body)


@router.delete(
    "/apartments/{apartment_id}/owners/{owner_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_owner(
    apartment_id: UUID,
    owner_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentService(ApartmentRepository(db))
    found = await service.remove_owner(apartment_id, owner_id)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada",
        )


# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

def _map_apartment_status(db_status: str, owner_id: Optional[UUID]) -> str:
    """Map database status to API status."""
    if db_status == "MANTENIMIENTO":
        return "MANTENIMIENTO"
    elif db_status in ("ACTIVA", "ACTIVO"):
        return "OCUPADO" if owner_id else "VACANTE"
    return db_status


@router.get("/apartments/{apartment_id}/pending-debts")
async def get_apartment_pending_debts(
    apartment_id: UUID,
    _user: dict = Depends(require_authenticated),
    db=Depends(get_db),
):
    """Retrieve unpaid fees and active fines for a specific apartment."""
    fees = await db.fetch(
        """
        SELECT af.id, af.period, af.amount
        FROM apartment_fees af
        WHERE af.apartment_id = $1
          AND NOT EXISTS (
              SELECT 1 FROM payments p
              WHERE p.apartment_id = af.apartment_id
                AND p.period = af.period
                AND p.status IN ('REGISTRADO', 'PENDIENTE_APROBACION')
          )
        ORDER BY af.period ASC
        """,
        apartment_id,
    )
    
    fines = await db.fetch(
        """
        SELECT f.id, f.period, f.amount, f.reason
        FROM fines f
        WHERE f.apartment_id = $1
          AND f.status = 'ACTIVA'
        ORDER BY f.issued_at ASC
        """,
        apartment_id,
    )
    
    return {
        "cuotas": [
            {
                "id": str(r["id"]),
                "period": r["period"],
                "amount": float(r["amount"]),
                "description": f"Cuota - Período {r['period']}",
            }
            for r in fees
        ],
        "multas": [
            {
                "id": str(r["id"]),
                "period": r["period"],
                "amount": float(r["amount"]),
                "description": f"Multa - {r['reason'] or 'Sin concepto'} ({r['period']})",
            }
            for r in fines
        ],
    }

