from decimal import Decimal

from app.services.account_statement_service import AccountStatementService


def test_quota_percent_formats_owner_database_value():
    service = AccountStatementService(delinquency_repo=None, owner_repo=None)

    assert service._quota_percent(Decimal("2.75")) == "2,75 %"


def test_quota_percent_defaults_to_zero_when_missing():
    service = AccountStatementService(delinquency_repo=None, owner_repo=None)

    assert service._quota_percent(None) == "0,00 %"
