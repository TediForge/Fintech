"""Referral, campaign, and promotion-code resolution."""

import json
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict
from urllib.parse import quote

from sqlalchemy import text

from database.db_01.connection import get_database_engine


class ReferralCodeError(Exception):
    """Referral error with an API-compatible HTTP status."""

    def __init__(self, message: str, status: int = 404) -> None:
        super().__init__(message)
        self.status = status


class ReferralTarget(TypedDict):
    type: Literal["referral", "campaign", "promo"]
    referralCode: str
    referralLink: str
    campaignCode: str
    campaignName: str
    campaignLink: str
    promoCode: str
    promoName: Any
    expiresAt: Any
    ownerUserId: int
    valid: Literal[True]


def resolve_referral_target(input: str) -> ReferralTarget | None:
    code = input.strip()
    if not code:
        return None
    with get_database_engine().connect() as connection:
        user = connection.execute(
            text(
                """
                SELECT "referralCode" FROM "users"
                WHERE LOWER("referralCode") = LOWER(:code)
                LIMIT 1
                """
            ),
            {"code": code},
        ).mappings().first()
        if user:
            referral_code = user["referralCode"]
            return {
                "type": "referral",
                "referralCode": referral_code,
                "referralLink": _referral_link(referral_code),
                "campaignCode": "",
                "campaignName": "",
                "campaignLink": "",
                "promoCode": "",
                "promoName": None,
                "expiresAt": None,
                "ownerUserId": 0,
                "valid": True,
            }
        campaign = _find_active_campaign(connection, code)
        if campaign:
            campaign_code = campaign["campaignCode"]
            return {
                "type": "campaign",
                "referralCode": "",
                "referralLink": "",
                "campaignCode": campaign_code,
                "campaignName": campaign["name"],
                "campaignLink": _referral_link(campaign_code),
                "promoCode": "",
                "promoName": None,
                "expiresAt": None,
                "ownerUserId": 0,
                "valid": True,
            }
        return _find_active_promo(connection, code)


def validate_registration_referral(value: Any) -> str | None:
    code = value.strip() if isinstance(value, str) else ""
    if not code:
        return None
    if resolve_referral_target(code) is None:
        raise ReferralCodeError("The referral code is invalid or expired")
    return code


def create_unique_referral_code(email: str) -> str:
    prefix = _referral_prefix(email)
    with get_database_engine().connect() as connection:
        for _ in range(25):
            code = _next_referral_code(prefix)
            existing = connection.execute(
                text(
                    'SELECT "referralCode" FROM "users" '
                    'WHERE "referralCode" = :code LIMIT 1'
                ),
                {"code": code},
            ).first()
            if existing is None:
                return code
    raise RuntimeError("Unable to allocate a referral code")


def ensure_user_referral_code(user_id: int) -> str:
    with get_database_engine().begin() as connection:
        user = connection.execute(
            text(
                """
                SELECT "email", "referralCode" FROM "users"
                WHERE "userId" = :user_id LIMIT 1 FOR UPDATE
                """
            ),
            {"user_id": user_id},
        ).mappings().first()
        if user is None:
            raise ReferralCodeError("User profile was not found", 404)
        current_code = user["referralCode"]
        if isinstance(current_code, str) and current_code.strip():
            return current_code.strip()
        prefix = _referral_prefix(user["email"] or "")
        for _ in range(25):
            code = _next_referral_code(prefix)
            exists = connection.execute(
                text(
                    'SELECT 1 FROM "users" WHERE "referralCode" = :code LIMIT 1'
                ),
                {"code": code},
            ).first()
            if exists:
                continue
            result = connection.execute(
                text(
                    """
                    UPDATE "users" SET "referralCode" = :code
                    WHERE "userId" = :user_id
                      AND ("referralCode" IS NULL OR "referralCode" = '')
                    """
                ),
                {"code": code, "user_id": user_id},
            )
            if result.rowcount == 1:
                return code
            updated = connection.execute(
                text('SELECT "referralCode" FROM "users" WHERE "userId" = :user_id'),
                {"user_id": user_id},
            ).scalar_one_or_none()
            if isinstance(updated, str) and updated.strip():
                return updated.strip()
        raise RuntimeError("Unable to allocate a referral code")


def _find_active_campaign(connection: Any, code: str) -> Any:
    return connection.execute(
        text(
            """
            SELECT "campaignCode", "name"
            FROM "referralCampaigns"
            WHERE LOWER("campaignCode") = LOWER(:code)
              AND "status" = 'active'
              AND ("startDate" IS NULL OR "startDate" <= CURRENT_DATE)
              AND ("endDate" IS NULL OR "endDate" >= CURRENT_DATE)
            LIMIT 1
            """
        ),
        {"code": code},
    ).mappings().first()


def _find_active_promo(connection: Any, code: str) -> ReferralTarget | None:
    profiles = connection.execute(
        text(
            """
            SELECT "userId", "promotionCodes"
            FROM "referralProfiles"
            ORDER BY "createdAt" DESC
            """
        )
    ).mappings()
    for profile in profiles:
        promo = next(
            (
                entry
                for entry in _parse_array(profile["promotionCodes"])
                if str(entry.get("promoCode", "")).lower() == code.lower()
                and entry.get("status") == "active"
            ),
            None,
        )
        if promo is None:
            continue
        expires_at = promo.get("expiresAt")
        if isinstance(expires_at, str):
            try:
                parsed_expiration = datetime.fromisoformat(
                    expires_at.replace("Z", "+00:00")
                )
            except ValueError:
                parsed_expiration = None
            if parsed_expiration is not None:
                if parsed_expiration.tzinfo is None:
                    parsed_expiration = parsed_expiration.replace(tzinfo=timezone.utc)
                if parsed_expiration <= datetime.now(timezone.utc):
                    continue
        campaign_code = promo.get("campaignCode")
        if not isinstance(campaign_code, str) or not campaign_code:
            continue
        if _find_active_campaign(connection, campaign_code) is None:
            continue
        return {
            "type": "promo",
            "referralCode": "",
            "referralLink": "",
            "campaignCode": campaign_code,
            "campaignName": "",
            "campaignLink": "",
            "promoCode": code,
            "promoName": promo.get("promoName"),
            "expiresAt": expires_at,
            "ownerUserId": int(profile["userId"]),
            "valid": True,
        }
    return None


def _referral_link(code: str) -> str:
    return f"https://tediwave.com/r/{quote(code, safe='')}"


def _parse_array(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    if not isinstance(value, list):
        return []
    return [entry for entry in value if isinstance(entry, dict)]


def _referral_prefix(email: str) -> str:
    return re.sub("[^A-Za-z]", "", email)[:3].upper().ljust(3, "X")


def _next_referral_code(prefix: str) -> str:
    return f"{prefix}{secrets.randbelow(90_000) + 10_000}"
