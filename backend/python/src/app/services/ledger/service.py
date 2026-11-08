"""Transactional wallet ledger operations."""

import json
import math
import re
import secrets
from collections.abc import Callable, Mapping
from importlib.resources import files
from typing import Any, TypeVar

from sqlalchemy import Engine, text
from sqlalchemy.engine import Connection
from sqlalchemy.sql.elements import TextClause

from database.db_01.connection import get_database_engine
from app.services.ledger.exceptions import LedgerError
from app.services.ledger.models import (
    LedgerDirection,
    LedgerEntry,
    LedgerEntryInput,
    LedgerEnvironment,
    LedgerRecordInput,
    LedgerRefundInput,
    LedgerRefundResult,
    LedgerSettleInput,
    LedgerTransferInput,
    LedgerUpdateInput,
    LedgerUpdateResult,
)

_METADATA_RULES = json.loads(
    files("app.data").joinpath("ledger.json").read_text(encoding="utf-8")
)
_REFUND_COLUMNS = """
    "id", "psRef", "sessionReference", "userId", "amount", "direction",
    "walletType", "currency", "environment", "balanceBefore", "balanceAfter",
    "status", "type", "metadata"
"""
_SETTLE_COLUMNS = _REFUND_COLUMNS.replace(
    '"status", "type", "metadata"',
    '"status", "type", "serviceName", "fee", "revenue", "metadata"',
)
_T = TypeVar("_T")


def _load_metadata_rules() -> dict[str, tuple[str, ...]]:
    rules = _METADATA_RULES.get("metadataAllowedKeys")
    if not isinstance(rules, dict) or any(
        not isinstance(kind, str)
        or not isinstance(keys, list)
        or any(not isinstance(key, str) or not key for key in keys)
        for kind, keys in rules.items()
    ):
        raise ValueError("app.data/ledger.json has invalid metadataAllowedKeys data")
    return {kind: tuple(keys) for kind, keys in rules.items()}


_METADATA_ALLOWED_KEYS = _load_metadata_rules()


def with_ledger_transaction(
    operation: Callable[["LedgerSession"], _T],
    executor: Engine | None = None,
) -> _T:
    engine = executor if executor is not None else get_database_engine()
    with engine.begin() as connection:
        return operation(LedgerSession(connection))


class LedgerSession:
    """Ledger operations sharing a caller-owned database transaction."""

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def execute(
        self, statement: str | TextClause, parameters: Mapping[str, Any] | None = None
    ) -> Any:
        query = text(statement) if isinstance(statement, str) else statement
        return self._connection.execute(query, parameters or {})

    def credit(self, input: LedgerEntryInput) -> LedgerEntry:
        return _write_entry(self._connection, input, "credit", True)

    def debit(self, input: LedgerEntryInput) -> LedgerEntry:
        return _write_entry(self._connection, input, "debit", True)

    def record(self, input: LedgerRecordInput) -> LedgerEntry:
        return _write_entry(self._connection, input, input["direction"], False)

    def transfer(self, input: LedgerTransferInput) -> dict[str, Any]:
        return transfer_ledger_group(self._connection, input)

    def refund(self, input: LedgerRefundInput) -> LedgerRefundResult:
        return refund_ledger_group(self._connection, input)

    def settle(self, input: LedgerSettleInput) -> LedgerEntry:
        return settle_ledger_entry(self._connection, input)

    def update(self, input: LedgerUpdateInput) -> LedgerUpdateResult:
        return update_ledger_transaction(self._connection, input)


def credit(input: LedgerEntryInput, executor: Engine | None = None) -> LedgerEntry:
    return with_ledger_transaction(lambda session: session.credit(input), executor)


def debit(input: LedgerEntryInput, executor: Engine | None = None) -> LedgerEntry:
    return with_ledger_transaction(lambda session: session.debit(input), executor)


def record(
    input: LedgerRecordInput,
    executor: Engine | None = None,
) -> LedgerEntry:
    return with_ledger_transaction(lambda session: session.record(input), executor)


