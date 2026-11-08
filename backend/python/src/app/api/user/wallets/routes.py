"""User wallet balances and internal wallet transfers."""

import asyncio
import math
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text

from app.api.deps import require_user
from database.db_01.connection import get_database_engine
from app.lib.wallets import ensure_user_wallets
from app.services.ledger.exceptions import LedgerError
from app.services.ledger.service import transfer

router = APIRouter()
_SOURCE_WALLETS = {"SPEND&SAVE", "CASHBACK"}
_WALLET_NAMES = {
    "MAIN": "Main Wallet",
    "SPEND&SAVE": "Spend & Save",
    "CASHBACK": "Cashback",
}


class WalletTransfer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: Literal["SPEND&SAVE", "CASHBACK"]
    amount: float = Field(gt=0, le=1_000_000_000_000)
    currency: str = "NGN"

    @field_validator("source", mode="before")
    @classmethod
    def normalize_source(cls, value: Any) -> Any:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3 or not normalized.isascii() or not normalized.isalpha():
            raise ValueError("Currency must be a three-letter code")
        return normalized


@router.get("/")
async def list_wallets(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    await asyncio.to_thread(ensure_user_wallets, auth["user_id"], ["NGN"])

    def fetch() -> list[dict[str, Any]]:
        with get_database_engine().connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT "walletType", "environment", "currency", "balance",
                           "availableBalance", "pendingBalance", "status"
                    FROM "wallets"
                    WHERE "userId" = :user_id AND "environment" = :environment
                      AND "currency" = 'NGN' AND "status" = TRUE
                    ORDER BY "walletType" ASC
                    """
                ),
                {
                    "user_id": auth["user_id"],
                    "environment": _environment(auth),
                },
            ).mappings()
            return [dict(row) for row in rows]

    rows = await asyncio.to_thread(fetch)
    wallets = [
        {
            **row,
            "balance": float(row["balance"]),
            "availableBalance": float(row["availableBalance"]),
            "pendingBalance": float(row["pendingBalance"]),
        }
        for row in rows
    ]
    return {
        "success": True,
        "message": "Wallet balances retrieved",
        "data": {
            "wallets": wallets,
            "summary": {
                "totalBalance": _sum(row["balance"] for row in wallets),
                "totalAvailableBalance": _sum(
                    row["availableBalance"] for row in wallets
                ),
                "totalPendingBalance": _sum(
                    row["pendingBalance"] for row in wallets
                ),
                "walletCount": len(wallets),
            },
        },
    }


@router.get("/transfer")
async def transfer_options(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    def fetch() -> list[dict[str, Any]]:
        with get_database_engine().connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT "walletType", "currency", "availableBalance"
                    FROM "wallets"
                    WHERE "userId" = :user_id AND "environment" = :environment
                      AND "status" = TRUE
                    ORDER BY "currency" ASC, "walletType" ASC
                    """
                ),
                {
                    "user_id": auth["user_id"],
                    "environment": _environment(auth),
                },
            ).mappings()
            return [dict(row) for row in rows]

    rows = await asyncio.to_thread(fetch)
    currencies: dict[str, dict[str, list[dict[str, str]]]] = {}
    for row in rows:
        wallet_type = str(row["walletType"]).strip().upper()
        currency = str(row["currency"]).strip().upper()
        if not currency.isascii() or len(currency) != 3:
            continue
        currency_wallets = currencies.setdefault(
            currency, {"sources": [], "destinations": []}
        )
        wallet = {
            "key": wallet_type,
            "name": _WALLET_NAMES.get(wallet_type, _display_name(wallet_type)),
            "balance": f"{float(row['availableBalance']):.2f}",
        }
        if wallet_type in _SOURCE_WALLETS:
            currency_wallets["sources"].append(wallet)
        if wallet_type == "MAIN":
            currency_wallets["destinations"].append(wallet)
    return {
        "success": True,
        "status": 200,
        "message": "Available internal transfer wallets retrieved",
        "data": currencies,
    }


@router.post("/transfer")
async def transfer_wallet_funds(
    payload: WalletTransfer,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    amount = math.floor((payload.amount + 1e-12) * 100 + 0.5) / 100
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be at least 0.01")
    source = payload.source
    environment = _environment(auth)
    label = "Spend & Save" if source == "SPEND&SAVE" else "Cashback"
    service_name = (
        "Spend & Save Withdraw" if source == "SPEND&SAVE" else "Cashback Withdrawal"
    )
    transaction_type = (
        "Savings Withdrawal" if source == "SPEND&SAVE" else "Cashback Withdrawal"
    )
    try:
        result = await asyncio.to_thread(
            transfer,
            {
                "from_party": {
                    "user_id": auth["user_id"],
                    "service_name": service_name,
                    "wallet_type": source,
                    "narration": f"{label} withdrawal to Main wallet",
                },
                "to_party": {
                    "user_id": auth["user_id"],
                    "service_name": service_name,
                    "wallet_type": "MAIN",
                    "narration": f"{label} withdrawal to Main wallet credited to Main wallet",
                },
                "amount": amount,
                "type": transaction_type,
                "currency": payload.currency,
                "environment": environment,
            },
        )
    except LedgerError as error:
        raise HTTPException(status_code=error.status, detail=str(error)) from error

    debit = result["debit"]
    credit = result["credit"]
    return {
        "success": True,
        "status": 200,
        "message": "Internal wallet transfer successful",
        "data": {
            "amount": amount,
            "currency": payload.currency,
            "sourceWalletType": source,
            "destinationWalletType": "MAIN",
            "environment": environment,
            "sessionReference": result["session_reference"],
            "debitLedgerId": debit["id"],
            "creditLedgerId": credit["id"],
            "debitPsRef": debit["reference"],
            "creditPsRef": credit["reference"],
            "mainBalance": credit["balance_after"],
            "notification": {
                "title": service_name,
                "message": (
                    f"{payload.currency} {amount:.2f} has been withdrawn from "
                    f"{label} and credited to your Main wallet"
                ),
            },
        },
    }


def _environment(auth: dict[str, Any]) -> Literal["LIVE", "TEST"]:
    value = str(auth.get("environment", "LIVE")).upper()
    if value not in {"LIVE", "TEST"}:
        raise HTTPException(status_code=401, detail="Authentication is required")
    return "TEST" if value == "TEST" else "LIVE"


def _sum(values: Any) -> float:
    return round(sum(values) + 1e-12, 2)


def _display_name(value: str) -> str:
    return " ".join(
        word.capitalize() for word in value.lower().replace("_", " ").replace("&", " ").split()
    )
