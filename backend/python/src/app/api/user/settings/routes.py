"""User security and notification settings."""

import asyncio
import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict

from app.api.deps import require_user
from database.db_01.common import execute_statement, query_rows

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]
_SETTINGS = {
    "mfaAccess": ("security", "mfaAccessEnabled"),
    "inAppAccess": ("security", "inAppAccessEnabled"),
    "pushAccess": ("security", "pushAccessEnabled"),
    "ussdAccess": ("security", "ussdAccessEnabled"),
    "emailNotification": ("notifications", "emailNotificationEnabled"),
    "pushNotification": ("notifications", "pushNotificationEnabled"),
    "transactionEmail": ("transaction_notifications", "transactionEmailEnabled"),
    "transactionInApp": ("transaction_notifications", "transactionInAppEnabled"),
    "transactionPush": ("transaction_notifications", "transactionPushEnabled"),
    "transactionSms": ("transaction_notifications", "transactionSmsEnabled"),
}


class SettingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    setting: str
    enabled: bool | None = None


def _settings(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}
    return value if isinstance(value, dict) else {}


@router.get("/")
async def get_setting(
    request: Request, auth: AuthenticatedUser
) -> dict[str, Any]:
    setting = request.query_params.get("setting", "")
    config = _SETTINGS.get(setting)
    if config is None:
        raise HTTPException(status_code=400, detail="A valid setting is required")
    rows = await asyncio.to_thread(
        query_rows,
        """
        SELECT "settings", "updatedAt" FROM "userSettings"
        WHERE "userId" = :user_id AND "category" = :category LIMIT 1
        """,
        {"user_id": auth["user_id"], "category": config[0]},
    )
    values = _settings(rows[0].get("settings") if rows else None)
    return {
        "status": "success",
        "message": "Setting processed successfully",
        "details": {
            "setting": setting,
            "category": config[0],
            "enabled": _as_bool(values.get(config[1], True)),
            "lastUpdate": rows[0].get("updatedAt") if rows else None,
        },
    }


@router.patch("/")
async def update_setting(
    payload: SettingUpdate, auth: AuthenticatedUser
) -> dict[str, Any]:
    config = _SETTINGS.get(payload.setting)
    if config is None:
        raise HTTPException(status_code=400, detail="A valid setting is required")

    def update() -> tuple[dict[str, Any], str | None]:
        rows = query_rows(
            """
            SELECT "id", "settings" FROM "userSettings"
            WHERE "userId" = :user_id AND "category" = :category LIMIT 1
            """,
            {"user_id": auth["user_id"], "category": config[0]},
        )
        values = _settings(rows[0].get("settings") if rows else None)
        if payload.enabled is not None:
            values[config[1]] = payload.enabled
        encoded = json.dumps(values)
        if rows:
            execute_statement(
                'UPDATE "userSettings" SET "settings" = CAST(:settings AS JSONB), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = :id',
                {"settings": encoded, "id": rows[0]["id"]},
            )
        else:
            execute_statement(
                'INSERT INTO "userSettings" ("userId", "category", "settings", "updatedAt") VALUES (:user_id, :category, CAST(:settings AS JSONB), CURRENT_TIMESTAMP)',
                {
                    "user_id": auth["user_id"],
                    "category": config[0],
                    "settings": encoded,
                },
            )
        return values, None

    values, _ = await asyncio.to_thread(update)
    return {
        "status": "success",
        "message": "Setting processed successfully",
        "details": {
            "setting": payload.setting,
            "category": config[0],
            "enabled": _as_bool(values.get(config[1], True)),
        },
    }


def _as_bool(value: Any) -> bool:
    return value in (True, 1, "1", "true", "yes", "on")