def transfer(
    input: LedgerTransferInput, executor: Engine | None = None
) -> dict[str, Any]:
    return with_ledger_transaction(lambda session: session.transfer(input), executor)


def refund(
    input: LedgerRefundInput, executor: Engine | None = None
) -> LedgerRefundResult:
    return with_ledger_transaction(lambda session: session.refund(input), executor)


def settle(input: LedgerSettleInput, executor: Engine | None = None) -> LedgerEntry:
    return with_ledger_transaction(lambda session: session.settle(input), executor)


def update(
    input: LedgerUpdateInput, executor: Engine | None = None
) -> LedgerUpdateResult:
    return with_ledger_transaction(lambda session: session.update(input), executor)


def normalize_transaction_metadata(
    transaction_type: str, input: Mapping[str, Any]
) -> dict[str, str]:
    normalized_type = transaction_type.strip().lower()
    if normalized_type in {"external bank transfer", "invoice transfer"}:
        normalized_type = "transfer"
    allowed_keys = _METADATA_ALLOWED_KEYS.get(normalized_type, ())
    for key in input:
        if key not in allowed_keys:
            raise TypeError(
                f"Metadata key {key} is not allowed for transaction type {transaction_type}"
            )
    metadata: dict[str, str] = {}
    for key in allowed_keys:
        value = input.get(key)
        if value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            raise TypeError(f"Metadata value {key} must be a string or number")
        normalized = str(value).strip()
        if normalized:
            metadata[key] = normalized
    return metadata


def update_ledger_transaction(
    connection: Connection, input: LedgerUpdateInput
) -> LedgerUpdateResult:
    reference, transaction_id = _identity(input)
    environment = _environment(input["environment"])
    where, identity_values = _identity_clause(
        reference, transaction_id, include_session=True
    )
    user_clause = ' AND "userId" = :user_id' if input.get("user_id") is not None else ""
    parameters: dict[str, Any] = {
        **identity_values,
        "environment": environment,
    }
    if input.get("user_id") is not None:
        parameters["user_id"] = input["user_id"]
    transaction = (
        connection.execute(
            text(
                f"""
            SELECT "id", "status", "type", "metadata"
            FROM "transactions"
            WHERE {where} AND "environment" = :environment{user_clause}
            ORDER BY "id"
            LIMIT 1
            FOR UPDATE
            """
            ),
            parameters,
        )
        .mappings()
        .first()
    )
    if transaction is None:
        raise LedgerError(404, "Transaction was not found")
    expected = [
        status.lower()
        for status in input.get(
            "expected_statuses", ["pending", "processing", "failed"]
        )
    ]
    status = str(transaction["status"])
    if status.lower() not in expected:
        raise LedgerError(409, "Transaction status changed before update")
    metadata = normalize_transaction_metadata(
        str(transaction["type"]),
        {**_parse_metadata(transaction["metadata"]), **input.get("metadata", {})},
    )
    result = connection.execute(
        text(
            """
            UPDATE "transactions"
            SET "status" = COALESCE(:new_status, "status"),
                "sessionReference" = COALESCE(
                    NULLIF(NULLIF(:session_reference, ''), "psRef"),
                    "sessionReference"
                ),
                "narration" = CASE
                    WHEN :narration IS NULL THEN "narration"
                    ELSE COALESCE("narration", '') || :narration
                END,
                "metadata" = CAST(:metadata AS JSONB)
            WHERE "id" = :id AND "status" = :old_status
            """
        ),
        {
            "new_status": input.get("status"),
            "session_reference": input.get("session_reference") or "",
            "narration": input.get("narration"),
            "metadata": json.dumps(metadata),
            "id": transaction["id"],
            "old_status": status,
        },
    )
    if result.rowcount != 1:
        raise LedgerError(409, "Transaction changed while updating ledger state")
    return {
        "transaction_id": int(transaction["id"]),
        "status": input.get("status", status),
    }


