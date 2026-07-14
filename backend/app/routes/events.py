from __future__ import annotations

from datetime import date, time
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth.dependencies import require_admin, require_authenticated
from app.config.database import get_db
from app.repositories.event_repository import EventRepository
from app.repositories.owner_repository import OwnerRepository
from app.repositories.notification_repository import NotificationRepository
from app.services.email_service import EmailService

router = APIRouter(tags=["events"])


class EventCreate(BaseModel):
    title: str
    description: str
    event_date: date
    start_time: str  # Format: "HH:MM:SS" or "HH:MM"
    end_time: str    # Format: "HH:MM:SS" or "HH:MM"
    owner_ids: List[UUID]


class EventUpdate(EventCreate):
    pass


def _parse_event_time(value: str) -> time:
    from datetime import datetime

    try:
        return (
            datetime.strptime(value, "%H:%M").time()
            if len(value) <= 5
            else datetime.strptime(value, "%H:%M:%S").time()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de hora inválido. Use HH:MM o HH:MM:SS: {str(exc)}",
        )


@router.post(
    "/events",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_event(
    data: EventCreate,
    db=Depends(get_db),
):
    """Crea un evento, lo asigna a los propietarios seleccionados, envía correos y genera notificaciones."""
    event_repo = EventRepository(db)
    owner_repo = OwnerRepository(db)
    notification_repo = NotificationRepository(db)

    start_t = _parse_event_time(data.start_time)
    end_t = _parse_event_time(data.end_time)

    # Create event
    event = await event_repo.create(
        title=data.title,
        description=data.description,
        event_date=data.event_date,
        start_time=start_t,
        end_time=end_t,
    )

    owner_ids = list(dict.fromkeys(data.owner_ids))

    # Assign to owners
    await event_repo.assign_to_owners(event["id"], owner_ids)

    # Fetch and notify assigned owners
    for owner_id in owner_ids:
        owner = await owner_repo.get_by_id(owner_id)
        if owner:
            # 1. Send Email Notification
            if owner.get("email"):
                await EmailService.send_event_assigned_email(
                    owner_email=owner["email"],
                    owner_name=owner["full_name"],
                    event_title=data.title,
                    event_date=str(data.event_date),
                    start_time=data.start_time,
                    end_time=data.end_time,
                    description=data.description,
                )

            # 2. In-App Notification (only if owner is linked to a user account)
            if owner.get("firebase_uid"):
                await notification_repo.create(
                    notification_type="EVENTO_ASIGNADO",
                    title=f"Nuevo evento: {data.title}",
                    recipient=owner["firebase_uid"],
                    body=f"Tienes un evento asignado para el {data.event_date} de {data.start_time} a {data.end_time}.",
                    metadata={"event_id": str(event["id"])},
                )

    return event


@router.put(
    "/events/{event_id}",
    dependencies=[Depends(require_admin)],
)
async def update_event(
    event_id: UUID,
    data: EventUpdate,
    db=Depends(get_db),
):
    """Actualiza un evento y sus propietarios asignados (ADMIN)."""
    event_repo = EventRepository(db)

    start_t = _parse_event_time(data.start_time)
    end_t = _parse_event_time(data.end_time)

    event = await event_repo.update(
        event_id=event_id,
        title=data.title,
        description=data.description,
        event_date=data.event_date,
        start_time=start_t,
        end_time=end_t,
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evento no encontrado",
        )

    await event_repo.assign_to_owners(event_id, data.owner_ids)
    return event


@router.delete(
    "/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_event(
    event_id: UUID,
    db=Depends(get_db),
):
    """Elimina un evento existente (ADMIN)."""
    event_repo = EventRepository(db)
    deleted = await event_repo.delete(event_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evento no encontrado",
        )


@router.get(
    "/events",
    dependencies=[Depends(require_admin)],
)
async def list_events(
    db=Depends(get_db),
):
    """Lista todos los eventos con sus propietarios asignados (ADMIN)."""
    event_repo = EventRepository(db)
    # Return list of events with details
    events = await event_repo.get_all_with_owners()
    
    # Custom formatting to convert time objects to strings
    for event in events:
        if isinstance(event.get("start_time"), time):
            event["start_time"] = event["start_time"].strftime("%H:%M")
        if isinstance(event.get("end_time"), time):
            event["end_time"] = event["end_time"].strftime("%H:%M")
            
    return events


@router.get(
    "/owner/events",
    dependencies=[Depends(require_authenticated)],
)
async def list_my_events(
    user: dict = Depends(require_authenticated),
    db=Depends(get_db),
):
    """Lista todos los eventos asignados al propietario actual."""
    owner_repo = OwnerRepository(db)
    event_repo = EventRepository(db)

    owner = await owner_repo.get_by_user_id(user["user_id"])
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado para este usuario",
        )

    events = await event_repo.get_by_owner_id(owner["id"])
    
    # Custom formatting to convert time objects to strings
    for event in events:
        if isinstance(event.get("start_time"), time):
            event["start_time"] = event["start_time"].strftime("%H:%M")
        if isinstance(event.get("end_time"), time):
            event["end_time"] = event["end_time"].strftime("%H:%M")
            
    return events
