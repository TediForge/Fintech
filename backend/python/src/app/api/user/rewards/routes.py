"""Daily task progress and cashback reward claims."""

import asyncio
import json
from datetime import UTC, date, datetime
from importlib.resources import files
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text

from app.api.deps import require_user
from database.db_01.connection import get_database_engine
from app.services.ledger.exceptions import LedgerError
from app.services.ledger.service import with_ledger_transaction

router = APIRouter()
_TASK_DATA = json.loads(
    files("app.data").joinpath("tasks.json").read_text(encoding="utf-8")
)
_TASKS: dict[str, dict[str, Any]] = _TASK_DATA["dailyTasks"]


class ClaimRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["claimTask", "claim_task"] = "claimTask"
    taskKey: str


@router.get("/")
async def list_daily_tasks(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    environment = _environment(auth)
    tasks = await asyncio.to_thread(_task_progress, auth["user_id"], environment)
    return {
        "status": "success",
        "message": "Tasks retrieved successfully",
        "tasks": tasks,
    }


@router.post("/")
async def claim_daily_task(
    payload: ClaimRequest,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    environment = _environment(auth)
    user_id = auth["user_id"]
    if payload.taskKey not in _TASKS:
        raise HTTPException(status_code=400, detail="Invalid reward action")
    tasks = await asyncio.to_thread(_task_progress, user_id, environment)
    task = tasks.get(payload.taskKey)
    if task is None:
        raise HTTPException(
            status_code=403, detail="Task not assigned to you today so access is denied"
        )
    if task["status"] != "claim":
        raise HTTPException(status_code=400, detail="Task not eligible for claim yet")

    claim_key = f"{user_id}:{datetime.now(UTC).date().isoformat()}:{payload.taskKey}"
    reward = _TASKS[payload.taskKey]["reward"]

    def claim() -> str | None:
        def operation(ledger: Any) -> str | None:
            ledger.execute(
                "SELECT pg_advisory_xact_lock(hashtext(:claim_key))",
                {"claim_key": claim_key},
            )
            claimed = ledger.execute(
                text(
                    """
                    SELECT 1 FROM "dailyTaskClaims"
                    WHERE "claimKey" = :claim_key AND "userId" = :user_id
                      AND "environment" = :environment LIMIT 1
                    """
                ),
                {
                    "claim_key": claim_key,
                    "user_id": user_id,
                    "environment": environment,
                },
            ).first()
            if claimed:
                return None
            entry = ledger.credit(
                {
                    "user_id": user_id,
                    "amount": reward,
                    "type": "Bonus",
                    "service_name": "Daily Task Reward",
                    "wallet_type": "CASHBACK",
                    "environment": environment,
                    "narration": f"Reward for completing daily {payload.taskKey} task",
                }
            )
            ledger.execute(
                text(
                    """
                    INSERT INTO "dailyTaskClaims"
                        ("userId", "environment", "claimKey", "taskKey",
                         "transactionReference")
                    VALUES (:user_id, :environment, :claim_key, :task_key, :reference)
                    """
                ),
                {
                    "user_id": user_id,
                    "environment": environment,
                    "claim_key": claim_key,
                    "task_key": payload.taskKey,
                    "reference": entry["reference"],
                },
            )
            return entry["reference"]

        return with_ledger_transaction(operation)

    try:
        reference = await asyncio.to_thread(claim)
    except LedgerError as error:
        raise HTTPException(status_code=error.status, detail=str(error)) from error
    if reference is None:
        raise HTTPException(status_code=409, detail="Task reward has already been claimed")
    return {
        "status": "success",
        "message": "Reward claimed successfully",
        "reward": reward,
        "reference": reference,
    }


def _task_progress(user_id: int, environment: str) -> dict[str, dict[str, Any]]:
    today = datetime.now(UTC).date()
    day = today.isoformat()
    day_index = (today - date(1970, 1, 1)).days
    assigned = sorted(
        _TASKS,
        key=lambda key: _fnv_hash(f"{user_id}:{day}:{key}"),
    )[:3]
    with get_database_engine().connect() as connection:
        tasks: dict[str, dict[str, Any]] = {}
        for key in assigned:
            config = _TASKS[key]
            max_step = config["maxStep"] + (
                (day_index + (_fnv_hash(f"{user_id}:{key}") % 2)) % 2
            )
            claim_key = f"{user_id}:{day}:{key}"
            claimed = connection.execute(
                text(
                    """
                    SELECT 1 FROM "dailyTaskClaims"
                    WHERE "claimKey" = :claim_key AND "userId" = :user_id
                      AND "environment" = :environment LIMIT 1
                    """
                ),
                {
                    "claim_key": claim_key,
                    "user_id": user_id,
                    "environment": environment,
                },
            ).first()
            current = _task_count(connection, key, user_id, environment, day)
            tasks[key] = {
                **config,
                "current_step": min(current, max_step),
                "max_step": max_step,
                "status": (
                    "claimed" if claimed else "claim" if current >= max_step else "go"
                ),
            }
    return tasks


def _task_count(connection: Any, key: str, user_id: int, environment: str, day: str) -> int:
    conditions = {
        "airtime": """
            LOWER("direction") = 'debit' AND LOWER("type") = 'airtime'
            AND "amount" >= 100
        """,
        "fund": """
            UPPER("walletType") = 'MAIN' AND LOWER("direction") = 'credit'
            AND LOWER("type") <> 'bonus'
        """,
        "data_purchase": "LOWER(\"type\") = 'data'",
        "electricity": """
            LOWER("type") = 'electricity' AND "amount" >= 1000
        """,
    }
    aggregate = "COALESCE(SUM(\"amount\"), 0)" if key == "fund" else "COUNT(*)"
    value = connection.execute(
        text(
            f"""
            SELECT {aggregate} AS current FROM "transactions"
            WHERE "userId" = :user_id AND "environment" = :environment
              AND {conditions[key]} AND LOWER("status") = 'successful'
              AND CAST("createdAt" AS DATE) = :day
            """
        ),
        {"user_id": user_id, "environment": environment, "day": day},
    ).scalar_one()
    current = float(value or 0)
    return int(current >= 2000) if key == "fund" else int(current)


def _fnv_hash(value: str) -> int:
    result = 2166136261
    for character in value:
        result = ((result ^ ord(character)) * 16777619) & 0xFFFFFFFF
    return result


def _environment(auth: dict[str, Any]) -> Literal["LIVE", "TEST"]:
    environment = str(auth.get("environment", "LIVE")).upper()
    if environment not in {"LIVE", "TEST"}:
        raise HTTPException(status_code=401, detail="Authentication is required")
    return "TEST" if environment == "TEST" else "LIVE"
