"""TediBloom campaign generation and promotional delivery task."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.lib.cache import get_cached_payload, store_cached_payload
from app.providers.ai.groq import GroqClient
from app.providers.calendar.calendarific import fetch_nigerian_holiday
from app.providers.sports.football import fetch_popular_matches
from app.providers.types import ProviderError
from app.services.notification.push import send_push_notification
from app.workers.shared import with_worker_lock

_LOGGER = logging.getLogger(__name__)
_LAGOS = ZoneInfo("Africa/Lagos")


async def send_tedibloom_promo(now: datetime | None = None) -> int:
    current = now or datetime.now(_LAGOS)
    if current.tzinfo is None:
        current = current.replace(tzinfo=ZoneInfo("UTC"))

    async def run() -> int:
        local_now = current.astimezone(_LAGOS)
        if local_now.hour >= 22 or local_now.hour < 7:
            return 0
        local_date = local_now.date().isoformat()
        if await asyncio.to_thread(
            get_cached_payload, "tediBloom.globalCooldown", "LIVE"
        ):
            return 0
        targets = await asyncio.to_thread(_promo_targets)
        eligible = []
        for target in targets:
            if not target["email"] and not target["phoneNumber"]:
                continue
            if not _marketing_enabled(target["settings"]):
                continue
            if await asyncio.to_thread(
                get_cached_payload, f"tediBloom.user.{target['userId']}", "LIVE"
            ):
                continue
            eligible.append(target)
        if not eligible:
            return 0
        promo = await generate_tedibloom_message(current, local_date)
        if promo is None:
            return 0

        sent = 0
        for target in eligible:
            first_name = str(target["firstName"] or "").strip().split()
            message = promo["message"].replace(
                "{firstName}", first_name[0] if first_name else "there"
            )
            try:
                result = await send_push_notification(
                    {
                        "email": target["email"],
                        "phone": target["phoneNumber"],
                        "title": promo["title"],
                        "message": message,
                    }
                )
            except Exception:
                _LOGGER.warning(
                    "TediBloom push delivery failed for user %s",
                    target["userId"],
                    exc_info=True,
                )
                continue
            if not result.get("success"):
                continue
            await asyncio.to_thread(
                store_cached_payload,
                f"tediBloom.user.{target['userId']}",
                {"sentAt": current.isoformat()},
                7 * 24 * 60 * 60,
                "LIVE",
            )
            sent += 1
        if sent:
            await asyncio.to_thread(
                store_cached_payload,
                "tediBloom.globalCooldown",
                {"date": local_date, "sent": sent},
                60 * 60,
                "LIVE",
            )
            await asyncio.to_thread(
                store_cached_payload,
                "tediBloom.campaign",
                {"date": local_date, **promo, "sent": sent},
                60 * 60,
                "LIVE",
            )
        return sent

    delivered = await with_worker_lock("worker.tediBloom", run)
    return delivered or 0


def _promo_targets() -> list[dict[str, Any]]:
    with get_database_engine().connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT users."userId", users."email", users."phoneNumber",
                       users."firstName", settings."settings"
                FROM "users" users
                LEFT JOIN "userSettings" settings
                  ON settings."userId" = users."userId"
                 AND settings."category" = 'notifications'
                WHERE users."status" = 'active' AND users."mode" = 'live'
                ORDER BY users."userId"
                LIMIT 1000
                """
            )
        ).mappings()
        return [dict(row) for row in rows]


def _marketing_enabled(value: Any) -> bool:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = {}
    if not isinstance(value, dict):
        return True
    return value.get("pushNotificationEnabled") not in (False, 0, "false", "0")


async def generate_tedibloom_message(
    now: datetime, local_date: str
) -> dict[str, str] | None:
    context: dict[str, Any] = {"date": local_date}
    try:
        holiday = await fetch_nigerian_holiday(now)
    except ProviderError:
        _LOGGER.warning("Unable to load public holiday context for TediBloom")
        holiday = None
    if holiday:
        context["holiday"] = holiday
    try:
        matches = await fetch_popular_matches(now)
    except ProviderError:
        _LOGGER.warning("Unable to load football context for TediBloom")
        matches = []
    if matches:
        context["popularMatches"] = [
            {
                "homeTeam": match["homeTeam"],
                "awayTeam": match["awayTeam"],
                "competition": match["competition"],
            }
            for match in matches[:3]
        ]

    client = await asyncio.to_thread(
        GroqClient.from_database,
        "openai/gpt-oss-20b",
        20_000,
    )
    if not client.get_api_key():
        return None
    result = await client.send_json(
        [
            {
                "role": "system",
                "content": (
                    "Write a brief, responsible Tediwave product-awareness push. "
                    "Do not promise returns, give financial advice, create urgency, "
                    "or mention data not present in context. Return JSON with string "
                    "fields title and message. message must include the literal "
                    "placeholder {firstName} and be under 180 characters."
                ),
            },
            {"role": "user", "content": json.dumps(context)},
        ],
        temperature=0.4,
        max_tokens=180,
        retries=1,
    )
    if not result.get("success"):
        _LOGGER.warning("TediBloom message generation failed: %s", result.get("error"))
        return None
    try:
        parsed = json.loads(result["content"])
    except (KeyError, json.JSONDecodeError):
        return None
    if (
        not isinstance(parsed, dict)
        or not isinstance(parsed.get("title"), str)
        or not isinstance(parsed.get("message"), str)
    ):
        return None
    title = parsed["title"].strip()[:80]
    message = parsed["message"].strip()[:180]
    if not title or "{firstName}" not in message:
        return None
    return {"title": title, "message": message}


if __name__ == "__main__":
    asyncio.run(send_tedibloom_promo())
