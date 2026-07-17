from __future__ import annotations

from datetime import date, time, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4
import pytest
from httpx import AsyncClient

from tests.conftest import (
    ADMIN_USER_ID,
    PROPIETARIO_USER_ID,
    PROPIETARIO_ROLE_ID,
)


class TestAnnouncementsAndEvents:
    @pytest.mark.asyncio
    @patch("app.services.email_service.EmailService.send_email", new_callable=AsyncMock)
    async def test_announcements_flow(
        self,
        mock_send_email: AsyncMock,
        async_client: AsyncClient,
        admin_headers: dict,
        propietario_headers: dict,
        db_with_users: AsyncMock,
    ):
        mock_send_email.return_value = True
        ann_id = uuid4()
        
        # 1. Mock DB call for POST /api/v1/announcements
        # We need mock DB fetchrow and fetch. Let's patch db_with_users.fetchrow and db_with_users.fetch
        original_fetchrow = db_with_users.fetchrow
        original_fetch = db_with_users.fetch
        
        async def mock_fetchrow(query: str, *args):
            if "INSERT INTO announcements" in query:
                return {
                    "id": ann_id,
                    "title": args[0],
                    "description": args[1],
                    "created_at": datetime.now(),
                }
            elif "INSERT INTO notifications" in query:
                return {
                    "id": uuid4(),
                    "type": args[0],
                    "payload": args[1],
                    "target_role": args[2],
                    "target_user_id": args[3],
                    "reference_id": args[4],
                }
            elif "SELECT * FROM announcements WHERE id = $1" in query:
                return {
                    "id": ann_id,
                    "title": "Aviso de prueba",
                    "description": "Detalle del aviso de prueba",
                    "created_at": datetime.now(),
                }
            return await original_fetchrow(query, *args)
            
        async def mock_fetch(query: str, *args):
            if "SELECT * FROM announcements" in query:
                return [
                    {
                        "id": ann_id,
                        "title": "Aviso de prueba",
                        "description": "Detalle del aviso de prueba",
                        "created_at": datetime.now(),
                    }
                ]
            return await original_fetch(query, *args)
            
        db_with_users.fetchrow = mock_fetchrow
        db_with_users.fetch = mock_fetch

        # Test POST announcement
        response = await async_client.post(
            "/api/v1/announcements",
            headers=admin_headers,
            json={
                "title": "Aviso de prueba",
                "description": "Detalle del aviso de prueba",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Aviso de prueba"
        assert data["description"] == "Detalle del aviso de prueba"

        # Test GET announcements (admin)
        response_list = await async_client.get(
            "/api/v1/announcements",
            headers=admin_headers,
        )
        assert response_list.status_code == 200
        list_data = response_list.json()
        assert len(list_data) >= 1
        assert list_data[0]["title"] == "Aviso de prueba"

        # Test GET recent announcements (owner)
        response_recent = await async_client.get(
            "/api/v1/owner/announcements/recent",
            headers=propietario_headers,
            params={"limit": 5},
        )
        assert response_recent.status_code == 200
        recent_data = response_recent.json()
        assert len(recent_data) >= 1
        assert recent_data[0]["title"] == "Aviso de prueba"

        # Test GET all announcements (owner)
        response_owner_list = await async_client.get(
            "/api/v1/owner/announcements",
            headers=propietario_headers,
        )
        assert response_owner_list.status_code == 200
        owner_list_data = response_owner_list.json()
        assert len(owner_list_data) >= 1
        assert owner_list_data[0]["description"] == "Detalle del aviso de prueba"

        # Test GET announcement detail (owner)
        response_owner_detail = await async_client.get(
            f"/api/v1/owner/announcements/{ann_id}",
            headers=propietario_headers,
        )
        assert response_owner_detail.status_code == 200
        detail_data = response_owner_detail.json()
        assert detail_data["title"] == "Aviso de prueba"

    @pytest.mark.asyncio
    @patch("app.services.email_service.EmailService.send_email", new_callable=AsyncMock)
    async def test_events_flow(
        self,
        mock_send_email: AsyncMock,
        async_client: AsyncClient,
        admin_headers: dict,
        propietario_headers: dict,
        db_with_users: AsyncMock,
    ):
        mock_send_email.return_value = True
        event_id = uuid4()
        owner_uuid = uuid4()
        
        original_fetchrow = db_with_users.fetchrow
        original_fetch = db_with_users.fetch
        
        async def mock_fetchrow(query: str, *args):
            if "INSERT INTO events" in query:
                return {
                    "id": event_id,
                    "title": args[0],
                    "description": args[1],
                    "event_date": args[2],
                    "start_time": args[3],
                    "end_time": args[4],
                    "created_at": datetime.now(),
                }
            elif "SELECT * FROM owners WHERE id =" in query:
                return {
                    "id": owner_uuid,
                    "full_name": "Propietario de Prueba",
                    "document_id": "1234567890",
                    "email": "owner_test@example.com",
                    "firebase_uid": "test-uid",
                }
            elif "SELECT * FROM owners WHERE firebase_uid =" in query:
                return {
                    "id": owner_uuid,
                    "full_name": "Propietario de Prueba",
                    "document_id": "1234567890",
                    "email": "owner_test@example.com",
                    "firebase_uid": "test-uid",
                }
            elif "INSERT INTO notifications" in query:
                return {
                    "id": uuid4(),
                }
            return await original_fetchrow(query, *args)
            
        async def mock_fetch(query: str, *args):
            if "SELECT * FROM events" in query:
                return [
                    {
                        "id": event_id,
                        "title": "Asamblea",
                        "description": "Detalle asamblea",
                        "event_date": date(2026, 7, 15),
                        "start_time": time(18, 30),
                        "end_time": time(20, 0),
                    }
                ]
            elif "FROM events e" in query:
                return [
                    {
                        "id": event_id,
                        "title": "Asamblea",
                        "description": "Detalle asamblea",
                        "event_date": date(2026, 7, 15),
                        "start_time": time(18, 30),
                        "end_time": time(20, 0),
                    }
                ]
            elif "event_owners eo" in query:
                return [
                    {
                        "id": owner_uuid,
                        "full_name": "Propietario de Prueba",
                        "email": "owner_test@example.com",
                    }
                ]
            return await original_fetch(query, *args)
            
        db_with_users.fetchrow = mock_fetchrow
        db_with_users.fetch = mock_fetch

        # Test POST event (admin)
        response = await async_client.post(
            "/api/v1/events",
            headers=admin_headers,
            json={
                "title": "Asamblea",
                "description": "Detalle asamblea",
                "event_date": "2026-07-15",
                "start_time": "18:30",
                "end_time": "20:00",
                "owner_ids": [str(owner_uuid)],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Asamblea"
        
        # Verify email trigger was called
        mock_send_email.assert_called()

        # Test GET events (admin)
        response_list = await async_client.get(
            "/api/v1/events",
            headers=admin_headers,
        )
        assert response_list.status_code == 200
        list_data = response_list.json()
        assert len(list_data) == 1
        assert list_data[0]["title"] == "Asamblea"
        assert list_data[0]["assigned_owners"][0]["full_name"] == "Propietario de Prueba"

        # Test GET my events (owner)
        response_my = await async_client.get(
            "/api/v1/owner/events",
            headers=propietario_headers,
        )
        assert response_my.status_code == 200
        my_data = response_my.json()
        assert len(my_data) == 1
        assert my_data[0]["title"] == "Asamblea"
        assert my_data[0]["start_time"] == "18:30"
