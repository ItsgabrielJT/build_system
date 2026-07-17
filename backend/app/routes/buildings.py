from __future__ import annotations

from uuid import UUID

from pathlib import Path
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response

from app.auth.dependencies import get_current_user, require_admin
from app.config.database import get_db
from app.config.storage import (
    BUILDING_ALLOWED_IMAGE_TYPES,
    BUILDING_ALLOWED_PDF_TYPES,
    validate_and_store_building_asset,
)
from app.models.schemas import BuildingCreate, BuildingUpdate
from app.repositories.building_repository import BuildingRepository
from app.services.building_service import BuildingService

router = APIRouter(tags=["buildings"])


@router.get("/buildings")
async def list_buildings(
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Listar todos los edificios."""
    service = BuildingService(BuildingRepository(db))
    return await service.get_all()


@router.post("/buildings", status_code=status.HTTP_201_CREATED)
async def create_building(
    body: BuildingCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Crear un nuevo edificio (solo admin)."""
    service = BuildingService(BuildingRepository(db))
    return await service.create(body)


@router.get("/buildings/config")
async def get_building_config(
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Obtener la única configuración administrativa del edificio."""
    service = BuildingService(BuildingRepository(db))
    return await service.get_config()


@router.put("/buildings/config")
async def update_building_config(
    request: Request,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Actualizar la única configuración administrativa del edificio."""
    form = await request.form()
    name = str(form.get("name") or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nombre del edificio requerido",
        )

    address = str(form.get("address") or "")
    phone = str(form.get("phone") or "")
    email = str(form.get("email") or "")
    documents_link = str(form.get("documents_link") or "")
    photo_file = form.get("photo_file")
    logo_file = form.get("logo_file")
    signature_file = form.get("signature_file")
    seal_file = form.get("seal_file")
    regulation_file = form.get("regulation_file")
    if not getattr(photo_file, "filename", ""):
        photo_file = None
    if not getattr(logo_file, "filename", ""):
        logo_file = None
    if not getattr(signature_file, "filename", ""):
        signature_file = None
    if not getattr(seal_file, "filename", ""):
        seal_file = None
    if not getattr(regulation_file, "filename", ""):
        regulation_file = None

    photo_meta = (
        await validate_and_store_building_asset(photo_file, "building-photo")
        if photo_file is not None
        else None
    )
    logo_meta = (
        await validate_and_store_building_asset(logo_file, "building-logo")
        if logo_file is not None
        else None
    )
    signature_meta = (
        await validate_and_store_building_asset(
            signature_file,
            "building-signature",
            allowed_content_types=frozenset({"image/png"}),
        )
        if signature_file is not None
        else None
    )
    seal_meta = (
        await validate_and_store_building_asset(
            seal_file,
            "building-seal",
            allowed_content_types=BUILDING_ALLOWED_IMAGE_TYPES,
        )
        if seal_file is not None
        else None
    )
    regulation_meta = (
        await validate_and_store_building_asset(
            regulation_file,
            "building-regulation",
            allowed_content_types=BUILDING_ALLOWED_PDF_TYPES,
        )
        if regulation_file is not None
        else None
    )
    payload = BuildingUpdate(
        name=name,
        address=address,
        phone=phone,
        email=email,
        documents_link=documents_link,
    )
    service = BuildingService(BuildingRepository(db))
    return await service.update_config(
        payload,
        photo_meta=photo_meta,
        logo_meta=logo_meta,
        signature_meta=signature_meta,
        seal_meta=seal_meta,
        regulation_meta=regulation_meta,
    )


@router.get("/buildings/{building_id}")
async def get_building(
    building_id: UUID,
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Obtener detalles de un edificio."""
    service = BuildingService(BuildingRepository(db))
    return await service.get_by_id(building_id)


@router.put("/buildings/{building_id}")
async def update_building(
    building_id: UUID,
    body: BuildingUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Actualizar información del edificio (solo admin)."""
    service = BuildingService(BuildingRepository(db))
    return await service.update(building_id, body)


@router.put("/buildings/{building_id}/assets")
async def update_building_assets(
    building_id: UUID,
    photo_file: Optional[UploadFile] = File(None),
    logo_file: Optional[UploadFile] = File(None),
    signature_file: Optional[UploadFile] = File(None),
    seal_file: Optional[UploadFile] = File(None),
    regulation_file: Optional[UploadFile] = File(None),
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Actualizar foto del edificio y logo usado en comprobantes/PDFs."""
    if not photo_file and not logo_file and not signature_file and not seal_file and not regulation_file:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debe adjuntar al menos un archivo de configuración",
        )

    photo_meta = (
        await validate_and_store_building_asset(photo_file, "building-photo")
        if photo_file is not None
        else None
    )
    logo_meta = (
        await validate_and_store_building_asset(logo_file, "building-logo")
        if logo_file is not None
        else None
    )
    signature_meta = (
        await validate_and_store_building_asset(
            signature_file,
            "building-signature",
            allowed_content_types=frozenset({"image/png"}),
        )
        if signature_file is not None
        else None
    )
    seal_meta = (
        await validate_and_store_building_asset(
            seal_file,
            "building-seal",
            allowed_content_types=BUILDING_ALLOWED_IMAGE_TYPES,
        )
        if seal_file is not None
        else None
    )
    regulation_meta = (
        await validate_and_store_building_asset(
            regulation_file,
            "building-regulation",
            allowed_content_types=BUILDING_ALLOWED_PDF_TYPES,
        )
        if regulation_file is not None
        else None
    )
    service = BuildingService(BuildingRepository(db))
    return await service.update_assets(
        building_id,
        photo_meta=photo_meta,
        logo_meta=logo_meta,
        signature_meta=signature_meta,
        seal_meta=seal_meta,
        regulation_meta=regulation_meta,
    )


@router.get("/buildings/{building_id}/assets/{asset_type}")
async def get_building_asset(
    building_id: UUID,
    asset_type: str,
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Descargar la foto o el logo configurado para un edificio."""
    if asset_type not in {"photo", "logo", "signature", "seal", "regulation"}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de edificio no encontrado",
        )

    service = BuildingService(BuildingRepository(db))
    building = await service.get_by_id(building_id)
    storage_path = building.get(f"{asset_type}_storage_path")
    content_type = building.get(f"{asset_type}_content_type") or "application/octet-stream"
    file_name = building.get(f"{asset_type}_file_name") or f"{asset_type}.png"
    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de edificio no configurado",
        )

    path = Path(storage_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de edificio no encontrado en el sistema",
        )
    safe_file_name = file_name.encode("ascii", "ignore").decode("ascii") or f"{asset_type}.png"
    encoded_file_name = quote(file_name)
    return Response(
        content=path.read_bytes(),
        media_type=content_type,
        headers={
            "Content-Disposition": (
                f'inline; filename="{safe_file_name}"; filename*=UTF-8\'\'{encoded_file_name}'
            )
        },
    )


@router.delete("/buildings/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_building(
    building_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Eliminar un edificio (solo admin)."""
    service = BuildingService(BuildingRepository(db))
    await service.delete(building_id)