def transfer_ledger_group(
    connection: Connection, input: LedgerTransferInput
) -> dict[str, Any]:
    amount = _money(input["amount"], "amount")
    currency = _required_text(input.get("currency", "NGN"), "currency", 3).upper()
    transaction_type = _required_text(input.get("type", "Transfer"), "type", 100)
    environment = _environment(input["environment"])
    from_party = input["from_party"]
    to_party = input["to_party"]
    from_wallet = str(from_party.get("wallet_type", "MAIN")).upper()
    to_wallet = str(to_party.get("wallet_type", "MAIN")).upper()
    if from_party["user_id"] == to_party["user_id"] and from_wallet == to_wallet:
        raise TypeError("Transfer source and destination wallets must be different")

    wallet_keys = sorted(
        (
            (int(from_party["user_id"]), from_wallet),
            (int(to_party["user_id"]), to_wallet),
        )
    )
    connection.execute(
        text(
            """
            SELECT "id" FROM "wallets"
            WHERE "environment" = :environment AND "currency" = :currency
              AND "status" = TRUE
              AND (("userId" = :user_1 AND "walletType" = :wallet_1)
                OR ("userId" = :user_2 AND "walletType" = :wallet_2))
            ORDER BY "id"
            FOR UPDATE
            """
        ),
        {
            "environment": environment,
            "currency": currency,
            "user_1": wallet_keys[0][0],
            "wallet_1": wallet_keys[0][1],
            "user_2": wallet_keys[1][0],
            "wallet_2": wallet_keys[1][1],
        },
    )
    session_reference = input.get("session_reference") or _create_reference(
        f"{transaction_type}-GROUP"
    )
    common = {
        "amount": amount,
        "type": transaction_type,
        "environment": environment,
        "currency": currency,
        "session_reference": session_reference,
    }
    debit_entry = _write_entry(
        connection,
        {
            **common,
            "user_id": from_party["user_id"],
            "service_name": _required_text(
                from_party["service_name"], "serviceName", 150
            ),
            "wallet_type": from_party.get("wallet_type", "MAIN"),
            "narration": from_party.get("narration"),
            "metadata": from_party.get("metadata", {}),
        },
        "debit",
        True,
    )
    credit_entry = _write_entry(
        connection,
        {
            **common,
            "user_id": to_party["user_id"],
            "service_name": _required_text(
                to_party["service_name"], "serviceName", 150
            ),
            "wallet_type": to_party.get("wallet_type", "MAIN"),
            "narration": to_party.get("narration"),
            "metadata": to_party.get("metadata", {}),
        },
        "credit",
        True,
    )
    return {
        "session_reference": session_reference,
        "debit": debit_entry,
        "credit": credit_entry,
    }


