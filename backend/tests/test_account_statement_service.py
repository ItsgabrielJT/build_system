from decimal import Decimal
from uuid import UUID

import pytest

from app.services.account_statement_service import AccountStatementService


def test_quota_percent_formats_owner_database_value():
    service = AccountStatementService(delinquency_repo=None, owner_repo=None)

    assert service._quota_percent(Decimal("2.75")) == "2,75 %"


def test_quota_percent_defaults_to_zero_when_missing():
    service = AccountStatementService(delinquency_repo=None, owner_repo=None)

    assert service._quota_percent(None) == "0,00 %"


@pytest.mark.asyncio
async def test_statement_separates_other_charge_payment(monkeypatch):
    class FakeFinancialSettingsRepository:
        def __init__(self, conn):
            pass

        async def get_due_day(self):
            return 5

        async def get_interest_rate_map(self):
            return {}

    class FakeDelinquencyRepository:
        _conn = object()

        async def get_statement_data(self, owner_id, start_period, end_period):
            return [
                {
                    "period": "2026-09",
                    "apartment_id": UUID("550e8400-e29b-41d4-a716-446655440101"),
                    "apartment_code": "1C",
                    "esperado": Decimal("107.40"),
                    "multas": Decimal("0"),
                    "otros_cobros": Decimal("400.00"),
                    "pagado_cuota": Decimal("107.40"),
                    "pagado_otros_cobros": Decimal("140.00"),
                    "pagado": Decimal("247.40"),
                    "pagos_capital": [{"paid_at": "2026-09-02", "amount": 107.40}],
                }
            ]

        async def get_other_charge_statement_lines(self, owner_id, start_period, end_period):
            return [
                {
                    "period": "2026-09",
                    "apartment_id": UUID("550e8400-e29b-41d4-a716-446655440101"),
                    "apartment_code": "1C",
                    "concept": "Cuota extraordinaria",
                    "amount": Decimal("400.00"),
                    "paid_amount": Decimal("140.00"),
                }
            ]

    monkeypatch.setattr(
        "app.services.account_statement_service.FinancialSettingsRepository",
        FakeFinancialSettingsRepository,
    )

    service = AccountStatementService(FakeDelinquencyRepository(), owner_repo=None)
    rows = await service.get_statement(
        UUID("550e8400-e29b-41d4-a716-446655440201"),
        "2026-09",
        "2026-09",
    )

    assert len(rows) == 2
    assert rows[0]["tipo"] == "ALICUOTA"
    assert rows[0]["esperado"] == 107.4
    assert rows[0]["otros_cobros"] == 0.0
    assert rows[0]["pagado"] == 107.4
    assert rows[0]["saldo"] == 0.0
    assert rows[1]["tipo"] == "OTRO_COBRO"
    assert rows[1]["concepto"] == "Cuota extraordinaria"
    assert rows[1]["esperado"] == 0.0
    assert rows[1]["otros_cobros"] == 400.0
    assert rows[1]["pagado"] == 140.0
    assert rows[1]["saldo"] == 260.0
