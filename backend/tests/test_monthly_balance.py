from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.services.report_service import ReportService


def _monthly_balance_payload(period: str = "2026-05") -> dict:
    return {
        "period": period,
        "income_total": 2500,
        "expense_total": 1750,
        "net_balance": 750,
        "income_breakdown": [{"label": "transferencia", "amount": 2300}],
        "expense_breakdown": [{"label": "Mantenimiento", "amount": 900}],
        "previous_period_variation": {
            "income_pct": 4.2,
            "expense_pct": -1.5,
            "net_balance_pct": 12.1,
        },
    }


@pytest.mark.asyncio
async def test_monthly_balance_admin_success(
    async_client: AsyncClient,
    admin_headers: dict,
    monkeypatch,
):
    mocked_summary = AsyncMock(return_value=_monthly_balance_payload())
    monkeypatch.setattr(ReportService, "monthly_balance_summary", mocked_summary)

    response = await async_client.get(
        "/api/v1/reports/monthly-balance",
        headers=admin_headers,
        params={"period": "2026-05"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["period"] == "2026-05"
    assert data["income_total"] == "2500"
    assert data["expense_total"] == "1750"
    assert data["net_balance"] == "750"
    mocked_summary.assert_awaited_once_with("2026-05")


@pytest.mark.asyncio
async def test_monthly_balance_owner_success(
    async_client: AsyncClient,
    propietario_headers: dict,
    monkeypatch,
):
    mocked_summary = AsyncMock(return_value=_monthly_balance_payload())
    monkeypatch.setattr(ReportService, "monthly_balance_summary", mocked_summary)

    response = await async_client.get(
        "/api/v1/owner/monthly-balance",
        headers=propietario_headers,
        params={"period": "2026-05"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["period"] == "2026-05"
    assert data["income_breakdown"][0]["label"] == "transferencia"
    mocked_summary.assert_awaited_once_with("2026-05")


@pytest.mark.asyncio
async def test_monthly_balance_invalid_period_returns_400(
    async_client: AsyncClient,
    admin_headers: dict,
    monkeypatch,
):
    mocked_summary = AsyncMock(return_value=_monthly_balance_payload())
    monkeypatch.setattr(ReportService, "monthly_balance_summary", mocked_summary)

    response = await async_client.get(
        "/api/v1/reports/monthly-balance",
        headers=admin_headers,
        params={"period": "2026/05"},
    )

    assert response.status_code == 400
    assert "YYYY-MM" in response.json()["detail"]
    mocked_summary.assert_not_awaited()


@pytest.mark.asyncio
async def test_monthly_balance_owner_forbidden_on_admin_endpoint(
    async_client: AsyncClient,
    propietario_headers: dict,
):
    response = await async_client.get(
        "/api/v1/reports/monthly-balance",
        headers=propietario_headers,
        params={"period": "2026-05"},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_monthly_balance_excludes_unapproved_income():
    payment_repo = MagicMock()
    expense_repo = MagicMock()
    payment_repo.get_all = AsyncMock(
        side_effect=[
            [
                {"id": "p-1", "amount": Decimal("1000.00"), "method": "transferencia", "status": "REGISTRADO"},
                {"id": "p-2", "amount": Decimal("999.00"), "method": "efectivo", "status": "RECHAZADO"},
            ],
            [
                {"id": "p-3", "amount": Decimal("500.00"), "method": "cheque", "status": "APROBADO"},
            ],
            [],
            [],
        ]
    )
    expense_repo.get_by_month = AsyncMock(
        side_effect=[
            {"data": []},
            {"data": []},
        ]
    )
    service = ReportService(MagicMock(), payment_repo, expense_repo)

    result = await service.monthly_balance_summary("2026-05")

    assert result["income_total"] == Decimal("1500.00")
    assert result["net_balance"] == Decimal("1500.00")


@pytest.mark.asyncio
async def test_monthly_balance_excludes_annulled_expenses():
    payment_repo = MagicMock()
    expense_repo = MagicMock()
    payment_repo.get_all = AsyncMock(side_effect=[[], [], [], []])
    expense_repo.get_by_month = AsyncMock(
        side_effect=[
            {
                "data": [
                    {"amount": Decimal("120.00"), "category": "Mantenimiento", "status": "REGISTRADO"},
                    {"amount": Decimal("80.00"), "category": "Servicios", "status": "ANULADA"},
                ]
            },
            {"data": []},
        ]
    )
    service = ReportService(MagicMock(), payment_repo, expense_repo)

    result = await service.monthly_balance_summary("2026-05")

    assert result["expense_total"] == Decimal("120.00")
    assert result["net_balance"] == Decimal("-120.00")
    assert result["expense_breakdown"] == [{"label": "Mantenimiento", "amount": Decimal("120.00")}]


@pytest.mark.asyncio
async def test_monthly_balance_includes_manual_incomes():
    payment_repo = MagicMock()
    expense_repo = MagicMock()
    income_repo = MagicMock()
    payment_repo.get_all = AsyncMock(
        side_effect=[
            [{"id": "p-1", "amount": Decimal("1000.00"), "method": "transferencia", "status": "REGISTRADO"}],
            [],
            [],
            [],
        ]
    )
    income_repo.get_all = AsyncMock(
        side_effect=[
            [{"id": "i-1", "amount": Decimal("250.00"), "category": "Arriendos", "status": "REGISTRADO"}],
            [],
        ]
    )
    expense_repo.get_by_month = AsyncMock(side_effect=[{"data": []}, {"data": []}])
    service = ReportService(MagicMock(), payment_repo, expense_repo, income_repo)

    result = await service.monthly_balance_summary("2026-05")

    assert result["income_total"] == Decimal("1250.00")
    assert result["income_breakdown"] == [
        {"label": "Alícuotas y pagos", "amount": Decimal("1000.00")},
        {"label": "Arriendos", "amount": Decimal("250.00")},
    ]


@pytest.mark.asyncio
async def test_balance_pdf_excludes_zero_expenses():
    payment_repo = MagicMock()
    expense_repo = MagicMock()
    income_repo = MagicMock()
    payment_repo._conn = MagicMock()
    service = ReportService(MagicMock(), payment_repo, expense_repo, income_repo)
    
    service._income_entries = AsyncMock(return_value=[])
    service._expenses = AsyncMock(side_effect=[
        # current_expenses
        [
            {"amount": Decimal("200.00"), "category": "Mantenimiento"},
            {"amount": Decimal("0.00"), "category": "Servicios"},
        ],
        # compare_expenses
        []
    ])
    service._fees_report_rows = AsyncMock(return_value=[])
    
    pdf_bytes = await service.balance_pdf(period="2026-07")
    
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")
