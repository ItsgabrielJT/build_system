from __future__ import annotations

from pathlib import Path
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.config.database import get_db
from app.services.pdf_validation_service import validate_pdf_validation_token

router = APIRouter(prefix="/public/pdf-validation", tags=["public-pdf-validation"])


@router.get("/{token}")
async def validate_pdf(token: str) -> dict:
    return validate_pdf_validation_token(token)


@router.get("/building-logo/{building_id}")
async def get_public_building_logo(building_id: UUID, db=Depends(get_db)) -> Response:
    row = await db.fetchrow(
        """
        SELECT logo_storage_path, logo_content_type, logo_file_name
        FROM buildings
        WHERE id = $1
        """,
        building_id,
    )
    if not row or not row["logo_storage_path"]:
        raise HTTPException(status_code=404, detail="Logo no configurado")

    path = Path(row["logo_storage_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Logo no encontrado")

    file_name = row["logo_file_name"] or "logo.png"
    safe_file_name = file_name.encode("ascii", "ignore").decode("ascii") or "logo.png"
    encoded_file_name = quote(file_name)
    return Response(
        content=path.read_bytes(),
        media_type=row["logo_content_type"] or "image/png",
        headers={
            "Content-Disposition": (
                f'inline; filename="{safe_file_name}"; filename*=UTF-8\'\'{encoded_file_name}'
            )
        },
    )
