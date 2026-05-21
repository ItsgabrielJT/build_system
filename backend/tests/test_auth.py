"""Tests de autenticación — login, logout, JWT."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from uuid import uuid4

from tests.conftest import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    PROPIETARIO_EMAIL,
    PROPIETARIO_PASSWORD,
    INACTIVE_EMAIL,
    ADMIN_USER_ID,
    PROPIETARIO_USER_ID,
    INACTIVE_USER_ID,
)


class TestAuthLogin:
    """Tests para endpoint POST /api/v1/auth/login."""

    @pytest.mark.asyncio
    async def test_auth_login_success(self, async_client: AsyncClient):
        """CRITERIO-1.1: Login exitoso con credenciales válidas."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"]["name"] == "ADMIN"
        assert "id" in data["user"]
        assert "status" in data["user"]

    @pytest.mark.asyncio
    async def test_auth_login_invalid_password(self, async_client: AsyncClient):
        """CRITERIO-1.2: Login rechazado con contraseña incorrecta."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": "WrongPassword123",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "Credenciales inválidas" in data["detail"]

    @pytest.mark.asyncio
    async def test_auth_login_user_not_found(self, async_client: AsyncClient):
        """CRITERIO-1.3: Login rechazado si usuario no existe."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@edificios.com",
                "password": "SomePassword123",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert "Credenciales inválidas" in data["detail"]

    @pytest.mark.asyncio
    async def test_auth_login_validation_missing_email(self, async_client: AsyncClient):
        """CRITERIO-1.4: Validación — falta email."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "password": ADMIN_PASSWORD,
            },
        )
        assert response.status_code == 422  # Validation error (Pydantic)
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_auth_login_validation_missing_password(self, async_client: AsyncClient):
        """CRITERIO-1.4: Validación — falta password."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": ADMIN_EMAIL,
            },
        )
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_auth_login_inactive_user(self, async_client: AsyncClient):
        """Usuario inactivo no puede loginear."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": INACTIVE_EMAIL,
                "password": "InactivePass123",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert "Usuario inactivo" in data["detail"]

    @pytest.mark.asyncio
    async def test_auth_login_propietario_success(self, async_client: AsyncClient):
        """CRITERIO-1.1: Login exitoso para PROPIETARIO."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": PROPIETARIO_EMAIL,
                "password": PROPIETARIO_PASSWORD,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == PROPIETARIO_EMAIL
        assert data["user"]["role"]["name"] == "PROPIETARIO"


class TestAuthLogout:
    """Tests para endpoint POST /api/v1/auth/logout."""

    @pytest.mark.asyncio
    async def test_auth_logout_success(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """CRITERIO-2.1: Logout exitoso con token válido."""
        response = await async_client.post(
            "/api/v1/auth/logout",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Sesión cerrada" in data["message"]

    @pytest.mark.asyncio
    async def test_auth_logout_no_token(self, async_client: AsyncClient):
        """CRITERIO-2.2: Logout rechazado sin Authorization header."""
        response = await async_client.post("/api/v1/auth/logout")
        assert response.status_code == 403  # No credentials
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_auth_logout_invalid_token(self, async_client: AsyncClient):
        """Logout rechazado con token inválido."""
        response = await async_client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401
        data = response.json()
        assert "Token inválido" in data["detail"]

    @pytest.mark.asyncio
    async def test_auth_logout_expired_token(
        self,
        async_client: AsyncClient,
        expired_headers: dict,
    ):
        """Logout rechazado con token expirado."""
        response = await async_client.post(
            "/api/v1/auth/logout",
            headers=expired_headers,
        )
        assert response.status_code == 401
        data = response.json()
        assert "Token expirado" in data["detail"]

    @pytest.mark.asyncio
    async def test_auth_logout_propietario_success(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """Logout exitoso para PROPIETARIO."""
        response = await async_client.post(
            "/api/v1/auth/logout",
            headers=propietario_headers,
        )
        assert response.status_code == 200


class TestJWTTokenValidation:
    """Tests para validación de JWT tokens — RN-03."""

    @pytest.mark.asyncio
    async def test_jwt_token_valid(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """RN-03: Token válido se acepta."""
        response = await async_client.get(
            "/api/v1/users/me",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL

    @pytest.mark.asyncio
    async def test_jwt_token_invalid(self, async_client: AsyncClient):
        """RN-03: Token inválido se rechaza (401)."""
        response = await async_client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer invalid.token.xyz"},
        )
        assert response.status_code == 401
        data = response.json()
        assert "Token inválido" in data["detail"]

    @pytest.mark.asyncio
    async def test_jwt_token_expiration(
        self,
        async_client: AsyncClient,
        expired_headers: dict,
    ):
        """RN-03: Token expirado retorna 401."""
        response = await async_client.get(
            "/api/v1/users/me",
            headers=expired_headers,
        )
        assert response.status_code == 401
        data = response.json()
        assert "Token expirado" in data["detail"]

    @pytest.mark.asyncio
    async def test_jwt_payload_structure(self, admin_token: str):
        """JWT contiene sub, email, role, exp."""
        import jwt
        from app.config.settings import settings

        decoded = jwt.decode(
            admin_token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        assert "sub" in decoded
        assert "email" in decoded
        assert "role" in decoded
        assert "exp" in decoded
        assert decoded["role"] == "ADMIN"


class TestPasswordHashing:
    """Tests para hashing de contraseñas — RN-02."""

    def test_password_hashing_bcrypt(self):
        """RN-02: Contraseña se hashea con bcrypt."""
        from app.services.auth_service import AuthService

        password = "TestPassword123"
        hashed = AuthService.hash_password(password)

        # Hash no es plaintext
        assert hashed != password
        assert len(hashed) > len(password)

        # Verificar que bcrypt hash es válido
        assert AuthService.verify_password(password, hashed)

    def test_password_different_hashes_same_password(self):
        """Mismo password genera diferentes hashes (bcrypt salt random)."""
        from app.services.auth_service import AuthService

        password = "TestPassword123"
        hash1 = AuthService.hash_password(password)
        hash2 = AuthService.hash_password(password)

        # Diferentes hashes
        assert hash1 != hash2

        # Pero ambos verifican contra el mismo password
        assert AuthService.verify_password(password, hash1)
        assert AuthService.verify_password(password, hash2)

    def test_password_verification_wrong_password(self):
        """RN-02: Plaintext nunca se guarda."""
        from app.services.auth_service import AuthService

        password = "CorrectPassword123"
        hashed = AuthService.hash_password(password)

        assert not AuthService.verify_password("WrongPassword123", hashed)
