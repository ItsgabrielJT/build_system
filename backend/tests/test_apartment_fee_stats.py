"""Tests para endpoints de estadísticas de cuotas de apartamentos."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from httpx import AsyncClient

from app.repositories.apartment_fee_repository import ApartmentFeeRepository


def _setup_stats_db(
    db_with_users,
    *,
    total_emitido: float,
    total_recaudado: float,
    unidades_deuda_vencida: int,
    prev_emitido: float,
) -> None:
    """Configura respuestas mock para queries del endpoint /apartment-fees/stats."""

    async def fetchrow_side_effect(query: str, *args):
        # Query de autenticación (get_current_user)
        if "FROM users u" in query and "WHERE u.id" in query:
            return {
                "id": args[0],
                "email": "admin@edificios.com",
                "status": "ACTIVO",
            }

        # Query unidades con deuda vencida
        if "COUNT(DISTINCT af.apartment_id)" in query:
            return {"cnt": unidades_deuda_vencida}

        # Query total emitido
        if "SUM(amount)" in query and "FROM apartment_fees" in query:
            period = args[0]
            if period == "2026-04":
                return {"total": prev_emitido}
            return {"total": total_emitido}

        # Query total recaudado
        if (
            "SUM(amount)" in query
            and "FROM payments" in query
            and "status = 'REGISTRADO'" in query
        ):
            return {"total": total_recaudado}

        return None

    db_with_users.fetchrow = AsyncMock(side_effect=fetchrow_side_effect)


def _setup_periods_summary_db(db_with_users, *, total: int, rows: list[dict]) -> None:
    """Configura respuestas mock para queries del endpoint /apartment-fees/periods-summary."""

    async def fetchrow_side_effect(query: str, *args):
        # Query de autenticación (get_current_user)
        if "FROM users u" in query and "WHERE u.id" in query:
            return {
                "id": args[0],
                "email": "admin@edificios.com",
                "status": "ACTIVO",
            }

        # Query de total de períodos
        if "COUNT(DISTINCT period) AS cnt" in query:
            return {"cnt": total}

        return None

    async def fetch_side_effect(query: str, *args):
        if "GROUP BY af.period" in query and "ORDER BY af.period DESC" in query:
            return rows
        return []

    db_with_users.fetchrow = AsyncMock(side_effect=fetchrow_side_effect)
    db_with_users.fetch = AsyncMock(side_effect=fetch_side_effect)


@pytest.mark.asyncio
async def test_fee_stats_returns_200_with_current_period(
    async_client: AsyncClient,
    admin_headers: dict,
    db_with_users,
):
    _setup_stats_db(
        db_with_users,
        total_emitido=1200.0,
        total_recaudado=900.0,
        unidades_deuda_vencida=2,
        prev_emitido=1000.0,
    )

    response = await async_client.get(
        "/api/v1/apartment-fees/stats",
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert "period" in data
    assert "total_emitido" in data
    assert "total_recaudado" in data
    assert "pendiente_cobro" in data
    assert "porcentaje_recaudado" in data
    assert "unidades_deuda_vencida" in data
    assert "tendencia_emitido" in data


@pytest.mark.asyncio
async def test_fee_stats_returns_200_with_explicit_period(
    async_client: AsyncClient,
    admin_headers: dict,
    db_with_users,
):
    _setup_stats_db(
        db_with_users,
        total_emitido=1500.0,
        total_recaudado=1100.0,
        unidades_deuda_vencida=1,
        prev_emitido=1000.0,
    )

    response = await async_client.get(
        "/api/v1/apartment-fees/stats?period=2026-05",
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["period"] == "2026-05"


@pytest.mark.asyncio
async def test_fee_stats_no_fees_returns_zeros(
    async_client: AsyncClient,
    admin_headers: dict,
    db_with_users,
):
    _setup_stats_db(
        db_with_users,
        total_emitido=0.0,
        total_recaudado=0.0,
        unidades_deuda_vencida=0,
        prev_emitido=0.0,
    )

    response = await async_client.get(
        "/api/v1/apartment-fees/stats?period=2026-05",
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_emitido"] == 0
    assert data["porcentaje_recaudado"] == 0


@pytest.mark.asyncio
async def test_fee_stats_invalid_period_returns_422(
    async_client: AsyncClient,
    admin_headers: dict,
):
    response = await async_client.get(
        "/api/v1/apartment-fees/stats?period=invalid",
        headers=admin_headers,
    )

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_fee_stats_requires_auth_401(
    async_client: AsyncClient,
):
    response = await async_client.get("/api/v1/apartment-fees/stats")

    assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_fee_stats_requires_admin_403(
    async_client: AsyncClient,
    propietario_headers: dict,
):
    response = await async_client.get(
        "/api/v1/apartment-fees/stats",
        headers=propietario_headers,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_periods_summary_returns_200(
    async_client: AsyncClient,
    admin_headers: dict,
    db_with_users,
):
    _setup_periods_summary_db(
        db_with_users,
        total=2,
        rows=[
            {
                "period": "2026-05",
                "total_emitido": 1200.0,
                "total_recaudado": 900.0,
            },
            {
                "period": "2026-04",
                "total_emitido": 1000.0,
                "total_recaudado": 1000.0,
            },
        ],
    )

    response = await async_client.get(
        "/api/v1/apartment-fees/periods-summary",
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data


@pytest.mark.asyncio
async def test_periods_summary_default_pagination(
    async_client: AsyncClient,
    admin_headers: dict,
    db_with_users,
):
    _setup_periods_summary_db(
        db_with_users,
        total=1,
        rows=[
            {
                "period": "2026-05",
                "total_emitido": 1200.0,
                "total_recaudado": 900.0,
            }
        ],
    )

    response = await async_client.get(
        "/api/v1/apartment-fees/periods-summary",
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 10


@pytest.mark.asyncio
async def test_get_by_period_carries_previous_debt_and_credit():
    apt_id = UUID("550e8400-e29b-41d4-a716-446655440101")
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[
        {
            "id": UUID("660e8400-e29b-41d4-a716-446655440001"),
            "apartment_id": apt_id,
            "period": "2026-04",
            "amount": Decimal("100.00"),
            "paid_amount": Decimal("0.00"),
            "created_at": None,
        },
        {
            "id": UUID("660e8400-e29b-41d4-a716-446655440002"),
            "apartment_id": apt_id,
            "period": "2026-05",
            "amount": Decimal("100.00"),
            "paid_amount": Decimal("250.00"),
            "created_at": None,
        },
    ])

    rows = await ApartmentFeeRepository(mock_conn).get_by_period("2026-05")

    assert len(rows) == 1
    may = rows[0]
    assert may["prior_debt_amount"] == Decimal("100.00")
    assert may["prior_credit_amount"] == Decimal("0")
    assert may["paid_amount"] == Decimal("250.00")
    assert may["pending_amount"] == Decimal("0")
    assert may["credit_amount"] == Decimal("50.00")
    assert may["is_paid"] is True


@pytest.mark.asyncio
async def test_periods_summary_filter_by_year(
    async_client: AsyncClient,
    admin_headers: dict,
    db_with_users,
):
    _setup_periods_summary_db(
        db_with_users,
        total=2,
        rows=[
            {
                "period": "2026-05",
                "total_emitido": 1200.0,
                "total_recaudado": 900.0,
            },
            {
                "period": "2026-04",
                "total_emitido": 1000.0,
                "total_recaudado": 1000.0,
            },
        ],
    )

    response = await async_client.get(
        "/api/v1/apartment-fees/periods-summary?year=2026",
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["data"], list)
    for item in data["data"]:
        assert item["period"].startswith("2026-")


@pytest.mark.asyncio
async def test_periods_summary_page_size_over_100_returns_400(
    async_client: AsyncClient,
    admin_headers: dict,
):
    response = await async_client.get(
        "/api/v1/apartment-fees/periods-summary?page_size=200",
        headers=admin_headers,
    )

    assert response.status_code in [400, 422]


@pytest.mark.asyncio
async def test_periods_summary_requires_auth_401(
    async_client: AsyncClient,
):
    response = await async_client.get("/api/v1/apartment-fees/periods-summary")

    assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_periods_summary_requires_admin_403(
    async_client: AsyncClient,
    propietario_headers: dict,
):
    response = await async_client.get(
        "/api/v1/apartment-fees/periods-summary",
        headers=propietario_headers,
    )

    assert response.status_code == 403
