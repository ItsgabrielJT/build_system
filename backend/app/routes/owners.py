from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response, UploadFile, File
from urllib.parse import quote
from pathlib import Path
from app.config.storage import validate_and_store_owner_asset

from app.auth.dependencies import get_current_user, require_admin, require_owner
from app.config.database import get_db
from app.models.schemas import (
    OwnerCreate,
    OwnerDetailResponse,
    OwnerDirectoryResponse,
    OwnerDirectoryItemResponse,
    OwnerUpdate,
    OwnerUnitResponse,
    TransactionResponse,
    OwnerProfileResponse,
    OwnerProfileUpdate,
)
from app.repositories.owner_repository import OwnerRepository
from app.services.owner_service import OwnerService

router = APIRouter(tags=["owners"])


@router.get("/owners/me")
async def get_current_owner_profile(
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Obtiene el detalle y balance consolidado del propietario actual autenticado."""
    repo = OwnerRepository(db)
    owner = await repo.get_by_user_id(user["user_id"])
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado para este usuario",
        )
    result = await repo.get_detail_with_transactions(owner["id"], limit_transactions=10)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )
    return result


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
                allocated_quota_percent=item.get("allocated_quota_percent") or 0,
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
        allocated_quota_percent=result.get("allocated_quota_percent") or 0,
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


@router.get("/owner/profile", response_model=OwnerProfileResponse)
async def get_owner_profile(
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    profile = await service.get_profile_by_user_id(user["user_id"])
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de propietario no encontrado para este usuario",
        )
    profile["units"] = profile.get("apartments", [])
    return profile


@router.put("/owner/profile", response_model=OwnerProfileResponse)
async def update_owner_profile(
    body: OwnerProfileUpdate,
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    service = OwnerService(OwnerRepository(db))
    owner = await db.fetchrow(
        "SELECT id FROM owners WHERE firebase_uid = $1 AND status = 'ACTIVO'",
        str(user["user_id"]),
    )
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de propietario no encontrado para este usuario",
        )
    profile = await service.update_profile(owner["id"], body)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al actualizar el perfil",
        )
    profile["units"] = profile.get("apartments", [])
    return profile


@router.put("/owner/profile/photo", response_model=OwnerProfileResponse)
async def update_owner_profile_photo(
    photo_file: UploadFile = File(...),
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    """Sube y actualiza la foto de perfil del propietario autenticado."""
    if not getattr(photo_file, "filename", ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archivo de foto no válido",
        )
    
    # 1. Resolve owner ID
    owner = await db.fetchrow(
        "SELECT id FROM owners WHERE firebase_uid = $1 AND status = 'ACTIVO'",
        str(user["user_id"]),
    )
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de propietario no encontrado para este usuario",
        )
        
    photo_meta = await validate_and_store_owner_asset(photo_file, f"owner-photo-{owner['id']}")
    
    # 2. Update database
    await db.execute(
        """
        UPDATE owners SET
            photo_file_name = $2,
            photo_content_type = $3,
            photo_storage_path = $4,
            last_update_date = NOW(),
            updated_at = NOW()
        WHERE id = $1
        """,
        owner["id"],
        photo_meta["file_name"],
        photo_meta["content_type"],
        photo_meta["storage_path"],
    )
    
    service = OwnerService(OwnerRepository(db))
    profile = await service.get_by_id_with_apartments(owner["id"])
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de propietario no encontrado",
        )
    profile["units"] = profile.get("apartments", [])
    return profile


@router.get("/owners/{owner_id}/assets/photo")
async def get_owner_photo(
    owner_id: UUID,
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Descarga o visualiza la foto de perfil configurada para un propietario."""
    owner = await db.fetchrow(
        "SELECT photo_file_name, photo_content_type, photo_storage_path FROM owners WHERE id = $1 AND status = 'ACTIVO'",
        owner_id,
    )
    if not owner or not owner["photo_storage_path"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foto de perfil no configurada para este propietario",
        )
        
    path = Path(owner["photo_storage_path"])
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de foto no encontrado en el sistema",
        )
        
    file_name = owner["photo_file_name"] or "photo.png"
    safe_file_name = file_name.encode("ascii", "ignore").decode("ascii") or "photo.png"
    encoded_file_name = quote(file_name)
    
    return Response(
        content=path.read_bytes(),
        media_type=owner["photo_content_type"] or "image/png",
        headers={
            "Content-Disposition": (
                f'inline; filename="{safe_file_name}"; filename*=UTF-8\'\'{encoded_file_name}'
            )
        },
    )


@router.get("/owner/ficha")
async def download_owner_ficha(
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    from app.services.report_service import ReportService
    from app.services.delinquency_service import DelinquencyService
    from app.repositories.payment_repository import PaymentRepository
    from app.repositories.expense_repository import ExpenseRepository
    from app.repositories.delinquency_repository import DelinquencyRepository
    
    # 1. Resolve owner ID
    owner = await db.fetchrow(
        "SELECT id, full_name FROM owners WHERE firebase_uid = $1 AND status = 'ACTIVO'",
        str(user["user_id"]),
    )
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de propietario no encontrado para este usuario",
        )
        
    # 2. Build ReportService and generate PDF
    delinquency_repo = DelinquencyRepository(db)
    delinquency_service = DelinquencyService(delinquency_repo)
    payment_repo = PaymentRepository(db)
    expense_repo = ExpenseRepository(db)
    
    report_service = ReportService(
        delinquency_service=delinquency_service,
        payment_repo=payment_repo,
        expense_repo=expense_repo,
    )
    
    try:
        pdf_bytes = await report_service.owner_ficha_pdf(owner["id"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar la ficha PDF: {str(e)}",
        )
        
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="ficha-{owner["full_name"].replace(" ", "_")}.pdf"'
        },
    )
