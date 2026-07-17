from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth.dependencies import require_admin, require_authenticated
from app.config.database import get_db
from app.repositories.announcement_repository import AnnouncementRepository
from app.repositories.notification_repository import NotificationRepository

router = APIRouter(tags=["announcements"])


class AnnouncementCreate(BaseModel):
    title: str
    description: str


class AnnouncementUpdate(BaseModel):
    title: str
    description: str


@router.post(
    "/announcements",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_announcement(
    data: AnnouncementCreate,
    db=Depends(get_db),
):
    """Crea un aviso y notifica a todos los propietarios (ADMIN)."""
    repo = AnnouncementRepository(db)
    notification_repo = NotificationRepository(db)

    announcement = await repo.create(
        title=data.title,
        description=data.description,
    )

    # Broadcast notification to all owners
    await notification_repo.create(
        notification_type="AVISO_PUBLICADO",
        title=f"Nuevo aviso: {data.title}",
        recipient="PROPIETARIO",
        body=data.description,
        metadata={"announcement_id": str(announcement["id"])},
    )

    return announcement


@router.get(
    "/announcements",
    dependencies=[Depends(require_admin)],
)
async def list_announcements(
    db=Depends(get_db),
):
    """Lista todos los avisos (ADMIN)."""
    repo = AnnouncementRepository(db)
    return await repo.get_all()


@router.put(
    "/announcements/{announcement_id}",
    dependencies=[Depends(require_admin)],
)
async def update_announcement(
    announcement_id: UUID,
    data: AnnouncementUpdate,
    db=Depends(get_db),
):
    """Actualiza un aviso existente (ADMIN)."""
    repo = AnnouncementRepository(db)
    announcement = await repo.update(
        announcement_id=announcement_id,
        title=data.title,
        description=data.description,
    )
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aviso no encontrado",
        )
    return announcement


@router.delete(
    "/announcements/{announcement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_announcement(
    announcement_id: UUID,
    db=Depends(get_db),
):
    """Elimina un aviso existente (ADMIN)."""
    repo = AnnouncementRepository(db)
    deleted = await repo.delete(announcement_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aviso no encontrado",
        )


@router.get(
    "/owner/announcements/recent",
    dependencies=[Depends(require_authenticated)],
)
async def list_recent_announcements(
    limit: int = 5,
    db=Depends(get_db),
):
    """Lista los avisos más recientes para el propietario."""
    repo = AnnouncementRepository(db)
    return await repo.get_recent(limit=limit)


@router.get(
    "/owner/announcements",
    dependencies=[Depends(require_authenticated)],
)
async def list_owner_announcements(
    db=Depends(get_db),
):
    """Lista todos los avisos publicados para el propietario."""
    repo = AnnouncementRepository(db)
    return await repo.get_all()


@router.get(
    "/owner/announcements/{announcement_id}",
    dependencies=[Depends(require_authenticated)],
)
async def get_owner_announcement(
    announcement_id: UUID,
    db=Depends(get_db),
):
    """Obtiene el detalle completo de un aviso para el propietario."""
    repo = AnnouncementRepository(db)
    announcement = await repo.get_by_id(announcement_id)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aviso no encontrado",
        )
    return announcement
