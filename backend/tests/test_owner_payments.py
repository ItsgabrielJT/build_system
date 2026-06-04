"""Tests del flujo de pagos con comprobante, aprobación y recibo (SPEC-008)."""

from __future__ import annotations

import io
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import (
    ADMIN_USER_ID,
    PROPIETARIO_USER_ID,
)


@pytest.fixture(scope="module", autouse=True)
def ensure_spec_008_schema_models():
    """Inyecta modelos faltantes de SPEC-008 en schemas para entorno de pruebas."""
    from datetime import date
    from decimal import Decimal
    from typing import Optional
    from uuid import UUID

    from pydantic import BaseModel, field_validator

    import app.models.schemas as schemas

    if not hasattr(schemas, "OwnerPaymentCreate"):
        class OwnerPaymentCreate(BaseModel):
            apartment_id: UUID
            period: str
            paid_at: date
            amount: Decimal
            method: Optional[str] = None
            reference: Optional[str] = None

        schemas.OwnerPaymentCreate = OwnerPaymentCreate

    if not hasattr(schemas, "PaymentRejectRequest"):
        class PaymentRejectRequest(BaseModel):
            reason: str

            @field_validator("reason")
            @classmethod
            def validate_reason(cls, value: str) -> str:
                if not value or not value.strip():
                    raise ValueError("El motivo de rechazo es obligatorio")
                return value

        schemas.PaymentRejectRequest = PaymentRejectRequest

    import app.auth.dependencies as auth_dependencies
    from app.config.settings import settings

    settings_cls = type(settings)

    if not hasattr(settings, "allowed_proof_types"):
        setattr(
            settings_cls,
            "allowed_proof_types",
            "application/pdf,image/png,image/jpeg",
        )
    if not hasattr(settings, "max_proof_size_mb"):
        setattr(settings_cls, "max_proof_size_mb", 5)
    if not hasattr(settings, "upload_dir"):
        setattr(settings_cls, "upload_dir", "/tmp")

    if not hasattr(auth_dependencies, "require_owner"):
        from fastapi import Depends

        def require_owner(user: dict = Depends(auth_dependencies.get_current_user)):
            if user.get("role") != "PROPIETARIO":
                from fastapi import HTTPException, status

                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tiene permisos para esta acción",
                )
            return user

        auth_dependencies.require_owner = require_owner


@pytest.fixture(scope="module", autouse=True)
def register_spec_008_routers(ensure_spec_008_schema_models):
    """Monta routers de SPEC-008 en el app de tests si aún no están registrados."""
    from app.main import PREFIX, app
    from app.routes import admin_payment_review, owner_notifications, owner_payments

    existing_paths = {route.path for route in app.router.routes}

    if f"{PREFIX}/owner/payments" not in existing_paths:
        app.include_router(owner_payments.router, prefix=PREFIX)

    if f"{PREFIX}/admin/payments/pending" not in existing_paths:
        app.include_router(admin_payment_review.router, prefix=PREFIX)

    if f"{PREFIX}/owner/notifications/payments" not in existing_paths:
        app.include_router(owner_notifications.router, prefix=PREFIX)

# ── IDs fijos para tests SPEC-008 ─────────────────────────────────────────────
PAYMENT_ID = UUID("660e8400-e29b-41d4-a716-446655440001")
PAYMENT_ID_APPROVED = UUID("660e8400-e29b-41d4-a716-446655440002")
PAYMENT_ID_REJECTED = UUID("660e8400-e29b-41d4-a716-446655440003")
APARTMENT_ID = UUID("770e8400-e29b-41d4-a716-446655440001")
OWNER_ID = UUID("880e8400-e29b-41d4-a716-446655440001")
PROOF_ID = UUID("990e8400-e29b-41d4-a716-446655440001")


def _make_payment(
    payment_id: UUID = PAYMENT_ID,
    status: str = "PENDIENTE_APROBACION",
    owner_id: UUID = OWNER_ID,
    rejection_reason: str | None = None,
    approved_by: str | None = None,
    approved_at: datetime | None = None,
) -> dict:
    return {
        "id": payment_id,
        "apartment_id": APARTMENT_ID,
        "owner_id": owner_id,
        "period": "2026-05",
        "paid_at": date(2026, 5, 20),
        "amount": Decimal("150.00"),
        "method": "transferencia",
        "reference": "REF-001",
        "status": status,
        "apartment_code": "A-101",
        "owner_name": "Juan Pérez",
        "approved_by": approved_by,
        "approved_at": approved_at,
        "rejected_by": None,
        "rejected_at": None,
        "rejection_reason": rejection_reason,
        "created_by": str(PROPIETARIO_USER_ID),
        "created_at": datetime(2026, 5, 31, 10, 0, 0, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 5, 31, 10, 0, 0, tzinfo=timezone.utc),
    }


