"""Tests for owner profile and ficha download — CRITERIOS-6.1, 6.2, 6.3."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_get_owner_profile_unauthorized(async_client: AsyncClient):
    """Should return 403 when accessing owner profile without token."""
    response = await async_client.get("/api/v1/owner/profile")
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_get_owner_profile_success(
    async_client: AsyncClient,
    propietario_headers: dict,
    db_with_users: AsyncMock
):
    """Should return 200 and owner profile data."""
    owner_mock = {
        "id": UUID("550e8400-e29b-41d4-a716-446655440020"),
        "full_name": "Juan Francisco Cuaical",
        "document_id": "1712345678",
        "phone": "+593 99 295 3596",
        "email": "juan.cuaical@example.com",
        "status": "ACTIVO",
        "birth_date": date(1985, 4, 15),
        "occupant_name": "María Fernanda Cuaical",
        "occupant_relation": "Cónyuge",
        "occupant_phone": "+593 98 765 4321",
        "occupant_inhabitants": 3,
        "emergency_name": "Carlos Cuaical",
        "emergency_relation": "Hermano",
        "emergency_phone": "+593 97 123 4567",
        "notifications_enabled": True,
        "last_update_date": datetime(2026, 7, 5, 12, 0, 0),
        "created_at": datetime(2026, 1, 12, 0, 0, 0),
        "updated_at": datetime(2026, 7, 5, 12, 0, 0),
    }
    
    apartments_mock = [
        {
            "id": UUID("550e8400-e29b-41d4-a716-446655440021"),
            "code": "DEP 2B",
            "floor": 2,
            "tower": "B",
            "area_sqm": 120.50,
            "allocated_quota_percent": 2.45,
            "bedrooms": 3,
            "bathrooms": 2.5,
            "parking": "1 (P-28)",
            "storage": "B-12",
            "acquisition_date": date(2022, 6, 15),
            "use_type": "RESIDENCIAL",
            "status": "ACTIVO",
        }
    ]

    original_fetchrow = db_with_users.fetchrow

    async def mock_fetchrow(query, *args):
        if "FROM owners" in query:
            return owner_mock
        return await original_fetchrow(query, *args)

    async def mock_fetch(query, *args):
        if "FROM apartments" in query and "owner_apartments" in query:
            return apartments_mock
        return []

    with patch.object(db_with_users, 'fetchrow', side_effect=mock_fetchrow), \
         patch.object(db_with_users, 'fetch', side_effect=mock_fetch):
         
        response = await async_client.get("/api/v1/owner/profile", headers=propietario_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Juan Francisco Cuaical"
        assert len(data["units"]) == 1
        assert data["units"][0]["code"] == "DEP 2B"
        assert data["units"][0]["bedrooms"] == 3

@pytest.mark.asyncio
async def test_update_owner_profile_success(
    async_client: AsyncClient,
    propietario_headers: dict,
    db_with_users: AsyncMock
):
    """Should successfully update owner profile and return 200."""
    owner_mock = {
        "id": UUID("550e8400-e29b-41d4-a716-446655440020"),
        "full_name": "Juan Francisco Cuaical",
        "document_id": "1712345678",
        "phone": "+593 99 295 3596",
        "email": "juan.cuaical@example.com",
        "status": "ACTIVO",
        "birth_date": date(1985, 4, 15),
        "occupant_name": "María Fernanda Cuaical",
        "occupant_relation": "Cónyuge",
        "occupant_phone": "+593 98 765 4321",
        "occupant_inhabitants": 3,
        "emergency_name": "Carlos Cuaical",
        "emergency_relation": "Hermano",
        "emergency_phone": "+593 97 123 4567",
        "notifications_enabled": True,
        "last_update_date": datetime(2026, 7, 5, 12, 0, 0),
        "created_at": datetime(2026, 1, 12, 0, 0, 0),
        "updated_at": datetime(2026, 7, 5, 12, 0, 0),
    }

    original_fetchrow = db_with_users.fetchrow

    async def mock_fetchrow(query, *args):
        if "FROM owners" in query or "UPDATE owners" in query:
            return owner_mock
        return await original_fetchrow(query, *args)

    async def mock_fetch(query, *args):
        return []

    update_payload = {
        "full_name": "Juan Francisco Cuaical Updated",
        "document_id": "1712345678",
        "phone": "+593 99 295 3596",
        "email": "juan.cuaical@example.com",
        "birth_date": "1985-04-15",
        "occupant_name": "María Fernanda Cuaical",
        "occupant_relation": "Cónyuge",
        "occupant_phone": "+593 98 765 4321",
        "occupant_inhabitants": 3,
        "emergency_name": "Carlos Cuaical",
        "emergency_relation": "Hermano",
        "emergency_phone": "+593 97 123 4567",
        "notifications_enabled": False
    }

    with patch.object(db_with_users, 'fetchrow', side_effect=mock_fetchrow), \
         patch.object(db_with_users, 'fetch', side_effect=mock_fetch):
         
        response = await async_client.put(
            "/api/v1/owner/profile",
            headers=propietario_headers,
            json=update_payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Juan Francisco Cuaical"

@pytest.mark.asyncio
async def test_download_owner_ficha_success(
    async_client: AsyncClient,
    propietario_headers: dict,
    db_with_users: AsyncMock
):
    """Should successfully generate and download owner ficha PDF."""
    owner_mock = {
        "id": UUID("550e8400-e29b-41d4-a716-446655440020"),
        "full_name": "Juan Francisco Cuaical",
        "document_id": "1712345678",
        "phone": "+593 99 295 3596",
        "email": "juan.cuaical@example.com",
        "status": "ACTIVO",
        "birth_date": date(1985, 4, 15),
        "occupant_name": "María Fernanda Cuaical",
        "occupant_relation": "Cónyuge",
        "occupant_phone": "+593 98 765 4321",
        "occupant_inhabitants": 3,
        "emergency_name": "Carlos Cuaical",
        "emergency_relation": "Hermano",
        "emergency_phone": "+593 97 123 4567",
        "notifications_enabled": True,
        "last_update_date": datetime(2026, 7, 5, 12, 0, 0),
        "created_at": datetime(2026, 1, 12, 0, 0, 0),
        "updated_at": datetime(2026, 7, 5, 12, 0, 0),
    }
    
    building_mock = {
        "id": UUID("550e8400-e29b-41d4-a716-446655449999"),
        "name": "Edificio Torres Netanya",
    }

    apt_mock = {
        "id": UUID("550e8400-e29b-41d4-a716-446655440021"),
        "code": "DEP 2B",
        "floor": 2,
        "tower": "B",
        "area_sqm": 120.50,
        "allocated_quota_percent": 2.45,
        "bedrooms": 3,
        "bathrooms": 2.5,
        "parking": "1 (P-28)",
        "storage": "B-12",
        "acquisition_date": date(2022, 6, 15),
        "use_type": "RESIDENCIAL",
        "status": "ACTIVO",
    }

    original_fetchrow = db_with_users.fetchrow

    async def mock_fetchrow(query, *args):
        if "FROM owners" in query:
            return owner_mock
        elif "FROM buildings" in query:
            return building_mock
        elif "FROM apartments" in query:
            return apt_mock
        elif "SELECT due_day" in query:
            return {"due_day": 5}
        elif "SUM(fees_amount" in query:
            return {"total_balance": 0.0}
        return await original_fetchrow(query, *args)

    async def mock_fetchval(query, *args):
        return 0.0

    async def mock_fetch(query, *args):
        return []

    with patch.object(db_with_users, 'fetchrow', side_effect=mock_fetchrow), \
         patch.object(db_with_users, 'fetchval', side_effect=mock_fetchval), \
         patch.object(db_with_users, 'fetch', side_effect=mock_fetch):
         
        response = await async_client.get("/api/v1/owner/ficha", headers=propietario_headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 0

@pytest.mark.asyncio
async def test_get_owners_me_success(
    async_client: AsyncClient,
    propietario_headers: dict,
    db_with_users: AsyncMock
):
    """Should return 200 and details for /owners/me."""
    owner_mock = {
        "id": UUID("550e8400-e29b-41d4-a716-446655440020"),
        "full_name": "Juan Francisco Cuaical",
        "document_id": "1712345678",
        "phone": "+593 99 295 3596",
        "email": "juan.cuaical@example.com",
        "status": "ACTIVO",
    }
    
    apartments_mock = [
        {
            "id": UUID("550e8400-e29b-41d4-a716-446655440021"),
            "code": "DEP 2B",
            "floor": 2,
            "tower": "B",
            "area_sqm": 120.50,
            "allocated_quota_percent": 2.45,
            "bedrooms": 3,
            "bathrooms": 2.5,
            "parking": "1 (P-28)",
            "storage": "B-12",
            "acquisition_date": date(2022, 6, 15),
            "use_type": "RESIDENCIAL",
            "status": "ACTIVO",
        }
    ]

    original_fetchrow = db_with_users.fetchrow

    async def mock_fetchrow(query, *args):
        if "FROM owners" in query:
            return owner_mock
        elif "total_balance" in query:
            return {"total_balance": 150.0}
        return await original_fetchrow(query, *args)

    async def mock_fetch(query, *args):
        if "FROM apartments" in query:
            return apartments_mock
        elif "PAYMENT" in query:
            return [
                {
                    "type": "PAYMENT",
                    "period": "2026-05",
                    "amount": Decimal("150.00"),
                    "date": date(2026, 5, 20),
                    "reference": "REF-001",
                }
            ]
        return []

    with patch.object(db_with_users, 'fetchrow', side_effect=mock_fetchrow), \
         patch.object(db_with_users, 'fetch', side_effect=mock_fetch):
         
        response = await async_client.get("/api/v1/owners/me", headers=propietario_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Juan Francisco Cuaical"
        assert data["balance_consolidated"] == 150.0
        assert len(data["recent_transactions"]) == 1