def settle_ledger_entry(
    connection: Connection, input: LedgerSettleInput
) -> LedgerEntry:
    reference, transaction_id = _identity(input)
    environment = _environment(input["environment"])
    where = (
        '"id" = :transaction_id'
        if transaction_id is not None
        else '"psRef" = :reference'
    )
    parameters: dict[str, Any] = {
        "transaction_id": transaction_id,
        "reference": reference,
        "environment": environment,
    }
    user_clause = ' AND "userId" = :user_id' if input.get("user_id") is not None else ""
    if input.get("user_id") is not None:
        parameters["user_id"] = input["user_id"]
    transaction = (
        connection.execute(
            text(
                f"""
            SELECT {_SETTLE_COLUMNS}
            FROM "transactions"
            WHERE {where} AND "environment" = :environment{user_clause}
            LIMIT 1
            FOR UPDATE
            """
            ),
            parameters,
        )
        .mappings()
        .first()
    )
    if transaction is None:
        raise LedgerError(404, "Transaction was not found")
    if str(transaction["status"]).lower() == "successful":
        return _to_ledger_entry(transaction)
    expected = [
        status.lower()
        for status in input.get("expected_statuses", ["pending", "processing"])
    ]
    if str(transaction["status"]).lower() not in expected:
        raise LedgerError(409, "Transaction is not eligible for settlement")

    amount = _money(input.get("amount", float(transaction["amount"])), "amount")
    fee = _money(input.get("fee", float(transaction["fee"] or 0)), "fee")
    revenue = _money(
        input.get("revenue", float(transaction["revenue"] or 0)), "revenue"
    )
    balance_before = _optional_float(transaction["balanceBefore"])
    balance_after = _optional_float(transaction["balanceAfter"])
    if (balance_before is None) != (balance_after is None):
        raise LedgerError(409, "Transaction has an incomplete balance snapshot")
    if balance_before is None and input.get("apply_wallet", True):
        wallet = (
            connection.execute(
                text(
                    """
                SELECT "id", "balance", "availableBalance"
                FROM "wallets"
                WHERE "userId" = :user_id AND "environment" = :environment
                  AND "walletType" = :wallet_type AND "currency" = :currency
                  AND "status" = TRUE
                LIMIT 1
                FOR UPDATE
                """
                ),
                {
                    "user_id": transaction["userId"],
                    "environment": transaction["environment"],
                    "wallet_type": transaction["walletType"],
                    "currency": transaction["currency"],
                },
            )
            .mappings()
            .first()
        )
        if wallet is None:
            raise LedgerError(409, f"{transaction['walletType']} wallet is unavailable")
        balance_before = _money(float(wallet["balance"]), "wallet balance")
        available_before = _money(
            float(wallet["availableBalance"]), "available balance"
        )
        delta = amount if transaction["direction"] == "credit" else -amount
        balance_after = _round_money(balance_before + delta)
        available_after = _round_money(available_before + delta)
        if available_after < -0.000001:
            raise LedgerError(403, "Insufficient wallet balance to settle transaction")
        result = connection.execute(
            text(
                """
                UPDATE "wallets"
                SET "balance" = :balance, "availableBalance" = :available
                WHERE "id" = :id AND "status" = TRUE
                """
            ),
            {
                "balance": max(0, balance_after),
                "available": max(0, available_after),
                "id": wallet["id"],
            },
        )
        if result.rowcount != 1:
            raise LedgerError(409, "Wallet changed while processing settlement")

    metadata = normalize_transaction_metadata(
        str(transaction["type"]),
        {**_parse_metadata(transaction["metadata"]), **input.get("metadata", {})},
    )
    result = connection.execute(
        text(
            """
            UPDATE "transactions"
            SET "status" = 'successful',
                "fee" = :fee,
                "revenue" = :revenue,
                "sessionReference" = COALESCE(
                    NULLIF(NULLIF(:session_reference, ''), "psRef"),
                    "sessionReference"
                ),
                "balanceBefore" = COALESCE("balanceBefore", :balance_before),
                "balanceAfter" = COALESCE("balanceAfter", :balance_after),
                "metadata" = "metadata" || CAST(:metadata AS JSONB)
            WHERE "id" = :id AND "status" = :old_status
            """
        ),
        {
            "fee": fee,
            "revenue": revenue,
            "session_reference": input.get("session_reference") or "",
            "balance_before": balance_before,
            "balance_after": balance_after,
            "metadata": json.dumps(metadata),
            "id": transaction["id"],
            "old_status": transaction["status"],
        },
    )
    if result.rowcount != 1:
        raise LedgerError(409, "Transaction changed while processing settlement")
    entry = _to_ledger_entry(transaction)
    entry.update(
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        status="successful",
    )
    return entry


