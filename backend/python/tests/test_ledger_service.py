import pytest

from app.services.ledger.exceptions import LedgerError
from app.services.ledger.service import LedgerSession, normalize_transaction_metadata


class _Result:
    def __init__(self, *, row=None, scalar=None, rowcount=1):
        self._row = row
        self._scalar = scalar
        self.rowcount = rowcount

    def mappings(self):
        return self

    def first(self):
        return self._row

    def scalar_one(self):
        return self._scalar


class _Connection:
    def __init__(self, available_balance: float = 10):
        self.available_balance = available_balance
        self.calls = []

    def execute(self, statement, parameters):
        sql = str(statement)
        self.calls.append((sql, parameters))
        if 'FROM "wallets"' in sql and sql.lstrip().startswith("SELECT"):
            return _Result(
                row={
                    "id": 3,
                    "balance": 20,
                    "availableBalance": self.available_balance,
                }
            )
        if 'INSERT INTO "transactions"' in sql:
            return _Result(scalar=71)
        return _Result()


def test_normalize_transaction_metadata_uses_configured_allowlist() -> None:
    assert normalize_transaction_metadata(
        "Data",
        {
            "phoneNumber": " 08012345678 ",
            "network": " MTN ",
            "planId": 4,
        },
    ) == {
        "phoneNumber": "08012345678",
        "network": "MTN",
        "planId": "4",
    }


def test_normalize_transaction_metadata_rejects_unknown_key() -> None:
    with pytest.raises(TypeError, match="not allowed"):
        normalize_transaction_metadata("airtime", {"amount": 500})


def test_normalize_transaction_metadata_rejects_non_string_scalar() -> None:
    with pytest.raises(TypeError, match="must be a string or number"):
        normalize_transaction_metadata("airtime", {"phoneNumber": True})


def test_transfer_metadata_aliases_use_transfer_allowlist() -> None:
    transfer_data = {"recipientName": "Ada", "recipientBankCode": "044"}

    assert normalize_transaction_metadata("transfer", transfer_data) == transfer_data
    assert (
        normalize_transaction_metadata("external bank transfer", transfer_data)
        == transfer_data
    )
    assert (
        normalize_transaction_metadata("invoice transfer", transfer_data)
        == transfer_data
    )


def test_credit_updates_wallet_and_inserts_transaction_in_same_session() -> None:
    connection = _Connection()
    session = LedgerSession(connection)

    result = session.credit(
        {
            "user_id": 8,
            "amount": 5,
            "type": "airtime",
            "service_name": "Airtime",
            "environment": "LIVE",
            "metadata": {"phoneNumber": "08012345678"},
        }
    )

    assert result["id"] == 71
    assert result["balance_before"] == 20
    assert result["balance_after"] == 25
    assert len(connection.calls) == 3
    assert connection.calls[1][1]["balance"] == 25
    assert connection.calls[2][1]["metadata"] == '{"phoneNumber": "08012345678"}'


def test_debit_rejects_insufficient_wallet_balance_before_insert() -> None:
    connection = _Connection(available_balance=4)
    session = LedgerSession(connection)

    with pytest.raises(LedgerError, match="Insufficient wallet balance"):
        session.debit(
            {
                "user_id": 8,
                "amount": 5,
                "type": "airtime",
                "service_name": "Airtime",
                "environment": "LIVE",
            }
        )

    assert len(connection.calls) == 1
