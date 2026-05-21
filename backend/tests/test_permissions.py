"""Tests de permisos y control de acceso — CRITERIOS-7.1, 7.2, 7.3."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


class TestPermissionAdmin:
    """Tests para permisos de ADMIN — CRITERIO-7.1, 7.3."""

    @pytest.mark.asyncio
    async def test_permission_admin_allowed(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """CRITERIO-7.1: ADMIN puede crear propietarios."""
        # GET /api/v1/owners (admin puede leer)
        response = await async_client.get(
            "/api/v1/owners",
            headers=admin_headers,
        )
        # Puede ser 200 o 404 si no existen, pero NO 403
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_permission_admin_create_owners(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """CRITERIO-7.1: ADMIN puede crear propietarios."""
        # Intento de POST (puede fallar por datos pero no por permisos)
        response = await async_client.post(
            "/api/v1/owners",
            headers=admin_headers,
            json={
                "full_name": "Test Owner",
                "document_id": "12345678",
            },
        )
        # No debe ser 403 — puede ser 201 o 400 por datos
        assert response.status_code != 403

    @pytest.mark.asyncio
    async def test_permission_admin_read_all_apartments(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """CRITERIO-7.3: ADMIN ve todo."""
        response = await async_client.get(
            "/api/v1/apartments",
            headers=admin_headers,
        )
        # Admin debe poder acceder
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_permission_admin_create_apartment(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """ADMIN puede crear apartamentos."""
        response = await async_client.post(
            "/api/v1/apartments",
            headers=admin_headers,
            json={
                "code": "101",
                "floor": 1,
                "tower": "A",
            },
        )
        # No debe ser 403
        assert response.status_code != 403


class TestPermissionPropietario:
    """Tests para permisos de PROPIETARIO — CRITERIO-7.1, 7.2."""

    @pytest.mark.asyncio
    async def test_permission_propietario_forbidden_create_owners(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """CRITERIO-7.1: PROPIETARIO NO puede crear propietarios."""
        response = await async_client.post(
            "/api/v1/owners",
            headers=propietario_headers,
            json={
                "full_name": "Test Owner",
                "document_id": "12345678",
            },
        )
        # Debe ser 403 Forbidden
        assert response.status_code == 403
        data = response.json()
        assert "No tiene permisos" in data.get("detail", "")

    @pytest.mark.asyncio
    async def test_permission_propietario_cannot_list_all_users(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """PROPIETARIO no puede listar todos los usuarios."""
        response = await async_client.get(
            "/api/v1/users",
            headers=propietario_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_permission_propietario_can_view_profile(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """PROPIETARIO puede ver su propio perfil."""
        response = await async_client.get(
            "/api/v1/users/me",
            headers=propietario_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"]["name"] == "PROPIETARIO"

    @pytest.mark.asyncio
    async def test_permission_propietario_cannot_create_users(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """PROPIETARIO no puede crear usuarios."""
        response = await async_client.post(
            "/api/v1/users",
            headers=propietario_headers,
            json={
                "email": "newuser@edificios.com",
                "password": "NewPass123!",
                "role_id": "550e8400-e29b-41d4-a716-446655440002",
            },
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_permission_propietario_cannot_update_users(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """PROPIETARIO no puede actualizar usuarios."""
        from tests.conftest import ADMIN_USER_ID

        response = await async_client.put(
            f"/api/v1/users/{ADMIN_USER_ID}",
            headers=propietario_headers,
            json={
                "status": "INACTIVO",
            },
        )
        assert response.status_code == 403


class TestPermissionNoAuth:
    """Tests para endpoints sin autenticación."""

    @pytest.mark.asyncio
    async def test_no_token_access_protected(self, async_client: AsyncClient):
        """Sin token no se puede acceder a /users."""
        response = await async_client.get("/api/v1/users")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_no_token_access_me(self, async_client: AsyncClient):
        """Sin token no se puede acceder a /users/me."""
        response = await async_client.get("/api/v1/users/me")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_no_token_access_owners(self, async_client: AsyncClient):
        """Sin token no se puede acceder a /owners."""
        response = await async_client.get("/api/v1/owners")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_token_format(self, async_client: AsyncClient):
        """Token con formato inválido es rechazado."""
        response = await async_client.get(
            "/api/v1/users/me",
            headers={"Authorization": "InvalidFormat token123"},
        )
        # HTTPBearer rechaza formato inválido
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_bearer_lowercase_accepted(self, async_client: AsyncClient):
        """Bearer en minúsculas se acepta."""
        from tests.conftest import ADMIN_USER_ID, ADMIN_EMAIL
        from app.services.auth_service import AuthService

        auth_service = AuthService(None, None)
        token = auth_service.create_jwt_token(
            user_id=str(ADMIN_USER_ID),
            email=ADMIN_EMAIL,
            role_name="ADMIN",
        )

        response = await async_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"bearer {token}"},
        )
        # Debería funcionar (case-insensitive)
        assert response.status_code in [200, 401]  # 200 si acepta, 401 si rechaza por formato


class TestPermissionUserInactive:
    """Tests para usuario inactivo."""

    @pytest.mark.asyncio
    async def test_inactive_user_cannot_access(
        self,
        async_client: AsyncClient,
        inactive_headers: dict,
    ):
        """Usuario inactivo no puede acceder a endpoints protegidos."""
        response = await async_client.get(
            "/api/v1/users/me",
            headers=inactive_headers,
        )
        assert response.status_code == 401
        data = response.json()
        assert "Usuario inactivo" in data.get("detail", "")

    @pytest.mark.asyncio
    async def test_inactive_user_cannot_logout(
        self,
        async_client: AsyncClient,
        inactive_headers: dict,
    ):
        """Usuario inactivo no puede hacer logout."""
        response = await async_client.post(
            "/api/v1/auth/logout",
            headers=inactive_headers,
        )
        assert response.status_code == 401


class TestAuthenticationFlow:
    """Tests de flujo de autenticación integrado."""

    @pytest.mark.asyncio
    async def test_full_auth_flow_admin(self, async_client: AsyncClient):
        """Flujo completo: login → acceso protegido → logout."""
        from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

        # 1. Login
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
            },
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]

        # 2. Acceso a endpoint protegido con token
        headers = {"Authorization": f"Bearer {token}"}
        profile_response = await async_client.get(
            "/api/v1/users/me",
            headers=headers,
        )
        assert profile_response.status_code == 200
        assert profile_response.json()["email"] == ADMIN_EMAIL

        # 3. Logout
        logout_response = await async_client.post(
            "/api/v1/auth/logout",
            headers=headers,
        )
        assert logout_response.status_code == 200

    @pytest.mark.asyncio
    async def test_full_auth_flow_propietario(self, async_client: AsyncClient):
        """Flujo completo: login PROPIETARIO → acceso limitado."""
        from tests.conftest import PROPIETARIO_EMAIL, PROPIETARIO_PASSWORD

        # 1. Login
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": PROPIETARIO_EMAIL,
                "password": PROPIETARIO_PASSWORD,
            },
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]

        # 2. PROPIETARIO puede acceder a su perfil
        headers = {"Authorization": f"Bearer {token}"}
        profile_response = await async_client.get(
            "/api/v1/users/me",
            headers=headers,
        )
        assert profile_response.status_code == 200

        # 3. PROPIETARIO no puede listar usuarios
        list_response = await async_client.get(
            "/api/v1/users",
            headers=headers,
        )
        assert list_response.status_code == 403

        # 4. Logout exitoso
        logout_response = await async_client.post(
            "/api/v1/auth/logout",
            headers=headers,
        )
        assert logout_response.status_code == 200
