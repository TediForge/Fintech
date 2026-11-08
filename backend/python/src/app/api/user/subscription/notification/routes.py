"""Push-token and webhook configuration endpoints."""

import asyncio
import secrets
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import text

from app.api.deps import require_user
from database.db_01.connection import get_database_engine
from app.services.notification.push.service import save_push_token
from app.services.notification.webhook import validate_public_https_url

router = APIRouter()
_PLATFORMS = {"android", "ios", "web"}


class PushSubscription(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    token: str = Field(min_length=1, max_length=8192)
    platform: Literal["android", "ios", "web"]
    provider: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9-]{1,29}$")

    @field_validator("provider", mode="before")
    @classmethod
    def normalize_provider(cls, value: Any) -> Any:
        return value.strip().lower() if isinstance(value, str) else value


class WebhookUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    url: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=150)
    isActive: bool | None = None
    regenerateSecret: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def reject_null_values(cls, value: Any) -> Any:
        if isinstance(value, dict) and any(
            key in value and value[key] is None
            for key in ("url", "isActive", "regenerateSecret")
        ):
            raise ValueError("Webhook configuration update is invalid")
        return value


@router.get("/push")
async def list_push_subscriptions(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    rows = await asyncio.to_thread(
        _query_rows,
        """
        SELECT "platform", "provider", "isActive", "createdAt", "updatedAt"
        FROM "pushTokens" WHERE "userId" = :user_id ORDER BY "platform"
        """,
        {"user_id": auth["user_id"]},
    )
    return {
        "success": True,
        "status": 200,
        "message": "Push subscriptions retrieved",
        "data": {"subscriptions": rows},
    }


@router.post("/push")
async def register_push_subscription(
    payload: PushSubscription,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    token = payload.token.strip()
    provider = payload.provider or (
        "expo"
        if token.startswith(("ExpoPushToken[", "ExponentPushToken["))
        else "web-push"
        if payload.platform == "web"
        else "fcm"
    )
    if provider == "expo" and not (
        token.startswith(("ExpoPushToken[", "ExponentPushToken[")) and token.endswith("]")
    ):
        raise HTTPException(status_code=400, detail="Expo push token is invalid")
    try:
        await save_push_token(
            user_id=auth["user_id"],
            token=token,
            platform=payload.platform,
            provider=provider,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {
        "success": True,
        "status": 200,
        "message": "Push subscription saved",
        "data": {"platform": payload.platform, "provider": provider, "isActive": True},
    }


@router.delete("/push/{platform}")
async def remove_push_subscription(
    platform: str,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    if platform not in _PLATFORMS:
        raise HTTPException(status_code=400, detail="Platform must be android, ios, or web")

    def update() -> bool:
        with get_database_engine().begin() as connection:
            result = connection.execute(
                text(
                    """
                    UPDATE "pushTokens"
                    SET "isActive" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
                    WHERE "userId" = :user_id AND "platform" = :platform
                      AND "isActive" = TRUE
                    """
                ),
                {"user_id": auth["user_id"], "platform": platform},
            )
            return bool(result.rowcount)

    removed = await asyncio.to_thread(update)
    return {
        "success": True,
        "status": 200,
        "message": "Push subscription removed",
        "data": {"platform": platform, "removed": removed},
    }


@router.get("/webhook")
async def get_webhook(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    rows = await asyncio.to_thread(
        _query_rows,
        """
        SELECT "url", "secret", "isActive", "description", "lastSuccessAt",
               "lastFailureAt", "failureCount", "createdAt", "updatedAt"
        FROM "userWebhooks"
        WHERE "userId" = :user_id AND "environment" = :environment
        LIMIT 1
        """,
        {"user_id": auth["user_id"], "environment": _environment(auth)},
    )
    if not rows:
        return {
            "success": True,
            "message": "No webhook is configured for this environment",
            "data": {"configured": False, "environment": _environment(auth)},
        }
    webhook = rows[0]
    return {
        "success": True,
        "message": "Webhook configuration retrieved successfully",
        "data": {
            "configured": True,
            "environment": _environment(auth),
            "url": webhook["url"],
            "isActive": bool(webhook["isActive"]),
            "description": webhook["description"],
            "secret": _mask_secret(str(webhook["secret"])),
            "lastSuccessAt": webhook["lastSuccessAt"],
            "lastFailureAt": webhook["lastFailureAt"],
            "failureCount": int(webhook["failureCount"]),
            "createdAt": webhook["createdAt"],
            "updatedAt": webhook["updatedAt"],
        },
    }


@router.post("/webhook")
@router.put("/webhook")
@router.patch("/webhook")
async def save_webhook(
    payload: WebhookUpdate,
    response: Response,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    if not payload.model_fields_set:
        raise HTTPException(status_code=400, detail="Webhook configuration update is invalid")
    environment = _environment(auth)
    rows = await asyncio.to_thread(
        _query_rows,
        """
        SELECT "url", "secret", "isActive", "description"
        FROM "userWebhooks"
        WHERE "userId" = :user_id AND "environment" = :environment
        LIMIT 1
        """,
        {"user_id": auth["user_id"], "environment": environment},
    )
    existing = rows[0] if rows else None
    url_value = payload.url or (str(existing["url"]) if existing else "")
    if not url_value:
        raise HTTPException(status_code=400, detail="Webhook URL is required")
    try:
        url = await asyncio.to_thread(validate_public_https_url, url_value)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    created = existing is None
    reveal_secret = created or payload.regenerateSecret is True
    secret = (
        secrets.token_urlsafe(48)
        if reveal_secret
        else str(existing["secret"])
    )
    is_active = (
        payload.isActive
        if payload.isActive is not None
        else bool(existing["isActive"]) if existing else True
    )
    description = (
        payload.description
        if "description" in payload.model_fields_set
        else existing["description"] if existing else None
    )

    def upsert() -> None:
        with get_database_engine().begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO "userWebhooks"
                        ("userId", "environment", "url", "secret", "isActive", "description")
                    VALUES
                        (:user_id, :environment, :url, :secret, :is_active, :description)
                    ON CONFLICT ("userId", "environment") DO UPDATE SET
                        "url" = EXCLUDED."url",
                        "secret" = EXCLUDED."secret",
                        "isActive" = EXCLUDED."isActive",
                        "description" = EXCLUDED."description",
                        "updatedAt" = CURRENT_TIMESTAMP
                    """
                ),
                {
                    "user_id": auth["user_id"],
                    "environment": environment,
                    "url": url,
                    "secret": secret,
                    "is_active": is_active,
                    "description": description,
                },
            )

    await asyncio.to_thread(upsert)
    response.status_code = 201 if created else 200
    return {
        "success": True,
        "message": (
            "Webhook configuration created successfully"
            if created
            else "Webhook configuration updated successfully"
        ),
        "data": {
            "environment": environment,
            "url": url,
            "isActive": is_active,
            "description": description,
            "secret": secret if reveal_secret else _mask_secret(secret),
            "secretShownOnce": reveal_secret,
        },
    }


@router.delete("/webhook")
async def disable_webhook(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    environment = _environment(auth)

    def update() -> bool:
        with get_database_engine().begin() as connection:
            result = connection.execute(
                text(
                    """
                    UPDATE "userWebhooks"
                    SET "isActive" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
                    WHERE "userId" = :user_id AND "environment" = :environment
                      AND "isActive" = TRUE
                    """
                ),
                {"user_id": auth["user_id"], "environment": environment},
            )
            return bool(result.rowcount)

    disabled = await asyncio.to_thread(update)
    return {
        "success": True,
        "message": (
            "Webhook disabled successfully"
            if disabled
            else "No active webhook was configured"
        ),
        "data": {"environment": environment, "isActive": False},
    }


def _query_rows(statement: str, parameters: dict[str, Any]) -> list[dict[str, Any]]:
    with get_database_engine().connect() as connection:
        rows = connection.execute(text(statement), parameters).mappings()
        return [dict(row) for row in rows]


def _environment(auth: dict[str, Any]) -> Literal["LIVE", "TEST"]:
    environment = str(auth.get("environment", "LIVE")).upper()
    if environment not in {"LIVE", "TEST"}:
        raise HTTPException(status_code=401, detail="Authentication is required")
    return "TEST" if environment == "TEST" else "LIVE"


def _mask_secret(secret: str) -> str:
    if len(secret) <= 8:
        return "*" * len(secret)
    return f"{secret[:4]}{'*' * max(4, len(secret) - 8)}{secret[-4:]}"