def refund_ledger_group(
    connection: Connection, input: LedgerRefundInput
) -> LedgerRefundResult:
    reference, transaction_id = _identity(input)
    environment = _environment(input["environment"])
    target_status = input.get("target_status", "refunded")
    if target_status not in {"refunded", "reversed", "cancelled"}:
        raise TypeError("target_status must be refunded, reversed, or cancelled")
    identity_where, identity_values = _identity_clause(
        reference, transaction_id, include_session=True
    )
    parameters: dict[str, Any] = {
        **identity_values,
        "environment": environment,
        "reference_order": reference or "",
    }
    user_clause = ' AND "userId" = :user_id' if input.get("user_id") is not None else ""
    if input.get("user_id") is not None:
        parameters["user_id"] = input["user_id"]
    anchor = (
        connection.execute(
            text(
                f"""
            SELECT {_REFUND_COLUMNS}
            FROM "transactions"
            WHERE {identity_where} AND "environment" = :environment{user_clause}
            ORDER BY CASE WHEN "psRef" = :reference_order THEN 0 ELSE 1 END, "id"
            LIMIT 1
            FOR UPDATE
            """
            ),
            parameters,
        )
        .mappings()
        .first()
    )
    if anchor is None:
        raise LedgerError(404, "Transaction was not found")
    session_reference = str(anchor["sessionReference"] or "").strip()
    linked = list(
        connection.execute(
            text(
                f"""
                SELECT {_REFUND_COLUMNS}
                FROM "transactions"
                WHERE "environment" = :environment
                  AND ("id" = :id OR "sessionReference" = :session_reference
                    OR "sessionReference" = :ps_ref OR "psRef" = :session_reference)
                ORDER BY "id"
                FOR UPDATE
                """
            ),
            {
                "environment": environment,
                "id": anchor["id"],
                "session_reference": session_reference,
                "ps_ref": anchor["psRef"],
            },
        ).mappings()
    )
    transactions = linked or [anchor]
    ids = [int(row["id"]) for row in transactions]
    if all(str(row["status"]).lower() == target_status for row in transactions):
        return {
            "transaction_ids": ids,
            "status": target_status,
            "linked_count": len(transactions),
        }
    expected = [
        status.lower()
        for status in input.get(
            "expected_statuses", ["processing", "pending", "successful"]
        )
    ]
    for transaction in transactions:
        if str(transaction["status"]).lower() not in expected:
            raise LedgerError(409, "A linked transaction is not eligible for refund")

    changes: dict[tuple[int, str, str, str], float] = {}
    for transaction in transactions:
        before = transaction["balanceBefore"]
        after = transaction["balanceAfter"]
        if before is None or after is None:
            continue
        delta = _round_money(float(before) - float(after))
        if abs(delta) < 0.005:
            continue
        key = (
            int(transaction["userId"]),
            str(transaction["environment"]),
            str(transaction["walletType"]),
            str(transaction["currency"]),
        )
        changes[key] = changes.get(key, 0) + delta

    for (user_id, wallet_environment, wallet_type, currency), delta in sorted(
        changes.items()
    ):
        wallet = (
            connection.execute(
                text(
                    """
                SELECT "id", "balance", "availableBalance"
                FROM "wallets"
                WHERE "userId" = :user_id AND "environment" = :environment
                  AND "walletType" = :wallet_type AND "currency" = :currency
                  AND "status" = TRUE
                LIMIT 1
                FOR UPDATE
                """
                ),
                {
                    "user_id": user_id,
                    "environment": wallet_environment,
                    "wallet_type": wallet_type,
                    "currency": currency,
                },
            )
            .mappings()
            .first()
        )
        if wallet is None:
            raise LedgerError(409, f"{wallet_type} wallet is unavailable")
        balance = _round_money(float(wallet["balance"]) + delta)
        available = _round_money(float(wallet["availableBalance"]) + delta)
        if balance < -0.000001 or available < -0.000001:
            raise LedgerError(
                409, "Linked wallet has insufficient available balance to reverse"
            )
        result = connection.execute(
            text(
                """
                UPDATE "wallets"
                SET "balance" = :balance, "availableBalance" = :available
                WHERE "id" = :id AND "status" = TRUE
                """
            ),
            {
                "balance": max(0, balance),
                "available": max(0, available),
                "id": wallet["id"],
            },
        )
        if result.rowcount != 1:
            raise LedgerError(409, "Wallet changed while processing refund")

    reason = input.get("reason", "").strip()
    suffix = f" | {target_status}: {reason}" if reason else f" | {target_status}"
    for transaction in transactions:
        metadata = normalize_transaction_metadata(
            str(transaction["type"]), _parse_metadata(transaction["metadata"])
        )
        result = connection.execute(
            text(
                """
                UPDATE "transactions"
                SET "status" = :status, "revenue" = 0,
                    "narration" = COALESCE("narration", '') || :suffix,
                    "metadata" = CAST(:metadata AS JSONB)
                WHERE "id" = :id AND "status" = :old_status
                """
            ),
            {
                "status": target_status,
                "suffix": suffix,
                "metadata": json.dumps(metadata),
                "id": transaction["id"],
                "old_status": transaction["status"],
            },
        )
        if result.rowcount != 1:
            raise LedgerError(
                409, "A linked transaction changed while processing refund"
            )
    return {
        "transaction_ids": ids,
        "status": target_status,
        "linked_count": len(transactions),
    }


