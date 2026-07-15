"""
Tests para validar T1-01: Bug fixes de autenticación.
Valida que user['user_id'] funciona correctamente en payments, fines, expenses.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException


# ─── FIXTURES ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_user():
    """Usuario admin autenticado con user_id en lugar de uid."""
    return {
        "user_id": UUID("550e8400-e29b-41d4-a716-446655440011"),
        "email": "admin@edificios.com",
        "role": "ADMIN",
        "status": "ACTIVO",
    }


@pytest.fixture
def apartment_id():
    return UUID("550e8400-e29b-41d4-a716-446655440101")


@pytest.fixture
def owner_id():
    return UUID("550e8400-e29b-41d4-a716-446655440201")


# ─── T1-01: PAYMENTS - user[user_id] ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_payment_with_user_id(mock_user, apartment_id, owner_id, mock_db):
    """
    Valida que POST /api/v1/payments acepta user['user_id'].
    BEFORE: KeyError 'uid'
    AFTER: Funciona correctamente.
    """
    from app.routes.payments import create_payment
    from app.models.schemas import PaymentCreate
    
    payment_data = PaymentCreate(
        apartment_id=apartment_id,
        owner_id=owner_id,
        period="2026-05",
        paid_at=date(2026, 5, 21),
        amount=Decimal("1500.00"),
        method="transfer",
        reference="REF001",
    )
    
    # Mock del servicio
    with patch('app.routes.payments.PaymentService') as MockService:
        mock_service = AsyncMock()
        mock_service.create = AsyncMock(return_value={
            "id": uuid4(),
            "apartment_id": apartment_id,
            "owner_id": owner_id,
            "period": "2026-05",
            "amount": Decimal("1500.00"),
            "status": "REGISTRADO",
            "created_by": mock_user["user_id"],
        })
        MockService.return_value = mock_service
        
        result = await create_payment(
            body=payment_data,
            user=mock_user,
            db=mock_db,
        )
        
        # Validar que se pasó user_id (no uid)
        mock_service.create.assert_called_once()
        call_args = mock_service.create.call_args
        assert call_args[1]["created_by"] == mock_user["user_id"]
        assert result["status"] == "REGISTRADO"


@pytest.mark.asyncio
async def test_delete_payment_only_allows_annulled_status():
    """Valida que la eliminación física de pagos solo aplique sobre pagos anulados."""
    from app.services.payment_service import PaymentService

    payment_id = uuid4()
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value={"id": payment_id, "status": "REGISTRADO"})
    repo.delete = AsyncMock(return_value=True)
    service = PaymentService(repo)

    with pytest.raises(HTTPException) as exc:
        await service.delete(payment_id)

    assert exc.value.status_code == 422
    assert exc.value.detail == "Solo se pueden eliminar pagos anulados"
    repo.delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_payment_removes_annulled_payment():
    """Valida que un pago ya anulado sí pueda eliminarse."""
    from app.services.payment_service import PaymentService

    payment_id = uuid4()
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value={"id": payment_id, "status": "ANULADO"})
    repo.delete = AsyncMock(return_value=True)
    service = PaymentService(repo)

    await service.delete(payment_id)

    repo.delete.assert_awaited_once_with(payment_id)


# ─── T1-01: FINES - user[user_id] ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_fine_with_user_id(mock_user, apartment_id, owner_id, mock_db):
    """
    Valida que POST /api/v1/fines acepta user['user_id'].
    BEFORE: KeyError 'uid'
    AFTER: Funciona correctamente.
    """
    from app.routes.fines import create_fine
    from app.models.schemas import FineCreate
    
    fine_data = FineCreate(
        apartment_id=apartment_id,
        owner_id=owner_id,
        period="2026-05",
        issued_at=date(2026, 5, 21),
        reason="Atraso en pago",
        amount=Decimal("500.00"),
    )
    
    with patch('app.routes.fines.FineService') as MockService:
        mock_service = AsyncMock()
        mock_service.create = AsyncMock(return_value={
            "id": uuid4(),
            "apartment_id": apartment_id,
            "owner_id": owner_id,
            "period": "2026-05",
            "amount": Decimal("500.00"),
            "status": "REGISTRADO",
            "created_by": mock_user["user_id"],
        })
        MockService.return_value = mock_service
        
        result = await create_fine(
            body=fine_data,
            user=mock_user,
            db=mock_db,
        )
        
        # Validar que se pasó user_id (no uid)
        mock_service.create.assert_called_once()
        call_args = mock_service.create.call_args
        assert call_args[1]["created_by"] == mock_user["user_id"]
        assert result["status"] == "REGISTRADO"


# ─── T1-01: EXPENSES - user[user_id] ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_expense_with_user_id(mock_user, mock_db):
    """
    Valida que POST /api/v1/expenses acepta user['user_id'].
    BEFORE: KeyError 'uid'
    AFTER: Funciona correctamente.
    """
    from app.routes.expenses import create_expense
    from app.models.schemas import ExpenseCreate
    
    expense_data = ExpenseCreate(
        date=date(2026, 5, 21),
        provider="Proveedora XYZ",
        category="Servicios",
        concept="Reparación de tuberías",
        amount=Decimal("800.00"),
    )
    
    with patch('app.routes.expenses.ExpenseService') as MockService:
        mock_service = AsyncMock()
        mock_service.create = AsyncMock(return_value={
            "id": uuid4(),
            "date": date(2026, 5, 21),
            "amount": Decimal("800.00"),
            "status": "REGISTRADO",
            "created_by": mock_user["user_id"],
        })
        MockService.return_value = mock_service
        
        result = await create_expense(
            date="2026-05-21",
            concept="Reparación de tuberías",
            amount="800.00",
            provider="Proveedora XYZ",
            category="Servicios",
            receipt_file=None,
            user=mock_user,
            db=mock_db,
        )
        
        # Validar que se pasó user_id (no uid)
        mock_service.create.assert_called_once()
        call_args = mock_service.create.call_args
        assert call_args[1]["created_by"] == mock_user["user_id"]
        assert result["status"] == "REGISTRADO"


# ─── T1-03: APARTMENTS - Incluir owner info ────────────────────────────────────

@pytest.mark.asyncio
async def test_get_apartments_with_owner_info(mock_user, mock_db):
    """
    Valida que GET /api/v1/apartments incluye owner_id, owner_name, owner_email.
    """
    from app.routes.apartments import list_apartments
    
    with patch('app.routes.apartments.ApartmentService') as MockService:
        mock_service = AsyncMock()
        mock_service.get_all = AsyncMock(return_value=[
            {
                "id": UUID("550e8400-e29b-41d4-a716-446655440101"),
                "code": "101",
                "floor": 1,
                "tower": "A",
                "status": "ACTIVO",
                "owner_id": UUID("550e8400-e29b-41d4-a716-446655440201"),
                "owner_name": "Juan Pérez",
                "owner_email": "juan@example.com",
            },
            {
                "id": UUID("550e8400-e29b-41d4-a716-446655440102"),
                "code": "102",
                "floor": 1,
                "tower": "A",
                "status": "ACTIVO",
                "owner_id": None,
                "owner_name": None,
                "owner_email": None,
            },
        ])
        MockService.return_value = mock_service
        
        result = await list_apartments(user=mock_user, db=mock_db)
        
        # Validar estructura de respuesta
        assert len(result) == 2
        assert result[0]["owner_id"] is not None
        assert result[0]["owner_name"] == "Juan Pérez"
        assert result[0]["owner_email"] == "juan@example.com"
        assert result[1]["owner_id"] is None
        assert result[1]["owner_name"] is None


# ─── T1-02: BUILDINGS - PUT endpoint ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_building(mock_user, mock_db):
    """
    Valida que PUT /api/v1/buildings/{id} actualiza correctamente.
    """
    from app.routes.buildings import update_building
    from app.models.schemas import BuildingUpdate
    
    building_id = UUID("550e8400-e29b-41d4-a716-446655440301")
    
    update_data = BuildingUpdate(
        name="Edificio Actualizado",
        address="Nueva dirección 123",
        phone="555-1234",
        email="edificio@example.com",
    )
    
    with patch('app.routes.buildings.BuildingService') as MockService:
        mock_service = AsyncMock()
        mock_service.update = AsyncMock(return_value={
            "id": building_id,
            "name": "Edificio Actualizado",
            "address": "Nueva dirección 123",
            "phone": "555-1234",
            "email": "edificio@example.com",
        })
        MockService.return_value = mock_service
        
        result = await update_building(
            building_id=building_id,
            body=update_data,
            _user=mock_user,
            db=mock_db,
        )
        
        # Validar respuesta
        assert result["name"] == "Edificio Actualizado"
        assert result["address"] == "Nueva dirección 123"
        mock_service.update.assert_called_once_with(building_id, update_data)


# ─── T1-04 & T1-05: REPORTS - PDF/Excel ───────────────────────────────────────

@pytest.mark.asyncio
async def test_report_income_pdf(mock_user, mock_db):
    """
    Valida que GET /api/v1/reports/income?format=pdf genera PDF.
    """
    from app.routes.reports import report_income
    
    with patch('app.routes.reports.ReportService') as MockService:
        mock_service = AsyncMock()
        pdf_content = b"%PDF-1.4 mock pdf content"
        mock_service.income_pdf = AsyncMock(return_value=pdf_content)
        MockService.return_value = mock_service
        
        result = await report_income(
            period="2026-05",
            format="pdf",
            _user=mock_user,
            db=mock_db,
        )
        
        # Validar que es Response con PDF
        assert result.media_type == "application/pdf"
        assert b"mock pdf content" in result.body
        mock_service.income_pdf.assert_called_once_with("2026-05", None, None)


@pytest.mark.asyncio
async def test_report_income_excel(mock_user, mock_db):
    """
    Valida que GET /api/v1/reports/income?format=excel genera Excel.
    """
    from app.routes.reports import report_income
    
    with patch('app.routes.reports.ReportService') as MockService:
        mock_service = AsyncMock()
        excel_content = b"PK\x03\x04 mock excel content"
        mock_service.income_excel = AsyncMock(return_value=excel_content)
        MockService.return_value = mock_service
        
        result = await report_income(
            period="2026-05",
            format="excel",
            _user=mock_user,
            db=mock_db,
        )
        
        # Validar que es Response con Excel
        assert "spreadsheetml.sheet" in result.media_type
        mock_service.income_excel.assert_called_once_with("2026-05", None, None)


@pytest.mark.asyncio
async def test_report_invalid_format(mock_user, mock_db):
    """
    Valida que formato inválido retorna error 400.
    """
    from app.routes.reports import report_income
    
    with pytest.raises(HTTPException) as exc_info:
        await report_income(
            period="2026-05",
            format="invalid",
            _user=mock_user,
            db=mock_db,
        )
    
    assert exc_info.value.status_code == 400
    assert "csv, pdf o excel" in exc_info.value.detail


@pytest.mark.asyncio
async def test_delete_income_service():
    """Valida que IncomeService.delete elimina si está ANULADO y lanza error si no."""
    from app.services.income_service import IncomeService
    from app.repositories.income_repository import IncomeRepository
    from uuid import uuid4
    from unittest.mock import MagicMock, AsyncMock
    
    mock_repo = MagicMock(spec=IncomeRepository)
    mock_repo.get_by_id = AsyncMock(return_value={"status": "REGISTRADO"})
    
    service = IncomeService(mock_repo)
    
    # 1. Intentar eliminar REGISTRADO -> debe dar 422
    with pytest.raises(HTTPException) as exc_info:
        await service.delete(uuid4())
    assert exc_info.value.status_code == 422
    assert "Solo se pueden eliminar ingresos anulados" in exc_info.value.detail
    
    # 2. Intentar eliminar ANULADO -> debe proceder
    mock_repo.get_by_id = AsyncMock(return_value={"status": "ANULADO"})
    mock_repo.delete = AsyncMock(return_value=True)
    await service.delete(uuid4())
    mock_repo.delete.assert_called_once()
