"""Abstracción de almacenamiento local para comprobantes de pago (SPEC-008)."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config.settings import settings

_ALLOWED_CONTENT_TYPES: frozenset[str] = frozenset(
    t.strip() for t in settings.allowed_proof_types.split(",")
)
_ALLOWED_IMAGE_TYPES: frozenset[str] = frozenset({"image/jpeg", "image/png"})
_ALLOWED_PDF_TYPES: frozenset[str] = frozenset({"application/pdf"})
_MAX_BYTES: int = settings.max_proof_size_mb * 1024 * 1024


def _proof_upload_dir() -> Path:
    path = Path(settings.upload_dir) / "payment_proofs"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def validate_and_store_proof(file: UploadFile) -> dict:
    """Valida y persiste un comprobante. Retorna dict con metadata del archivo."""
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Tipo de archivo no soportado: {file.content_type}. "
                f"Tipos permitidos: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}"
            ),
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El archivo adjunto está vacío",
        )

    if len(contents) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"El archivo excede el tamaño máximo permitido "
                f"de {settings.max_proof_size_mb} MB"
            ),
        )

    original_name = file.filename or "comprobante"
    ext = Path(original_name).suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = _proof_upload_dir() / stored_name
    storage_path.write_bytes(contents)

    return {
        "file_name": original_name,
        "content_type": file.content_type,
        "storage_path": str(storage_path),
    }


def read_proof_bytes(storage_path: str) -> bytes:
    """Lee los bytes del comprobante desde almacenamiento local."""
    path = Path(storage_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de comprobante no encontrado en el sistema",
        )
    return path.read_bytes()


def _receipt_upload_dir() -> Path:
    path = Path(settings.upload_dir) / "expense_receipts"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _building_asset_upload_dir() -> Path:
    path = Path(settings.upload_dir) / "building_assets"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def validate_and_store_building_asset(
    file: UploadFile,
    label: str,
    *,
    allowed_content_types: frozenset[str] = _ALLOWED_IMAGE_TYPES,
) -> dict:
    """Valida y persiste una imagen del edificio."""
    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Tipo de archivo no soportado para {label}: {file.content_type}. "
                f"Tipos permitidos: {', '.join(sorted(allowed_content_types))}"
            ),
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"El archivo de {label} está vacío",
        )

    if len(contents) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"El archivo de {label} excede el tamaño máximo permitido "
                f"de {settings.max_proof_size_mb} MB"
            ),
        )

    original_name = file.filename or label
    ext = Path(original_name).suffix.lower()
    stored_name = f"{label}-{uuid.uuid4().hex}{ext}"
    storage_path = _building_asset_upload_dir() / stored_name
    storage_path.write_bytes(contents)

    return {
        "file_name": original_name,
        "content_type": file.content_type,
        "storage_path": str(storage_path),
    }


BUILDING_ALLOWED_IMAGE_TYPES = _ALLOWED_IMAGE_TYPES
BUILDING_ALLOWED_PDF_TYPES = _ALLOWED_PDF_TYPES


async def validate_and_store_expense_receipt(file: UploadFile) -> dict:
    """Valida y persiste un comprobante de gasto. Retorna dict con metadata del archivo."""
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Tipo de archivo no soportado: {file.content_type}. "
                f"Tipos permitidos: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}"
            ),
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El archivo adjunto está vacío",
        )

    if len(contents) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"El archivo excede el tamaño máximo permitido "
                f"de {settings.max_proof_size_mb} MB"
            ),
        )

    original_name = file.filename or "comprobante"
    ext = Path(original_name).suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = _receipt_upload_dir() / stored_name
    storage_path.write_bytes(contents)

    return {
        "file_name": original_name,
        "content_type": file.content_type,
        "storage_path": str(storage_path),
    }