def _write_entry(
    connection: Connection,
    input: LedgerEntryInput,
    direction: LedgerDirection,
    update_wallet: bool,
) -> LedgerEntry:
    amount = _money(input["amount"], "amount")
    fee = _money(input.get("fee", 0), "fee")
    revenue = _money(input.get("revenue", 0), "revenue")
    user_id = input["user_id"]
    transaction_type = _required_text(input["type"], "type", 100)
    service_name = _required_text(input["service_name"], "serviceName", 150)
    wallet_type = _required_text(
        input.get("wallet_type", "MAIN"), "walletType", 30
    ).upper()
    currency = _required_text(input.get("currency", "NGN"), "currency", 3).upper()
    environment = _environment(input["environment"])
    if isinstance(user_id, bool) or not isinstance(user_id, int) or user_id <= 0:
        raise TypeError("userId must be a positive integer")
    metadata = normalize_transaction_metadata(
        transaction_type, input.get("metadata", {})
    )
    reference = _create_reference(transaction_type)
    balance_before: float | None = None
    balance_after: float | None = None
    if update_wallet:
        wallet = (
            connection.execute(
                text(
                    """
                    SELECT "id", "balance", "availableBalance"
                    FROM "wallets"
                    WHERE "userId" = :user_id AND "environment" = :environment
                      AND "walletType" = :wallet_type AND "currency" = :currency
                      AND "status" = TRUE
                    LIMIT 1
                    FOR UPDATE
                    """
                ),
                {
                    "user_id": user_id,
                    "environment": environment,
                    "wallet_type": wallet_type,
                    "currency": currency,
                },
            )
            .mappings()
            .first()
        )
        if wallet is None:
            raise LedgerError(404, f"{wallet_type} wallet was not found")
        balance_before = _money(float(wallet["balance"]), "wallet balance")
        available_before = _money(
            float(wallet["availableBalance"]), "available balance"
        )
        if direction == "debit" and available_before < amount:
            raise LedgerError(403, "Insufficient wallet balance")
        delta = amount if direction == "credit" else -amount
        balance_after = _money(balance_before + delta, "resulting balance")
        available_after = _money(
            available_before + delta, "resulting available balance"
        )
        result = connection.execute(
            text(
                """
                    UPDATE "wallets"
                    SET "balance" = :balance, "availableBalance" = :available
                    WHERE "id" = :id AND "status" = TRUE
                      AND (:direction = 'credit' OR "availableBalance" >= :amount)
                    """
            ),
            {
                "balance": balance_after,
                "available": available_after,
                "id": wallet["id"],
                "direction": direction,
                "amount": amount,
            },
        )
        if result.rowcount != 1:
            message = (
                "Wallet balance changed; retry the request"
                if direction == "debit"
                else "Wallet update failed"
            )
            raise LedgerError(409, message)

    session_reference = input.get("session_reference")
    result = connection.execute(
        text(
            """
                INSERT INTO "transactions"
                    ("userId", "type", "serviceName", "direction", "amount", "fee",
                     "revenue", "status", "currency", "psRef", "sessionReference",
                     "balanceBefore", "balanceAfter", "narration", "walletType",
                     "environment", "metadata")
                VALUES
                    (:user_id, :type, :service_name, :direction, :amount, :fee,
                     :revenue, :status, :currency, :reference,
                     CASE WHEN :session_reference = :reference THEN NULL
                          ELSE :session_reference END,
                     :balance_before, :balance_after, :narration, :wallet_type,
                     :environment, CAST(:metadata AS JSONB))
                RETURNING "id"
                """
        ),
        {
            "user_id": user_id,
            "type": transaction_type,
            "service_name": service_name,
            "direction": direction,
            "amount": amount,
            "fee": fee,
            "revenue": revenue,
            "status": input.get("status", "successful"),
            "currency": currency,
            "reference": reference,
            "session_reference": session_reference,
            "balance_before": balance_before,
            "balance_after": balance_after,
            "narration": input.get("narration"),
            "wallet_type": wallet_type,
            "environment": environment,
            "metadata": json.dumps(metadata),
        },
    )
    return {
        "id": int(result.scalar_one()),
        "reference": reference,
        "user_id": user_id,
        "amount": amount,
        "direction": direction,
        "type": transaction_type,
        "service_name": service_name,
        "currency": currency,
        "wallet_type": wallet_type,
        "environment": environment,
        "balance_before": balance_before,
        "balance_after": balance_after,
        "status": input.get("status", "successful"),
    }


