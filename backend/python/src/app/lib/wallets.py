"""Wallet provisioning and session-scoped wallet lookups."""

import re
from collections.abc import Sequence
from typing import Any, Literal, TypedDict

from sqlalchemy import Engine, text
from sqlalchemy.engine import Connection

from database.db_01.connection import get_database_engine

WalletEnvironment = Literal["LIVE", "TEST"]
_ENVIRONMENTS: tuple[WalletEnvironment, ...] = ("LIVE", "TEST")
_FUNCTIONAL_WALLET_TYPES = (
    "MAIN",
    "CASHBACK",
    "SMARTLOCK",
    "SMARTWEALTH",
    "SPEND&SAVE",
)


class WalletRecord(TypedDict):
    id: int
    userId: int
    environment: WalletEnvironment
    walletType: str
    currency: str
    balance: Any
    availableBalance: Any
    pendingBalance: Any
    status: bool


def ensure_user_wallets(
    user_id: int,
    supported_currencies: Sequence[str] = ("NGN",),
    executor: Engine | Connection | None = None,
) -> bool:
    if isinstance(user_id, bool) or not isinstance(user_id, int) or user_id <= 0:
        raise TypeError("A valid user_id is required for wallet provisioning")
    currencies = list(
        dict.fromkeys(
            currency.strip().upper()
            for currency in supported_currencies
            if currency.strip()
        )
    )
    if not currencies:
        currencies = ["NGN"]
    if any(re.fullmatch(r"[A-Z]{3,10}", currency) is None for currency in currencies):
        raise TypeError("Wallet currency is invalid")

    def provision(connection: Connection) -> None:
        rows = connection.execute(
            text(
                """
                SELECT "environment", "walletType", "currency"
                FROM "wallets"
                WHERE "userId" = :user_id AND "currency" = ANY(:currencies)
                """
            ),
            {"user_id": user_id, "currencies": currencies},
        ).mappings()
        existing = {
            f'{row["environment"].upper()}:{row["walletType"].upper()}:{row["currency"].upper()}'
            for row in rows
        }
        for currency in currencies:
            for environment in _ENVIRONMENTS:
                for wallet_type in _FUNCTIONAL_WALLET_TYPES:
                    key = f"{environment}:{wallet_type}:{currency}"
                    if key in existing:
                        continue
                    connection.execute(
                        text(
                            """
                            INSERT INTO "wallets"
                                ("userId", "environment", "walletType", "currency",
                                 "balance", "availableBalance", "pendingBalance", "status")
                            VALUES
                                (:user_id, :environment, :wallet_type, :currency, 0, 0, 0, TRUE)
                            ON CONFLICT ("userId", "environment", "walletType", "currency")
                            DO NOTHING
                            """
                        ),
                        {
                            "user_id": user_id,
                            "environment": environment,
                            "wallet_type": wallet_type,
                            "currency": currency,
                        },
                    )

    selected = executor or get_database_engine()
    if isinstance(selected, Connection):
        provision(selected)
    else:
        with selected.begin() as connection:
            provision(connection)
    return True


def wallet_environment_for_mode(mode: str) -> WalletEnvironment:
    normalized = mode.strip().upper()
    if normalized in {"", "LIVE"}:
        return "LIVE"
    if normalized == "TEST":
        return "TEST"
    raise TypeError("A valid session mode is required for wallet resolution")


def wallet_type_for_mode(mode: str) -> Literal["MAIN"]:
    if mode.strip().lower() in {"", "live", "test"}:
        return "MAIN"
    raise TypeError("A valid session mode is required for wallet resolution")


def get_user_wallet(
    user_id: int,
    wallet_type: str = "MAIN",
    currency: str = "NGN",
    environment: str = "LIVE",
    for_update: bool = False,
    executor: Engine | Connection | None = None,
) -> WalletRecord | None:
    selected = executor or get_database_engine()
    if for_update and not isinstance(selected, Connection):
        raise TypeError("A database transaction connection is required for a locked wallet lookup")
    statement = text(
        """
        SELECT "id", "userId", "environment", "walletType", "currency", "balance",
               "availableBalance", "pendingBalance", "status"
        FROM "wallets"
        WHERE "userId" = :user_id AND "environment" = :environment
          AND "walletType" = :wallet_type AND "currency" = :currency
          AND "status" = TRUE
        LIMIT 1
        """
        + (" FOR UPDATE" if for_update else "")
    )
    parameters = {
        "user_id": user_id,
        "environment": environment.strip().upper(),
        "wallet_type": wallet_type.strip().upper(),
        "currency": currency.strip().upper(),
    }
    if isinstance(selected, Connection):
        row = selected.execute(statement, parameters).mappings().first()
        return _wallet_record(row) if row is not None else None
    with selected.connect() as connection:
        row = connection.execute(statement, parameters).mappings().first()
        return _wallet_record(row) if row is not None else None


def get_session_wallet(
    user_id: int,
    mode: str,
    currency: str = "NGN",
    for_update: bool = False,
    executor: Engine | Connection | None = None,
) -> WalletRecord | None:
    normalized_mode = mode.strip().lower()
    return get_user_wallet(
        user_id,
        wallet_type_for_mode(normalized_mode),
        currency,
        wallet_environment_for_mode(normalized_mode),
        for_update,
        executor,
    )


def _wallet_record(row: Any) -> WalletRecord:
    return {
        "id": row["id"],
        "userId": row["userId"],
        "environment": row["environment"],
        "walletType": row["walletType"],
        "currency": row["currency"],
        "balance": row["balance"],
        "availableBalance": row["availableBalance"],
        "pendingBalance": row["pendingBalance"],
        "status": row["status"],
    }