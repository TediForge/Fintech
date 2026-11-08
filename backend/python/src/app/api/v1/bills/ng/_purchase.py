"""Shared ledger and settlement flow for immediate bill purchases."""

import asyncio
import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from fastapi import HTTPException, Request

from app.lib.limits import validate_transaction_limit
from app.providers.types import ProviderError
from app.services.ledger import credit, debit, refund, settle, update

_LOGGER = logging.getLogger(__name__)
_SUCCESS = {"success", "successful", "completed", "done", "ok"}
_PENDING = {"pending", "processing", "queued", "in_progress"}
_FAILED = {"failed", "failure", "reversed", "refunded", "error", "declined"}


async def purchase_bill(
    *,
    request: Request,
    auth: Mapping[str, Any],
    bill_type: str,
    amount: float,
    service_name: str,
    narration: str,
    metadata: dict[str, Any],
    purchase: Callable[[str], Awaitable[Mapping[str, Any]]],
    details: Callable[[Mapping[str, Any]], dict[str, Any]] | None = None,
    fixed_revenue: float | None = None,
) -> dict[str, Any]:
    """Debit, call the provider, then settle or refund the ledger entry."""
    user_id = auth["user_id"]
    environment = auth["environment"]
    mode = "test" if environment == "TEST" else "live"
    ip_address = request.client.host if request.client else "0.0.0.0"
    limit = await asyncio.to_thread(
        validate_transaction_limit,
        user_id=user_id,
        environment=environment,
        mode=mode,
        amount=amount,
        direction="debit",
        ip_address=ip_address,
        device_info=request.headers.get("user-agent", "unknown"),
    )
    if limit["status"] not in {"allowed", "verification_required"}:
        raise HTTPException(
            status_code=limit["httpStatus"], detail=limit["message"]
        )

    entry = await asyncio.to_thread(
        debit,
        {
            "user_id": user_id,
            "amount": amount,
            "type": bill_type,
            "service_name": service_name,
            "wallet_type": "MAIN",
            "environment": environment,
            "status": "processing",
            "narration": narration,
            "metadata": metadata,
        },
    )
    reference = entry["reference"]
    try:
        provider_result = await purchase(reference)
    except ProviderError as error:
        _LOGGER.warning(
            "%s purchase %s requires provider reconciliation: %s",
            bill_type,
            reference,
            error,
        )
        return {
            "success": True,
            "message": "Order submitted and pending confirmation",
            "data": {"reference": reference, "status": "pending"},
        }

    status = _provider_status(provider_result)
    raw = provider_result.get("provider_raw", provider_result)
    result_details = details(raw) if details else {}
    if status in _PENDING:
        await asyncio.to_thread(
            update,
            {
                "reference": reference,
                "user_id": user_id,
                "environment": environment,
                "expected_statuses": ["processing"],
                "status": "pending",
                "session_reference": _provider_reference(raw),
            },
        )
        return {
            "success": True,
            "message": "Processing order",
            "data": {"reference": reference, **result_details, "status": "pending"},
        }
    if status in _FAILED:
        await asyncio.to_thread(
            refund,
            {
                "reference": reference,
                "user_id": user_id,
                "environment": environment,
                "target_status": "refunded",
                "expected_statuses": ["processing"],
                "reason": "Provider reported bill failure",
            },
        )
        raise HTTPException(status_code=400, detail="Bill payment failed")
    if status not in _SUCCESS:
        _LOGGER.error(
            "%s provider returned an unrecognized status for %s",
            bill_type,
            reference,
        )
        return {
            "success": True,
            "message": "Order submitted and pending confirmation",
            "data": {"reference": reference, "status": "pending"},
        }

    revenue = (
        fixed_revenue
        if fixed_revenue is not None
        else _provider_revenue(amount, raw)
    )
    await asyncio.to_thread(
        settle,
        {
            "reference": reference,
            "user_id": user_id,
            "environment": environment,
            "expected_statuses": ["processing"],
            "revenue": revenue,
            "session_reference": _provider_reference(raw),
            "metadata": result_details,
        },
    )
    if bill_type == "Airtime" and mode == "live":
        cashback = round(amount * 0.005, 2)
        if cashback > 0:
            await asyncio.to_thread(
                credit,
                {
                    "user_id": user_id,
                    "amount": cashback,
                    "type": "Bonus",
                    "service_name": "Airtime Cashback",
                    "wallet_type": "CASHBACK",
                    "environment": environment,
                    "session_reference": reference,
                    "narration": f"Cashback for {reference}",
                },
            )
    return {
        "success": True,
        "message": f"{bill_type} payment submitted successfully",
        "data": {"reference": reference, **result_details, "status": "success"},
    }


def _provider_status(result: Mapping[str, Any]) -> str:
    status = result.get("status")
    if isinstance(status, str):
        return status.strip().lower()
    return " ".join(
        str(result.get(key, ""))
        for key in ("Status", "status", "message", "description")
    ).lower()


def _provider_reference(raw: Any) -> str | None:
    if not isinstance(raw, Mapping):
        return None
    description = raw.get("description")
    values = (raw, description) if isinstance(description, Mapping) else (raw,)
    for candidate in values:
        for key in ("ident", "ReferenceID", "reference", "transactionId"):
            value = candidate.get(key)
            if value is not None and str(value).strip():
                return str(value).strip()
    return None


def _provider_revenue(amount: float, raw: Any) -> float:
    if not isinstance(raw, Mapping):
        return 0
    description = raw.get("description")
    if not isinstance(description, Mapping):
        description = raw
    try:
        before = float(description["Previous_Balance"])
        after = float(description["Current_Balance"])
    except (KeyError, TypeError, ValueError):
        return 0
    return max(0, round((amount - (before - after)) * 100) / 100)