def _identity(input: Mapping[str, Any]) -> tuple[str | None, int | None]:
    reference_value = input.get("reference")
    reference = (
        reference_value.strip()
        if isinstance(reference_value, str) and reference_value.strip()
        else None
    )
    transaction_id = input.get("transaction_id")
    if transaction_id is not None and (
        isinstance(transaction_id, bool)
        or not isinstance(transaction_id, int)
        or transaction_id <= 0
    ):
        raise TypeError("transaction_id must be a positive integer")
    if reference is None and transaction_id is None:
        raise TypeError("reference or transaction_id is required")
    return reference, transaction_id


def _identity_clause(
    reference: str | None,
    transaction_id: int | None,
    *,
    include_session: bool,
) -> tuple[str, dict[str, Any]]:
    if transaction_id is not None:
        return '"id" = :transaction_id', {"transaction_id": transaction_id}
    if include_session:
        return (
            '("psRef" = :reference OR "sessionReference" = :reference)',
            {"reference": reference},
        )
    return '"psRef" = :reference', {"reference": reference}


def _environment(value: str) -> LedgerEnvironment:
    if value == "LIVE":
        return "LIVE"
    if value == "TEST":
        return "TEST"
    raise TypeError("environment must be LIVE or TEST")


def _required_text(value: str, field: str, maximum_length: int) -> str:
    if not isinstance(value, str):
        raise TypeError(
            f"{field} is required and must be at most {maximum_length} characters"
        )
    normalized = value.strip()
    if not normalized or len(normalized) > maximum_length:
        raise TypeError(
            f"{field} is required and must be at most {maximum_length} characters"
        )
    return normalized


def _money(value: Any, field: str) -> float:
    if isinstance(value, bool):
        raise TypeError(f"{field} must be a non-negative number")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as error:
        raise TypeError(f"{field} must be a non-negative number") from error
    if not math.isfinite(parsed) or parsed < 0:
        raise TypeError(f"{field} must be a non-negative number")
    return _round_money(parsed)


def _round_money(value: float) -> float:
    return round(value + math.ulp(value), 2)


def _optional_float(value: Any) -> float | None:
    return None if value is None else float(value)


def _create_reference(transaction_type: str) -> str:
    prefix = re.sub(r"[^A-Z0-9]+", "-", transaction_type.upper()).strip("-")[:12]
    return f"PS-{prefix or 'TX'}-{secrets.token_hex(10).upper()}"


def _parse_metadata(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}
    return value if isinstance(value, dict) else {}


def _to_ledger_entry(row: Mapping[str, Any]) -> LedgerEntry:
    return {
        "id": int(row["id"]),
        "reference": str(row["psRef"]),
        "user_id": int(row["userId"]),
        "amount": float(row["amount"]),
        "direction": row["direction"],
        "type": str(row["type"]),
        "service_name": str(row["serviceName"]),
        "currency": str(row["currency"]),
        "wallet_type": str(row["walletType"]),
        "environment": row["environment"],
        "balance_before": _optional_float(row["balanceBefore"]),
        "balance_after": _optional_float(row["balanceAfter"]),
        "status": str(row["status"]),
    }
