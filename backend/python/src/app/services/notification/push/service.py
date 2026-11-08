"""Push notification targeting and dispatch service."""

import asyncio
from collections.abc import Awaitable, Callable, Mapping
from typing import Any, Literal

from sqlalchemy import text

from app.services.notification.shared import (
    find_notification_user,
    is_notification_setting_enabled,
)
from database.db_01.connection import get_database_engine

PushTarget = dict[str, Any]
PushTransport = Callable[[PushTarget, str, str], Awaitable[bool]]
PushPlatform = Literal["android", "ios", "web"]


class PushSender:
    """Push dispatcher with injectable transports and configured FCM default."""

    def __init__(self, transports: Mapping[str, PushTransport] | None = None) -> None:
        self._transports = {
            key.lower(): value for key, value in (transports or {}).items()
        }

    async def send(self, input: Mapping[str, Any]) -> dict[str, Any]:
        return await send_push_notification(input, transports=self._transports)


async def save_push_token(
    *,
    user_id: int,
    token: str,
    platform: PushPlatform,
    provider: str,
) -> None:
    normalized_token = token.strip()
    if not normalized_token:
        return
    if platform not in {"android", "ios", "web"}:
        raise ValueError("Push token platform is invalid")
    if not provider.strip():
        raise ValueError("Push token provider is required")

    def save() -> None:
        with get_database_engine().begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO "pushTokens"
                        ("userId", "token", "platform", "provider", "isActive")
                    VALUES (:user_id, :token, :platform, :provider, TRUE)
                    ON CONFLICT ("userId", "platform") DO UPDATE SET
                        "token" = EXCLUDED."token",
                        "provider" = EXCLUDED."provider",
                        "isActive" = TRUE,
                        "updatedAt" = CURRENT_TIMESTAMP
                    """
                ),
                {
                    "user_id": user_id,
                    "token": normalized_token,
                    "platform": platform,
                    "provider": provider,
                },
            )

    await asyncio.to_thread(save)


async def get_active_push_targets(user_id: int) -> list[PushTarget]:
    return await asyncio.to_thread(_get_active_push_targets, user_id)


async def get_active_push_targets_for_broadcast() -> list[PushTarget]:
    return await asyncio.to_thread(_get_active_push_targets_for_broadcast)


async def send_push_notification(
    input: Mapping[str, Any],
    *,
    transports: Mapping[str, PushTransport] | None = None,
) -> dict[str, Any]:
    message = input.get("message")
    if not isinstance(message, str) or not message.strip():
        raise TypeError("Push notification message is required")
    phone = input.get("phone")
    email = input.get("email")
    if (isinstance(phone, str) and phone.strip()) or (
        isinstance(email, str) and email.strip()
    ):
        targets = await asyncio.to_thread(_find_recipient_targets, phone, email)
    else:
        targets = await asyncio.to_thread(_get_active_push_targets_for_broadcast)

    unique = {
        (target["userId"], target["platform"]): target for target in targets
    }
    targets = list(unique.values())
    if not targets:
        return {
            "success": False,
            "message": "No active notification token found",
            "data": {"notificationsSent": 0, "totalTokens": 0},
        }
    dispatch = {key.lower(): value for key, value in (transports or {}).items()}
    if not dispatch:
        from app.services.notification.push.transport import FcmTransport

        try:
            dispatch = {"fcm": FcmTransport()}
        except (ValueError, RuntimeError) as error:
            raise RuntimeError(
                "Push delivery is disabled; configure FCM credentials."
            ) from error

    title = input.get("title")
    title = title.strip() if isinstance(title, str) and title.strip() else "Message from Tediwave"
    results = await asyncio.gather(
        *(
            dispatch[target["provider"].lower()](target, title, message)
            if target["provider"].lower() in dispatch
            else _unsupported_target()
            for target in targets
        )
    )
    sent = sum(bool(result) for result in results)
    return {
        "success": sent > 0,
        "message": f"Sent to {sent} out of {len(targets)} devices",
        "data": {"notificationsSent": sent, "totalTokens": len(targets)},
    }


def _find_recipient_targets(
    phone: Any, email: Any
) -> list[PushTarget]:
    user = find_notification_user(
        phone if isinstance(phone, str) else None,
        email if isinstance(email, str) else None,
    )
    if not user:
        return []
    user_id = user["userId"]
    if not is_notification_setting_enabled(
        user_id, "security", "pushAccessEnabled"
    ):
        return []
    return _get_active_push_targets(user_id)


def _get_active_push_targets(user_id: int) -> list[PushTarget]:
    with get_database_engine().connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT "userId", "token", "platform", "provider"
                FROM "pushTokens"
                WHERE "userId" = :user_id AND "isActive" = TRUE
                """
            ),
            {"user_id": user_id},
        ).mappings()
        return [dict(row) for row in rows]


def _get_active_push_targets_for_broadcast() -> list[PushTarget]:
    with get_database_engine().connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT DISTINCT p."userId", p."token", p."platform", p."provider"
                FROM "pushTokens" p
                LEFT JOIN "userSettings" s
                    ON s."userId" = p."userId" AND s."category" = 'security'
                WHERE p."isActive" = TRUE
                  AND (
                    s."settings" ->> 'pushAccessEnabled' IS NULL
                    OR LOWER(s."settings" ->> 'pushAccessEnabled')
                        IN ('1', 'true', 'yes', 'on')
                  )
                """
            )
        ).mappings()
        return [dict(row) for row in rows]


async def _unsupported_target() -> bool:
    return False