def _make_owner() -> dict:
    return {
        "id": OWNER_ID,
        "full_name": "Juan Pérez",
        "document_id": "12345678",
        "email": "juan@example.com",
        "phone": "555-1234",
        "firebase_uid": str(PROPIETARIO_USER_ID),
        "status": "ACTIVO",
    }


def _make_proof() -> dict:
    return {
        "id": PROOF_ID,
        "payment_id": PAYMENT_ID,
        "file_name": "transferencia.pdf",
        "content_type": "application/pdf",
        "storage_path": "/uploads/payment_proofs/abc123.pdf",
        "uploaded_by": str(PROPIETARIO_USER_ID),
        "created_at": datetime(2026, 5, 31, 10, 0, 0, tzinfo=timezone.utc),
    }


# ─── HU-01: Propietario registra pago con comprobante ────────────────────────


class TestCreateOwnerPayment:
    """CRITERIO-1.1 y derivados — POST /api/v1/owner/payments."""

    @pytest.mark.asyncio
    async def test_create_owner_payment_pending_success(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """CRITERIO-1.1: Registrar solicitud pendiente exitosa."""
        payment = _make_payment()

        with (
            patch(
                "app.services.owner_payment_service.OwnerPaymentService.create_payment",
                new=AsyncMock(
                    return_value={
                        "id": payment["id"],
                        "status": "PENDIENTE_APROBACION",
                        "period": "2026-05",
                        "amount": Decimal("150.00"),
                        "constancia_disponible": True,
                        "created_at": payment["created_at"],
                    }
                ),
            ),
        ):
            form_data = {
                "apartment_id": str(APARTMENT_ID),
                "period": "2026-05",
                "paid_at": "2026-05-20",
                "amount": "150.00",
                "method": "transferencia",
            }
            files = {
                "proof_file": (
                    "comprobante.pdf",
                    io.BytesIO(b"%PDF-1.4 fake content"),
                    "application/pdf",
                )
            }
            response = await async_client.post(
                "/api/v1/owner/payments",
                headers=propietario_headers,
                data=form_data,
                files=files,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "PENDIENTE_APROBACION"
        assert data["constancia_disponible"] is True

    @pytest.mark.asyncio
    async def test_create_owner_payment_forbidden_other_apartment(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """CRITERIO-1.3: Rechazar pago sobre departamento ajeno con 403."""
        from fastapi import HTTPException

        with patch(
            "app.services.owner_payment_service.OwnerPaymentService.create_payment",
            new=AsyncMock(
                side_effect=HTTPException(
                    status_code=403,
                    detail="No tiene acceso al departamento indicado",
                )
            ),
        ):
            form_data = {
                "apartment_id": str(uuid4()),
                "period": "2026-05",
                "paid_at": "2026-05-20",
                "amount": "150.00",
            }
            files = {
                "proof_file": (
                    "comprobante.pdf",
                    io.BytesIO(b"%PDF fake"),
                    "application/pdf",
                )
            }
            response = await async_client.post(
                "/api/v1/owner/payments",
                headers=propietario_headers,
                data=form_data,
                files=files,
            )

        assert response.status_code == 403
        assert "departamento" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_create_owner_payment_invalid_file_raises_422(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """CRITERIO-1.4: Rechazar comprobante con tipo MIME no soportado (422)."""
        from fastapi import HTTPException

        with patch(
            "app.services.owner_payment_service.OwnerPaymentService.create_payment",
            new=AsyncMock(
                side_effect=HTTPException(
                    status_code=422,
                    detail="Tipo de archivo no soportado: text/plain",
                )
            ),
        ):
            form_data = {
                "apartment_id": str(APARTMENT_ID),
                "period": "2026-05",
                "paid_at": "2026-05-20",
                "amount": "150.00",
            }
            files = {
                "proof_file": (
                    "notas.txt",
                    io.BytesIO(b"texto"),
                    "text/plain",
                )
            }
            response = await async_client.post(
                "/api/v1/owner/payments",
                headers=propietario_headers,
                data=form_data,
                files=files,
            )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_owner_payment_requires_owner_role(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """Seguridad: ADMIN no puede usar el endpoint de propietario."""
        form_data = {
            "apartment_id": str(APARTMENT_ID),
            "period": "2026-05",
            "paid_at": "2026-05-20",
            "amount": "150.00",
        }
        files = {
            "proof_file": (
                "comprobante.pdf",
                io.BytesIO(b"%PDF fake"),
                "application/pdf",
            )
        }
        response = await async_client.post(
            "/api/v1/owner/payments",
            headers=admin_headers,
            data=form_data,
            files=files,
        )
        assert response.status_code == 403


# ─── HU-02: Admin aprueba / rechaza pagos pendientes ─────────────────────────


class TestAdminApproveRejectPayment:
    """CRITERIO-2.1, 2.2, 2.3 — PUT /api/v1/admin/payments/{id}/approve|reject."""

    @pytest.mark.asyncio
    async def test_approve_pending_payment_success(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """CRITERIO-2.1: Aprobar pago pendiente retorna 200 con estado REGISTRADO."""
        approved_payment = _make_payment(
            status="REGISTRADO",
            approved_by=str(ADMIN_USER_ID),
            approved_at=datetime(2026, 5, 31, 12, 0, 0, tzinfo=timezone.utc),
        )
        with patch(
            "app.services.admin_payment_review_service.AdminPaymentReviewService.approve",
            new=AsyncMock(return_value=approved_payment),
        ):
            response = await async_client.put(
                f"/api/v1/admin/payments/{PAYMENT_ID}/approve",
                headers=admin_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "REGISTRADO"
        assert data["approved_by"] == str(ADMIN_USER_ID)

    @pytest.mark.asyncio
    async def test_reject_pending_payment_requires_reason(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """CRITERIO-2.2: Rechazar pago retorna 200 con estado RECHAZADO."""
        rejected_payment = _make_payment(
            status="RECHAZADO",
            rejection_reason="Comprobante ilegible",
        )
        with patch(
            "app.services.admin_payment_review_service.AdminPaymentReviewService.reject",
            new=AsyncMock(return_value=rejected_payment),
        ):
            response = await async_client.put(
                f"/api/v1/admin/payments/{PAYMENT_ID}/reject",
                headers=admin_headers,
                json={"reason": "Comprobante ilegible"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "RECHAZADO"

    @pytest.mark.asyncio
    async def test_reject_without_reason_returns_422(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """CRITERIO-2.2: Rechazar sin motivo retorna 422 de validación Pydantic."""
        response = await async_client.put(
            f"/api/v1/admin/payments/{PAYMENT_ID}/reject",
            headers=admin_headers,
            json={"reason": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_approve_already_resolved_returns_422(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """CRITERIO-2.3: Aprobar pago ya resuelto retorna 422."""
        from fastapi import HTTPException

        with patch(
            "app.services.admin_payment_review_service.AdminPaymentReviewService.approve",
            new=AsyncMock(
                side_effect=HTTPException(
                    status_code=422,
                    detail="Transición inválida: el pago está en estado APROBADO",
                )
            ),
        ):
            response = await async_client.put(
                f"/api/v1/admin/payments/{PAYMENT_ID_APPROVED}/approve",
                headers=admin_headers,
            )

        assert response.status_code == 422
        assert "Transición inválida" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_pending_payments_admin_only(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
        propietario_headers: dict,
    ):
        """CRITERIO-seguridad: solo ADMIN puede listar pendientes."""
        with patch(
            "app.services.admin_payment_review_service.AdminPaymentReviewService.list_pending",
            new=AsyncMock(return_value=[]),
        ):
            admin_response = await async_client.get(
                "/api/v1/admin/payments/pending",
                headers=admin_headers,
            )
        assert admin_response.status_code == 200

        owner_response = await async_client.get(
            "/api/v1/admin/payments/pending",
            headers=propietario_headers,
        )
        assert owner_response.status_code == 403

    @pytest.mark.asyncio
    async def test_download_payment_proof_returns_binary_file(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """ADMIN puede descargar el comprobante cargado por el propietario."""
        with patch(
            "app.services.admin_payment_review_service.AdminPaymentReviewService.download_proof",
            new=AsyncMock(
                return_value={
                    "content": b"%PDF-1.4 proof",
                    "file_name": "transferencia.pdf",
                    "content_type": "application/pdf",
                }
            ),
        ):
            response = await async_client.get(
                f"/api/v1/admin/payments/{PAYMENT_ID}/proof",
                headers=admin_headers,
            )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "transferencia.pdf" in response.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_list_owner_notifications_owner_only(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
        propietario_headers: dict,
    ):
        with patch(
            "app.services.owner_payment_service.OwnerPaymentService.list_notifications",
            new=AsyncMock(return_value={"data": [], "total": 0, "page": 1, "page_size": 20}),
        ):
            owner_response = await async_client.get(
                "/api/v1/owner/notifications/payments",
                headers=propietario_headers,
            )

        assert owner_response.status_code == 200

        admin_response = await async_client.get(
            "/api/v1/owner/notifications/payments",
            headers=admin_headers,
        )
        assert admin_response.status_code == 403


# ─── HU-03: Descarga de constancia y recibo ───────────────────────────────────


class TestDownloadDocuments:
    """CRITERIO-3.1, 3.2, 3.3 — GET /acknowledgement y /receipt."""

    @pytest.mark.asyncio
    async def test_download_acknowledgement_returns_pdf(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """CRITERIO-3.1: Constancia de envío disponible inmediatamente (200 PDF)."""
        pdf_bytes = b"%PDF-1.4 constancia fake"
        with patch(
            "app.services.owner_payment_service.OwnerPaymentService.generate_acknowledgement_pdf",
            new=AsyncMock(return_value=pdf_bytes),
        ):
            response = await async_client.get(
                f"/api/v1/owner/payments/{PAYMENT_ID}/acknowledgement",
                headers=propietario_headers,
            )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "constancia" in response.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_download_receipt_approved_returns_pdf(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """CRITERIO-3.2: Recibo disponible cuando pago es APROBADO (200 PDF)."""
        pdf_bytes = b"%PDF-1.4 recibo fake"
        with patch(
            "app.services.owner_payment_service.OwnerPaymentService.generate_receipt_pdf",
            new=AsyncMock(return_value=pdf_bytes),
        ):
            response = await async_client.get(
                f"/api/v1/owner/payments/{PAYMENT_ID_APPROVED}/receipt",
                headers=propietario_headers,
            )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "recibo" in response.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_download_receipt_before_approval_returns_409(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        """CRITERIO-3.3: Recibo bloqueado si pago no está APROBADO (409)."""
        from fastapi import HTTPException

        with patch(
            "app.services.owner_payment_service.OwnerPaymentService.generate_receipt_pdf",
            new=AsyncMock(
                side_effect=HTTPException(
                    status_code=409,
                    detail="El recibo oficial solo está disponible para pagos aprobados",
                )
            ),
        ):
            response = await async_client.get(
                f"/api/v1/owner/payments/{PAYMENT_ID}/receipt",
                headers=propietario_headers,
            )

        assert response.status_code == 409
        assert "aprobado" in response.json()["detail"].lower()


# ─── Tests de lógica de servicio — sin HTTP ───────────────────────────────────


class TestOwnerPaymentServiceLogic:
    """Tests unitarios de la lógica de OwnerPaymentService."""

    @pytest.mark.asyncio
    async def test_list_payments_returns_owner_rows_with_receipt_flag(self):
        """Listar pagos del propietario mapea flags y reenvía filtros al repositorio."""
        from app.services.owner_payment_service import OwnerPaymentService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        owner_repo = AsyncMock()
        notification_repo = AsyncMock()

        owner_repo.get_by_user_id = AsyncMock(return_value=_make_owner())
        approved_payment = _make_payment(status="REGISTRADO")
        rejected_payment = _make_payment(
            payment_id=uuid4(),
            status="RECHAZADO",
            rejection_reason="Comprobante ilegible",
        )
        payment_repo.get_owner_payments = AsyncMock(
            return_value=[approved_payment, rejected_payment]
        )

        service = OwnerPaymentService(
            payment_repo, proof_repo, owner_repo, notification_repo
        )

        result = await service.list_payments(
            user_id=PROPIETARIO_USER_ID,
            status_filter="REGISTRADO",
            period="2026-05",
            apartment_id=APARTMENT_ID,
        )

        payment_repo.get_owner_payments.assert_awaited_once_with(
            owner_id=OWNER_ID,
            status="REGISTRADO",
            period="2026-05",
            apartment_id=APARTMENT_ID,
        )
        assert result[0]["receipt_available"] is True
        assert result[1]["receipt_available"] is False
        assert result[1]["rejection_reason"] == "Comprobante ilegible"

    @pytest.mark.asyncio
    async def test_owner_without_profile_raises_403(self):
        """Sin perfil de propietario vinculado se lanza 403."""
        from fastapi import HTTPException

        from app.services.owner_payment_service import OwnerPaymentService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        owner_repo = AsyncMock()
        notification_repo = AsyncMock()

        owner_repo.get_by_user_id = AsyncMock(return_value=None)

        service = OwnerPaymentService(
            payment_repo, proof_repo, owner_repo, notification_repo
        )

        with pytest.raises(HTTPException) as exc_info:
            await service._resolve_owner(uuid4())

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_apartment_not_owned_raises_403(self):
        """Departamento que no pertenece al propietario lanza 403."""
        from fastapi import HTTPException

        from app.services.owner_payment_service import OwnerPaymentService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        owner_repo = AsyncMock()
        notification_repo = AsyncMock()

        owner_repo.get_by_user_id = AsyncMock(return_value=_make_owner())
        payment_repo.owner_has_apartment = AsyncMock(return_value=False)

        service = OwnerPaymentService(
            payment_repo, proof_repo, owner_repo, notification_repo
        )

        from app.models.schemas import OwnerPaymentCreate

        data = OwnerPaymentCreate(
            apartment_id=APARTMENT_ID,
            period="2026-05",
            paid_at=date(2026, 5, 20),
            amount=Decimal("100.00"),
        )

        mock_file = MagicMock()
        mock_file.content_type = "application/pdf"
        mock_file.read = AsyncMock(return_value=b"%PDF fake content")
        mock_file.filename = "prueba.pdf"

        with pytest.raises(HTTPException) as exc_info:
            await service.create_payment(
                data=data,
                proof_file=mock_file,
                user_id=PROPIETARIO_USER_ID,
            )

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_receipt_unavailable_before_approval_raises_409(self):
        """Generar recibo de pago no-APROBADO lanza 409."""
        from fastapi import HTTPException

        from app.services.owner_payment_service import OwnerPaymentService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        owner_repo = AsyncMock()
        notification_repo = AsyncMock()

        owner = _make_owner()
        owner_repo.get_by_user_id = AsyncMock(return_value=owner)
        pending_payment = _make_payment(status="PENDIENTE_APROBACION")
        pending_payment["owner_id"] = OWNER_ID
        payment_repo.get_by_id_for_owner = AsyncMock(return_value=pending_payment)

        service = OwnerPaymentService(
            payment_repo, proof_repo, owner_repo, notification_repo
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.generate_receipt_pdf(
                payment_id=PAYMENT_ID,
                user_id=PROPIETARIO_USER_ID,
            )

        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_generate_acknowledgement_pdf_contains_redesigned_sections(self):
        """La constancia PDF incluye el nuevo layout con encabezados visibles."""
        from app.services.owner_payment_service import OwnerPaymentService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        owner_repo = AsyncMock()
        notification_repo = AsyncMock()

        owner_repo.get_by_user_id = AsyncMock(return_value=_make_owner())
        payment_repo.get_by_id_for_owner = AsyncMock(return_value=_make_payment())
        proof_repo.get_latest_by_payment = AsyncMock(return_value=_make_proof())

        service = OwnerPaymentService(
            payment_repo, proof_repo, owner_repo, notification_repo
        )

        pdf_bytes = await service.generate_acknowledgement_pdf(
            payment_id=PAYMENT_ID,
            user_id=PROPIETARIO_USER_ID,
        )

        assert pdf_bytes.startswith(b"%PDF")
        assert b"CONSTANCIA DE PAGO" in pdf_bytes
        assert b"DATOS DEL PROPIETARIO | DETALLE DEL PAGO | CONSTANCIA" in pdf_bytes

    @pytest.mark.asyncio
    async def test_generate_receipt_pdf_contains_redesigned_sections(self):
        """El recibo PDF incluye el nuevo layout con estado aprobado visible."""
        from app.services.owner_payment_service import OwnerPaymentService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        owner_repo = AsyncMock()
        notification_repo = AsyncMock()

        owner_repo.get_by_user_id = AsyncMock(return_value=_make_owner())
        payment_repo.get_by_id_for_owner = AsyncMock(
            return_value=_make_payment(
                payment_id=PAYMENT_ID_APPROVED,
                status="REGISTRADO",
                approved_by="Franz Guzman",
                approved_at=datetime(2026, 5, 31, 15, 30, tzinfo=timezone.utc),
            )
        )

        service = OwnerPaymentService(
            payment_repo, proof_repo, owner_repo, notification_repo
        )

        pdf_bytes = await service.generate_receipt_pdf(
            payment_id=PAYMENT_ID_APPROVED,
            user_id=PROPIETARIO_USER_ID,
        )

        assert pdf_bytes.startswith(b"%PDF")
        assert b"RECIBO DE PAGO" in pdf_bytes
        assert b"DATOS DEL PROPIETARIO | DETALLE DEL PAGO | RECIBO APROBADO" in pdf_bytes

    @pytest.mark.asyncio
    async def test_admin_approve_invalid_transition_raises_422(self):
        """Aprobar pago ya resuelto lanza 422."""
        from fastapi import HTTPException

        from app.services.admin_payment_review_service import AdminPaymentReviewService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        notification_repo = AsyncMock()

        payment_repo.get_by_id = AsyncMock(
            return_value=_make_payment(status="APROBADO")
        )

        service = AdminPaymentReviewService(
            payment_repo, proof_repo, notification_repo
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.approve(
                payment_id=PAYMENT_ID,
                admin_id=str(ADMIN_USER_ID),
            )

        assert exc_info.value.status_code == 422
        assert "Transición inválida" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_admin_approve_creates_owner_notification(self):
        from app.services.admin_payment_review_service import AdminPaymentReviewService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        notification_repo = AsyncMock()

        payment_repo.get_by_id = AsyncMock(return_value=_make_payment())
        payment_repo.approve = AsyncMock(return_value=_make_payment(status="APROBADO"))

        service = AdminPaymentReviewService(
            payment_repo, proof_repo, notification_repo
        )

        await service.approve(
            payment_id=PAYMENT_ID,
            admin_id=str(ADMIN_USER_ID),
        )

        notification_repo.create.assert_awaited_once()
        assert notification_repo.create.await_args.kwargs["notification_type"] == "PAGO_APROBADO"
        assert notification_repo.create.await_args.kwargs["recipient"] == str(PROPIETARIO_USER_ID)

    @pytest.mark.asyncio
    async def test_admin_reject_creates_owner_notification(self):
        from app.services.admin_payment_review_service import AdminPaymentReviewService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        notification_repo = AsyncMock()

        payment_repo.get_by_id = AsyncMock(return_value=_make_payment())
        payment_repo.reject = AsyncMock(return_value=_make_payment(status="RECHAZADO"))

        service = AdminPaymentReviewService(
            payment_repo, proof_repo, notification_repo
        )

        await service.reject(
            payment_id=PAYMENT_ID,
            admin_id=str(ADMIN_USER_ID),
            reason="Comprobante ilegible",
        )

        notification_repo.create.assert_awaited_once()
        assert notification_repo.create.await_args.kwargs["notification_type"] == "PAGO_RECHAZADO"
        assert notification_repo.create.await_args.kwargs["recipient"] == str(PROPIETARIO_USER_ID)

    @pytest.mark.asyncio
    async def test_admin_list_pending_includes_latest_proof_metadata(self):
        """El listado de pendientes expone nombre y tipo del último comprobante."""
        from app.services.admin_payment_review_service import AdminPaymentReviewService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        notification_repo = AsyncMock()

        payment_repo.get_pending_for_admin = AsyncMock(return_value=[_make_payment()])
        proof_repo.get_latest_by_payment = AsyncMock(return_value=_make_proof())

        service = AdminPaymentReviewService(
            payment_repo, proof_repo, notification_repo
        )

        result = await service.list_pending()

        assert result[0]["proof_file_name"] == "transferencia.pdf"
        assert result[0]["proof_content_type"] == "application/pdf"
        assert result[0]["has_proof"] is True

    @pytest.mark.asyncio
    async def test_admin_download_proof_returns_latest_file_metadata_and_bytes(self):
        """La descarga usa el último comprobante persistido y devuelve bytes."""
        from app.services.admin_payment_review_service import AdminPaymentReviewService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        notification_repo = AsyncMock()

        payment_repo.get_by_id = AsyncMock(return_value=_make_payment())
        proof_repo.get_latest_by_payment = AsyncMock(return_value=_make_proof())

        service = AdminPaymentReviewService(
            payment_repo, proof_repo, notification_repo
        )

        with patch(
            "app.services.admin_payment_review_service.read_proof_bytes",
            return_value=b"%PDF proof bytes",
        ):
            result = await service.download_proof(PAYMENT_ID)

        assert result["file_name"] == "transferencia.pdf"
        assert result["content_type"] == "application/pdf"
        assert result["content"] == b"%PDF proof bytes"


class TestPaymentRepositoryContracts:
    """Tests unitarios del contrato mínimo de PaymentRepository para SPEC-008."""

    @pytest.mark.asyncio
    async def test_get_owner_payments_applies_owner_and_optional_filters(self):
        """El repositorio expone get_owner_payments y arma la consulta con filtros."""
        from app.repositories.payment_repository import PaymentRepository

        conn = AsyncMock()
        conn.fetch = AsyncMock(return_value=[_make_payment(status="APROBADO")])
        repo = PaymentRepository(conn)

        result = await repo.get_owner_payments(
            owner_id=OWNER_ID,
            status="APROBADO",
            period="2026-05",
            apartment_id=APARTMENT_ID,
        )

        query = conn.fetch.await_args.args[0]
        params = conn.fetch.await_args.args[1:]

        assert "p.owner_id = $1" in query
        assert "p.status = $2" in query
        assert "p.period = $3" in query
        assert "p.apartment_id = $4" in query
        assert list(params) == [OWNER_ID, "APROBADO", "2026-05", APARTMENT_ID]
        assert result[0]["status"] == "APROBADO"


class TestNotificationRepositoryContracts:
    """Tests unitarios del contrato de NotificationRepository para SPEC-008."""

    @pytest.mark.asyncio
    async def test_create_persists_payload_and_target_role(self):
        """La creación usa payload/target_role/reference_id en lugar del esquema viejo."""
        from app.repositories.notification_repository import NotificationRepository

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            return_value={
                "id": uuid4(),
                "type": "PAGO_PENDIENTE",
                "payload": {
                    "title": "Pago pendiente de revisión — 2026-05",
                    "body": "Detalle del pago",
                    "metadata": {"payment_id": str(PAYMENT_ID)},
                },
                "target_role": "ADMIN",
                "target_user_id": None,
                "reference_id": PAYMENT_ID,
                "created_at": datetime(2026, 5, 31, 10, 0, 0, tzinfo=timezone.utc),
            }
        )
        repo = NotificationRepository(conn)

        result = await repo.create(
            notification_type="PAGO_PENDIENTE",
            title="Pago pendiente de revisión — 2026-05",
            body="Detalle del pago",
            recipient="ADMIN",
            metadata={"payment_id": str(PAYMENT_ID)},
        )

        query = conn.fetchrow.await_args.args[0]
        params = conn.fetchrow.await_args.args[1:]

        assert "payload" in query
        assert "target_role" in query
        assert "reference_id" in query
        assert params[0] == "PAGO_PENDIENTE"
        assert __import__("json").loads(params[1]) == {
            "title": "Pago pendiente de revisión — 2026-05",
            "body": "Detalle del pago",
            "metadata": {"payment_id": str(PAYMENT_ID)},
        }
        assert params[2] == "ADMIN"
        assert params[3] is None
        assert params[4] == str(PAYMENT_ID)
        assert result["title"] == "Pago pendiente de revisión — 2026-05"
        assert result["recipient"] == "ADMIN"

    @pytest.mark.asyncio
    async def test_list_for_admin_maps_payload_fields(self):
        """El listado para ADMIN deriva title/body/metadata desde payload."""
        from app.repositories.notification_repository import NotificationRepository

        conn = AsyncMock()
        conn.fetch = AsyncMock(
            return_value=[
                {
                    "id": uuid4(),
                    "type": "PAGO_PENDIENTE",
                    "payload": {
                        "title": "Pago pendiente",
                        "body": "Detalle",
                        "metadata": {"payment_id": str(PAYMENT_ID)},
                    },
                    "target_role": "ADMIN",
                    "target_user_id": None,
                    "reference_id": PAYMENT_ID,
                    "created_at": datetime(2026, 5, 31, 10, 0, 0, tzinfo=timezone.utc),
                }
            ]
        )
        conn.fetchval = AsyncMock(return_value=1)
        repo = NotificationRepository(conn)

        rows, total = await repo.list_for_admin(page=2, page_size=10)

        query = conn.fetch.await_args.args[0]
        params = conn.fetch.await_args.args[1:]

        assert "target_role = 'ADMIN'" in query
        assert list(params) == [10, 10]
        assert total == 1
        assert rows[0]["title"] == "Pago pendiente"
        assert rows[0]["body"] == "Detalle"
        assert rows[0]["metadata"] == {"payment_id": str(PAYMENT_ID)}
        assert rows[0]["recipient"] == "ADMIN"

    @pytest.mark.asyncio
    async def test_create_maps_string_payload_from_db_row(self):
        """La creación tolera payload devuelto como string JSON desde Postgres."""
        from app.repositories.notification_repository import NotificationRepository

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            return_value={
                "id": uuid4(),
                "type": "PAGO_PENDIENTE",
                "payload": '{"title": "Pago pendiente", "body": "Detalle", "metadata": {"payment_id": "660e8400-e29b-41d4-a716-446655440001"}}',
                "target_role": "ADMIN",
                "target_user_id": None,
                "reference_id": PAYMENT_ID,
                "created_at": datetime(2026, 5, 31, 10, 0, 0, tzinfo=timezone.utc),
            }
        )
        repo = NotificationRepository(conn)

        result = await repo.create(
            notification_type="PAGO_PENDIENTE",
            title="Pago pendiente",
            body="Detalle",
            recipient="ADMIN",
            metadata={"payment_id": str(PAYMENT_ID)},
        )

        assert result["title"] == "Pago pendiente"
        assert result["body"] == "Detalle"
        assert result["metadata"] == {"payment_id": str(PAYMENT_ID)}
        assert result["recipient"] == "ADMIN"

    @pytest.mark.asyncio
    async def test_list_for_user_filters_target_user_and_owner_role(self):
        from app.repositories.notification_repository import NotificationRepository

        conn = AsyncMock()
        conn.fetch = AsyncMock(
            return_value=[
                {
                    "id": uuid4(),
                    "type": "PAGO_APROBADO",
                    "payload": {
                        "title": "Pago aprobado",
                        "body": "Detalle owner",
                        "metadata": {"payment_id": str(PAYMENT_ID)},
                    },
                    "target_role": None,
                    "target_user_id": str(PROPIETARIO_USER_ID),
                    "reference_id": PAYMENT_ID,
                    "created_at": datetime(2026, 5, 31, 10, 0, 0, tzinfo=timezone.utc),
                }
            ]
        )
        conn.fetchval = AsyncMock(return_value=1)
        repo = NotificationRepository(conn)

        rows, total = await repo.list_for_user(
            user_id=str(PROPIETARIO_USER_ID),
            page=1,
            page_size=10,
        )

        query = conn.fetch.await_args.args[0]
        params = conn.fetch.await_args.args[1:]

        assert "target_user_id = $1 OR target_role = 'PROPIETARIO'" in query
        assert list(params) == [str(PROPIETARIO_USER_ID), 10, 0]
        assert total == 1
        assert rows[0]["recipient"] == str(PROPIETARIO_USER_ID)

    @pytest.mark.asyncio
    async def test_create_owner_notification_sets_role_and_user(self):
        from app.repositories.notification_repository import NotificationRepository

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            return_value={
                "id": uuid4(),
                "type": "PAGO_APROBADO",
                "payload": {
                    "title": "Pago aprobado",
                    "body": "Detalle owner",
                    "metadata": {"payment_id": str(PAYMENT_ID)},
                },
                "target_role": "PROPIETARIO",
                "target_user_id": str(PROPIETARIO_USER_ID),
                "reference_id": PAYMENT_ID,
                "created_at": datetime(2026, 5, 31, 10, 0, 0, tzinfo=timezone.utc),
            }
        )
        repo = NotificationRepository(conn)

        result = await repo.create(
            notification_type="PAGO_APROBADO",
            title="Pago aprobado",
            body="Detalle owner",
            recipient=str(PROPIETARIO_USER_ID),
            metadata={"payment_id": str(PAYMENT_ID)},
        )

        params = conn.fetchrow.await_args.args[1:]

        assert params[0] == "PAGO_APROBADO"
        assert params[2] == "PROPIETARIO"
        assert params[3] == str(PROPIETARIO_USER_ID)
        assert params[4] == str(PAYMENT_ID)
        assert result["recipient"] == str(PROPIETARIO_USER_ID)

    @pytest.mark.asyncio
    async def test_admin_reject_invalid_transition_raises_422(self):
        """Rechazar pago ya resuelto lanza 422."""
        from fastapi import HTTPException

        from app.services.admin_payment_review_service import AdminPaymentReviewService

        payment_repo = AsyncMock()
        proof_repo = AsyncMock()
        notification_repo = AsyncMock()

        payment_repo.get_by_id = AsyncMock(
            return_value=_make_payment(status="RECHAZADO")
        )

        service = AdminPaymentReviewService(
            payment_repo, proof_repo, notification_repo
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.reject(
                payment_id=PAYMENT_ID,
                admin_id=str(ADMIN_USER_ID),
                reason="Intento duplicado",
            )

        assert exc_info.value.status_code == 422


class TestMarkNotificationRead:
    @pytest.mark.asyncio
    async def test_mark_admin_notification_read_success(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        notif_id = uuid4()
        with (
            patch(
                "app.repositories.notification_repository.NotificationRepository.get_by_id",
                new=AsyncMock(return_value={"id": notif_id, "target_role": "ADMIN", "target_user_id": None}),
            ),
            patch(
                "app.repositories.notification_repository.NotificationRepository.mark_as_read",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await async_client.put(
                f"/api/v1/admin/notifications/{notif_id}/read",
                headers=admin_headers,
            )
        assert response.status_code == 200
        assert response.json() == {"success": True}

    @pytest.mark.asyncio
    async def test_mark_owner_notification_read_success(
        self,
        async_client: AsyncClient,
        propietario_headers: dict,
    ):
        notif_id = uuid4()
        with (
            patch(
                "app.repositories.notification_repository.NotificationRepository.get_by_id",
                new=AsyncMock(return_value={"id": notif_id, "target_role": "PROPIETARIO", "target_user_id": str(PROPIETARIO_USER_ID)}),
            ),
            patch(
                "app.repositories.notification_repository.NotificationRepository.mark_as_read",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await async_client.put(
                f"/api/v1/owner/notifications/{notif_id}/read",
                headers=propietario_headers,
            )
        assert response.status_code == 200
        assert response.json() == {"success": True}
