"""Tests de notificaciones por correo y flujo de contraseñas temporales."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4
import pytest
from httpx import AsyncClient

from tests.conftest import (
    ADMIN_EMAIL,
    PROPIETARIO_ROLE_ID,
)
from app.services.email_service import EmailService


class TestEmailNotifications:
    @pytest.mark.asyncio
    @patch("app.services.email_service.EmailService.send_email", new_callable=AsyncMock)
    async def test_create_user_temp_password_and_email(
        self,
        mock_send_email: AsyncMock,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """Crear usuario sin contraseña debe generar una contraseña temporal y enviar correo."""
        mock_send_email.return_value = True

        new_email = f"temp_user_{uuid4().hex[:6]}@edificios.com"
        response = await async_client.post(
            "/api/v1/users",
            headers=admin_headers,
            json={
                "email": new_email,
                "role_id": str(PROPIETARIO_ROLE_ID),
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == new_email
        assert data["password_is_temp"] is True

        # Verificar que se llamó al envío de correo
        mock_send_email.assert_called_once()
        called_args, called_kwargs = mock_send_email.call_args
        # El primer argumento es la dirección del correo destino
        assert called_args[0] == new_email
        assert "credenciales" in called_args[2] or "contraseña" in called_args[2].lower()

    @pytest.mark.asyncio
    @patch("app.services.email_service.EmailService.send_email", new_callable=AsyncMock)
    async def test_email_service_sends_payment_notifications(
        self,
        mock_send_email: AsyncMock,
    ):
        """EmailService debe despachar correos al subir pagos."""
        mock_send_email.return_value = True

        payment_id = uuid4()
        await EmailService.send_payment_uploaded_emails(
            owner_email="owner@test.com",
            owner_name="Juan Perez",
            amount=150.0,
            period="2026-06",
            payment_id=payment_id,
        )

        # Se debe enviar al administrador y al propietario (2 correos)
        assert mock_send_email.call_count == 2

    @pytest.mark.asyncio
    @patch("app.services.email_service.EmailService.send_email", new_callable=AsyncMock)
    async def test_email_service_sends_payment_approval(
        self,
        mock_send_email: AsyncMock,
    ):
        """EmailService debe notificar la aprobación del pago al propietario."""
        mock_send_email.return_value = True

        await EmailService.send_payment_approved_email(
            owner_email="owner@test.com",
            owner_name="Juan Perez",
            amount=150.0,
            period="2026-06",
        )

        mock_send_email.assert_called_once()
        args = mock_send_email.call_args[0]
        assert args[0] == "owner@test.com"
        assert "Aprobado" in args[1]
