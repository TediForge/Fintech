"""Scheduled birthday notification task."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.services.notification.push import send_push_notification
from app.workers.shared import with_worker_lock

_LOGGER = logging.getLogger(__name__)
_LAGOS = ZoneInfo("Africa/Lagos")
_BIRTHDAY_MESSAGES = (
    "Wishing you a wonderful birthday, {name}. Thank you for being part of Tediwave.",
    "Happy birthday, {name}. We hope your year ahead is full of good things.",
    "Have a lovely birthday, {name}. Tediwave is glad to be part of your journey.",
    "Happy birthday, {name}. Wishing you a bright and peaceful year ahead.",
    "Celebrating you today, {name}. Have a great birthday.",
)


async def send_birthday_wishes(now: datetime | None = None) -> int:
    async def run() -> int:
        current = now or datetime.now(_LAGOS)
        if current.tzinfo is None:
            current = current.replace(tzinfo=ZoneInfo("UTC"))
        local = current.astimezone(_LAGOS)
        if local.hour != 9:
            return 0
        users = await asyncio.to_thread(
            _birthday_targets, local.month, local.day, local.year
        )
        delivered = 0
        for user in users:
            if not _push_enabled(user["settings"]):
                continue
            claimed = await asyncio.to_thread(
                _claim_birthday, user["userId"], local.year
            )
            if not claimed:
                continue
            first_name = str(user["firstName"] or "").strip().split()
            name = first_name[0] if first_name else "there"
            message = _BIRTHDAY_MESSAGES[
                (local.year + int(user["userId"])) % len(_BIRTHDAY_MESSAGES)
            ].replace("{name}", name)
            if not user["email"] and not user["phoneNumber"]:
                continue
            try:
                result = await send_push_notification(
                    {
                        "email": user["email"],
                        "phone": user["phoneNumber"],
                        "title": "Happy birthday",
                        "message": message,
                    }
                )
            except Exception:
                _LOGGER.warning(
                    "Birthday push delivery failed for user %s",
                    user["userId"],
                    exc_info=True,
                )
                continue
            if result.get("success"):
                delivered += 1
        return delivered

    count = await with_worker_lock("worker.birthdays", run)
    return count or 0


def _birthday_targets(month: int, day: int, year: int) -> list[dict[str, Any]]:
    with get_database_engine().connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT users."userId", users."firstName", users."email",
                       users."phoneNumber", settings."settings"
                FROM "users" users
                LEFT JOIN "userSettings" settings
                  ON settings."userId" = users."userId"
                 AND settings."category" = 'notifications'
                WHERE users."status" = 'active' AND users."mode" = 'live'
                  AND users."dateOfBirth" IS NOT NULL
                  AND EXTRACT(MONTH FROM users."dateOfBirth") = :month
                  AND EXTRACT(DAY FROM users."dateOfBirth") = :day
                  AND COALESCE(users."lastBirthdayWishYear", 0) < :year
                  AND EXISTS (
                      SELECT 1 FROM "pushTokens" tokens
                      WHERE tokens."userId" = users."userId"
                        AND tokens."isActive" = TRUE
                  )
                ORDER BY users."userId"
                """
            ),
            {
                "month": month,
                "day": day,
                "year": year,
            },
        ).mappings()
        return [dict(row) for row in rows]


def _claim_birthday(user_id: int, year: int) -> bool:
    with get_database_engine().begin() as connection:
        result = connection.execute(
            text(
                """
                UPDATE "users" SET "lastBirthdayWishYear" = :year
                WHERE "userId" = :user_id
                  AND COALESCE("lastBirthdayWishYear", 0) < :year
                """
            ),
            {"user_id": user_id, "year": year},
        )
        return result.rowcount == 1


def _push_enabled(value: Any) -> bool:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = {}
    if not isinstance(value, dict):
        return True
    setting = value.get("pushNotificationEnabled")
    return setting not in (False, 0, "false", "0", "no", "off")


if __name__ == "__main__":
    asyncio.run(send_birthday_wishes())
