"""Referral dashboard, campaign enrollment, tracking, and invitations."""

import asyncio
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text

from app.api.deps import require_user
from database.db_01.connection import get_database_engine
from app.lib.referrals import ensure_user_referral_code, resolve_referral_target
from app.services.notification.mail.service import (
    EmailNotificationError,
    send_email_notification,
)

router = APIRouter()


class ReferralTrackRequest(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    code: str | None = None
    referralCode: str | None = None
    referral_code: str | None = None
    campaignCode: str | None = None
    campaign_code: str | None = None


class InviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    emails: str | list[str]

    @field_validator("emails")
    @classmethod
    def validate_emails(cls, value: str | list[str]) -> str | list[str]:
        emails = value if isinstance(value, list) else [value]
        if not emails or len(emails) > 50 or any(
            not _valid_email(email.strip()) for email in emails
        ):
            raise ValueError("Invite email payload is invalid")
        return value


class CampaignJoinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    source: str = Field(default="web", max_length=100)


@router.get("/")
async def referral_dashboard(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    try:
        data = await asyncio.to_thread(
            _referral_dashboard, auth["user_id"], _environment(auth)
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {
        "success": True,
        "status": "success",
        "message": "Referral data retrieved successfully",
        "data": data,
    }


@router.post("/track")
async def track_referral(
    payload: ReferralTrackRequest,
    request: Request,
) -> dict[str, Any]:
    code = next(
        (
            value.strip()
            for value in (
                payload.code,
                payload.referralCode,
                payload.referral_code,
                payload.campaignCode,
                payload.campaign_code,
            )
            if isinstance(value, str) and value.strip()
        ),
        "",
    )
    if not code:
        raise HTTPException(
            status_code=400,
            detail="referralCode or campaignCode is required for tracking",
        )
    target = await asyncio.to_thread(resolve_referral_target, code)
    if target is None:
        raise HTTPException(
            status_code=404,
            detail="The provided referral or campaign code could not be resolved",
        )
    values = payload.model_extra or {}
    campaign = target["campaignCode"] if target["type"] == "campaign" else None
    parameters = {
        "referral_code": campaign or code,
        "source": _optional_value(values.get("source")),
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "device_type": _optional_value(values.get("deviceType")),
        "operating_system": _optional_value(values.get("operatingSystem")),
        "browser": _optional_value(values.get("browser")),
        "country": _optional_value(values.get("country")),
        "region": _optional_value(values.get("region")),
        "app_version": _optional_value(values.get("appVersion")),
        "platform": _optional_value(values.get("platform")),
        "install_source": _optional_value(values.get("installSource")),
        "campaign": _optional_value(values.get("campaign")) or campaign,
        "promo_code": _optional_value(values.get("promoCode") or values.get("promo_code")),
        "profile_code": _optional_value(values.get("profileCode") or values.get("profile_code")),
        "utm_source": _optional_value(values.get("utm_source")),
        "utm_medium": _optional_value(values.get("utm_medium")),
        "utm_campaign": _optional_value(values.get("utm_campaign")),
        "utm_term": _optional_value(values.get("utm_term")),
        "utm_content": _optional_value(values.get("utm_content")),
        "click_identifier": _optional_value(
            values.get("clickIdentifier") or values.get("click_id")
        ),
    }
    recorded = await asyncio.to_thread(
        _execute,
        """
        INSERT INTO "referralTracking"
            ("referralCode", "source", "ipAddress", "userAgent", "deviceType",
             "operatingSystem", "browser", "country", "region", "appVersion",
             "platform", "installSource", "campaign", "promoCode", "profileCode",
             "utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent",
             "clickIdentifier")
        VALUES
            (:referral_code, :source, :ip_address, :user_agent, :device_type,
             :operating_system, :browser, :country, :region, :app_version,
             :platform, :install_source, :campaign, :promo_code, :profile_code,
             :utm_source, :utm_medium, :utm_campaign, :utm_term, :utm_content,
             :click_identifier)
        """,
        parameters,
    )
    return {
        "success": True,
        "status": "success",
        "message": "Tracking entry recorded",
        "data": {
            "tracking": {**values, "referralCode": code},
            "resolvedTarget": target,
        },
        "action": "track",
        "meta": {"recorded": recorded == 1, "type": target["type"]},
    }


@router.get("/leaderboard")
async def referral_leaderboard(
    request: Request, _auth: Annotated[dict[str, Any], Depends(require_user)]
) -> dict[str, Any]:
    scope = request.query_params.get("scope", "global")
    try:
        limit = min(100, max(1, int(request.query_params.get("limit", "10"))))
    except ValueError:
        limit = 10
    if scope == "campaign":
        campaign_code = request.query_params.get("campaignCode", "").strip()
        if not campaign_code:
            raise HTTPException(
                status_code=400,
                detail="campaignCode is required for campaign leaderboard",
            )
        statement = """
        SELECT users."firstName", users."lastName", COUNT(tracking."id") AS "referrals"
        FROM "referralTracking" tracking
        JOIN "referralProfiles" profiles
          ON EXISTS (
              SELECT 1 FROM jsonb_array_elements(
                  COALESCE(profiles."promotionCodes"::jsonb, '[]'::jsonb)
              ) promotion
              WHERE promotion->>'promoCode' = tracking."promoCode"
          )
        JOIN "users" users ON users."userId" = profiles."userId"
        WHERE tracking."campaign" = :campaign_code
        GROUP BY users."userId"
        ORDER BY "referrals" DESC LIMIT :limit
        """
        parameters = {"campaign_code": campaign_code, "limit": limit}
    elif scope == "global":
        statement = """
        SELECT users."firstName", users."lastName",
               COUNT(referred."userId") AS "totalReferrals",
               SUM(CASE WHEN referred."kycStatus" = 'approved'
                    AND LOWER(COALESCE(referred."kycLevel", ''))
                        IN ('tier1', 'tier2', 'tier3', 'merchant')
                    THEN 1 ELSE 0 END) AS "qualifiedReferrals"
        FROM "users" users
        LEFT JOIN "users" referred ON referred."referedBy" = users."referralCode"
        GROUP BY users."userId"
        ORDER BY "qualifiedReferrals" DESC, "totalReferrals" DESC LIMIT :limit
        """
        parameters = {"limit": limit}
    else:
        raise HTTPException(status_code=400, detail="scope must be global or campaign")
    rows = await asyncio.to_thread(_query_rows, statement, parameters)
    return {
        "success": True,
        "status": "success",
        "message": "Leaderboard retrieved successfully",
        "data": {"leaderboard": rows},
    }


@router.post("/invites")
async def invite_by_email(
    payload: InviteRequest,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    user_id = auth["user_id"]
    rows = await asyncio.to_thread(
        _query_rows,
        'SELECT "referralCode" FROM "users" WHERE "userId" = :user_id LIMIT 1',
        {"user_id": user_id},
    )
    referral_code = str(rows[0]["referralCode"] or "").strip() if rows else ""
    if not referral_code:
        raise HTTPException(status_code=409, detail="Referral code is not available")
    supplied = payload.emails if isinstance(payload.emails, list) else [payload.emails]
    emails = list(dict.fromkeys(str(email).strip().lower() for email in supplied))
    results: dict[str, dict[str, Any]] = {}
    sent = 0
    for email in emails:
        registered = await asyncio.to_thread(
            _query_rows,
            'SELECT 1 FROM "users" WHERE LOWER("email") = :email LIMIT 1',
            {"email": email},
        )
        if registered:
            results[email] = {"success": False, "message": "Email already registered"}
            continue
        recent = await asyncio.to_thread(
            _query_rows,
            """
            SELECT 1 FROM "userInvites"
            WHERE "senderId" = :user_id AND LOWER("recipientEmail") = :email
              AND "lastInvitedAt" >= CURRENT_TIMESTAMP - INTERVAL '7 days'
            LIMIT 1
            """,
            {"user_id": user_id, "email": email},
        )
        if recent:
            results[email] = {
                "success": False,
                "message": "You can only invite this email once every 7 days",
            }
            continue
        try:
            await send_email_notification(
                {
                    "email": email,
                    "subject": "Invitation to join PaySmart",
                    "message": {
                        "title": "You are invited to join PaySmart",
                        "greeting": True,
                        "blocks": [
                            {
                                "type": "paragraph",
                                "text": "You have been invited to join PaySmart. Use the invitation link below to complete registration.",
                            },
                            {
                                "type": "button",
                                "text": "Accept invitation",
                                "url": f"https://tediwave.com/r/{quote(referral_code)}",
                            },
                            {
                                "type": "note",
                                "text": "If you were not expecting this invitation, you can safely ignore this email.",
                            },
                        ],
                    },
                }
            )
        except EmailNotificationError as error:
            results[email] = {"success": False, "message": str(error)}
            continue
        await asyncio.to_thread(
            _execute,
            """
            INSERT INTO "userInvites"
                ("recipientEmail", "senderId", "inviteToken", "lastInvitedAt", "createdAt")
            VALUES (:email, :user_id, :token, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            {
                "email": email,
                "user_id": user_id,
                "token": secrets.token_hex(16),
            },
        )
        sent += 1
        results[email] = {"success": True, "message": f"Invite requested for {email}"}
    failed = len(results) - sent
    return {
        "success": failed == 0,
        "results": results,
        "summary": {"requested": len(results), "sent": sent, "failed": failed},
    }


@router.get("/campaign")
async def list_referral_campaigns(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    user_id = auth["user_id"]
    profile = await asyncio.to_thread(_get_profile, user_id)
    registrations = _json_array(profile.get("registrations") if profile else None)
    campaigns = await asyncio.to_thread(
        _query_rows,
        """
        SELECT "campaignCode", "name", "description", "coverPhoto", "startDate",
               "endDate", "maxRewards", "rewardAmount", "bonusThreshold",
               "bonusMultiplier", "slotLimit", "status", "createdAt"
        FROM "referralCampaigns"
        WHERE "status" = 'active'
          AND ("startDate" IS NULL OR "startDate" <= CURRENT_DATE)
          AND ("endDate" IS NULL OR "endDate" >= CURRENT_DATE)
        ORDER BY "createdAt" DESC
        """,
    )
    data = [
        await asyncio.to_thread(_campaign_view, row, registrations)
        for row in campaigns
    ]
    return {
        "success": True,
        "status": "success",
        "message": (
            "Campaign list retrieved successfully"
            if data
            else "No campaigns are available at the moment"
        ),
        "data": {"campaigns": data, "count": len(data), "empty": not data},
    }


@router.get("/campaign/{campaign_code}")
async def get_referral_campaign(
    campaign_code: str, auth: Annotated[dict[str, Any], Depends(require_user)]
) -> dict[str, Any]:
    campaign = await asyncio.to_thread(_active_campaign, campaign_code)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Only active campaigns can be used")
    profile = await asyncio.to_thread(_get_profile, auth["user_id"])
    data = await asyncio.to_thread(
        _campaign_view,
        campaign,
        _json_array(profile.get("registrations") if profile else None),
    )
    return {
        "success": True,
        "status": "success",
        "message": "Campaign metrics retrieved successfully",
        "data": {"campaign": data},
    }


@router.post("/campaign/{campaign_code}")
async def join_referral_campaign(
    campaign_code: str,
    payload: CampaignJoinRequest,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    campaign = await asyncio.to_thread(_active_campaign, campaign_code)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Only active campaigns can be used")
    profile = await asyncio.to_thread(_get_profile, auth["user_id"])
    if profile is None:
        users = await asyncio.to_thread(
            _query_rows,
            """
            SELECT "firstName", "lastName" FROM "users"
            WHERE "userId" = :user_id LIMIT 1
            """,
            {"user_id": auth["user_id"]},
        )
        if not users:
            raise HTTPException(status_code=404, detail="User profile was not found")
        await asyncio.to_thread(_create_profile, auth["user_id"], users[0])
    result = await asyncio.to_thread(
        _join_campaign, auth["user_id"], campaign, payload.source
    )
    return {
        "success": True,
        "status": "success",
        "message": "Joined campaign successfully",
        "data": result,
    }


@router.delete("/campaign/{campaign_code}")
async def leave_referral_campaign(
    campaign_code: str, auth: Annotated[dict[str, Any], Depends(require_user)]
) -> dict[str, Any]:
    await asyncio.to_thread(_leave_campaign, auth["user_id"], campaign_code)
    return {
        "success": True,
        "status": "success",
        "message": "Left campaign successfully",
        "data": {"campaignCode": campaign_code},
    }


def _referral_dashboard(user_id: int, environment: str) -> dict[str, Any]:
    user_rows = _query_rows(
        """
        SELECT "userId", "referralCode", "firstName", "lastName", "email"
        FROM "users" WHERE "userId" = :user_id LIMIT 1
        """,
        {"user_id": user_id},
    )
    if not user_rows:
        raise LookupError("User profile was not found")
    user = user_rows[0]
    code = str(user["referralCode"] or "").strip() or ensure_user_referral_code(user_id)
    profile = _get_profile(user_id)
    if profile is None:
        _create_profile(user_id, user)
        profile = _get_profile(user_id)
    if profile is None:
        raise RuntimeError("Referral profile support is not configured")
    referrals = _query_rows(
        """
        SELECT referred."userId" AS "id", referred."firstName",
               referred."createdAt" AS "joined", referred."kycStatus",
               referred."kycLevel",
               EXISTS (
                   SELECT 1 FROM "referralPayouts" payouts
                   WHERE payouts."referrerId" = :user_id
                     AND payouts."referredId" = referred."userId"
                     AND payouts."status" IN ('success', 'paid')
               ) AS "isPaid",
               COALESCE((
                   SELECT SUM(transactions."amount") FROM "transactions" transactions
                   WHERE transactions."userId" = referred."userId"
                     AND transactions."environment" = :environment
                     AND transactions."direction" = 'credit'
                     AND transactions."status" = 'successful'
               ), 0) AS "credited",
               COALESCE(wallet."balance", 0) AS "walletBalance"
        FROM "users" referred
        LEFT JOIN "wallets" wallet
          ON wallet."userId" = referred."userId"
         AND wallet."environment" = :environment
         AND wallet."walletType" = 'MAIN' AND wallet."currency" = 'NGN'
         AND wallet."status" = TRUE
        WHERE referred."referedBy" = :referral_code
        ORDER BY referred."createdAt" DESC
        """,
        {"environment": environment, "user_id": user_id, "referral_code": code},
    )
    payouts = _query_rows(
        """
        SELECT COALESCE(SUM("amount"), 0) AS "amount"
        FROM "referralPayouts"
        WHERE "referrerId" = :user_id AND "status" IN ('success', 'paid')
        """,
        {"user_id": user_id},
    )
    cashback = _query_rows(
        """
        SELECT COALESCE(SUM("amount"), 0) AS "amount"
        FROM "transactions"
        WHERE "userId" = :user_id AND "environment" = :environment
          AND "direction" = 'credit' AND "status" = 'successful'
          AND LOWER(COALESCE("serviceName", '')) LIKE '%cashback%'
        """,
        {"user_id": user_id, "environment": environment},
    )
    transactions = _query_rows(
        """
        SELECT "psRef", "amount", "narration", "createdAt" AS "date", "status"
        FROM "transactions"
        WHERE "userId" = :user_id AND "environment" = :environment
          AND "serviceName" = 'Referral Bonus'
        ORDER BY "createdAt" DESC
        """,
        {"user_id": user_id, "environment": environment},
    )
    qualified_rows = [row for row in referrals if _is_qualified(row)]
    completed = sum(bool(row["isPaid"]) for row in referrals)
    total_rewards = float(payouts[0]["amount"] or 0)
    cashback_earned = float(cashback[0]["amount"] or 0)
    stats = {
        "totalReferrals": len(referrals),
        "qualifiedReferrals": len(qualified_rows),
        "pendingReferrals": max(0, len(referrals) - len(qualified_rows)),
        "completedReferrals": completed,
        "rejectedReferrals": sum(
            str(row["kycStatus"] or "").lower() == "rejected" for row in referrals
        ),
        "totalRewardsEarned": _money(total_rewards),
        "totalPendingRewards": _money(max(0, len(qualified_rows) - completed) * 10),
        "totalCashbackEarned": _money(cashback_earned),
    }
    histories = [
        {
            "id": row["id"],
            "firstName": row["firstName"],
            "joined": row["joined"],
            "status": "Qualified" if _is_qualified(row) else "PendingQualification",
            "eligibility": {
                "kyc": str(row["kycStatus"] or "").lower() == "approved",
                "threshold": float(row["walletBalance"] or 0) >= 1000
                or float(row["credited"] or 0) >= 1000,
            },
        }
        for row in referrals
    ]
    qualified = len(qualified_rows)
    tier = _referral_tier(len(referrals))
    pending = [
        {
            "id": row["id"],
            "firstName": row["firstName"],
            "joined": row["joined"],
            "potentialReward": "10.00",
            "summary": "Potential reward of NGN 10 is pending qualification",
        }
        for row in histories
        if row["status"] == "PendingQualification"
    ]
    return {
        "referralCode": code,
        "referralLink": f"https://tediwave.com/r/{quote(code)}",
        "referralProfile": {
            "profileCode": profile.get("profileCode"),
            "profileName": profile.get("profileName"),
            "tier": tier,
            "achievements": _achievements(stats),
            "goals": _goals(qualified),
            "estimatedPendingRewards": pending,
        },
        "campaignPromoCodes": _json_array(profile.get("promotionCodes")),
        "campaignRegistrations": _json_array(profile.get("registrations")),
        "history": histories,
        "transactions": transactions,
        "referralTransactions": transactions,
        "rewardConfig": {"amount": 10, "currency": "NGN"},
        "statistics": {
            **stats,
            "totalReferralEarnings": _money(total_rewards + cashback_earned),
        },
    }


def _get_profile(user_id: int) -> dict[str, Any] | None:
    rows = _query_rows(
        """
        SELECT "id", "userId", "profileName", "profileCode", "referralTier",
               "registrations", "promotionCodes", "payouts"
        FROM "referralProfiles"
        WHERE "userId" = :user_id ORDER BY "createdAt" DESC LIMIT 1
        """,
        {"user_id": user_id},
    )
    return rows[0] if rows else None


def _create_profile(user_id: int, user: dict[str, Any]) -> None:
    full_name = user.get("fullName") or " ".join(
        part for part in (user.get("firstName"), user.get("lastName")) if part
    )
    _execute(
        """
        INSERT INTO "referralProfiles"
            ("userId", "profileName", "profileCode", "referralTier", "createdAt")
        VALUES (:user_id, :profile_name, :profile_code, 'Bronze', CURRENT_TIMESTAMP)
        """,
        {
            "user_id": user_id,
            "profile_name": str(full_name).strip() or "Referral Profile",
            "profile_code": f"PRF{secrets.token_hex(5).upper()}",
        },
    )


def _active_campaign(campaign_code: str) -> dict[str, Any] | None:
    rows = _query_rows(
        """
        SELECT "campaignCode", "name", "description", "coverPhoto", "startDate",
               "endDate", "maxRewards", "rewardAmount", "bonusThreshold",
               "bonusMultiplier", "slotLimit", "spendLimit", "status", "createdAt"
        FROM "referralCampaigns"
        WHERE LOWER("campaignCode") = LOWER(:campaign_code) AND "status" = 'active'
          AND ("startDate" IS NULL OR "startDate" <= CURRENT_DATE)
          AND ("endDate" IS NULL OR "endDate" >= CURRENT_DATE)
        LIMIT 1
        """,
        {"campaign_code": campaign_code},
    )
    return rows[0] if rows else None


def _campaign_view(
    campaign: dict[str, Any], registrations: list[Any]
) -> dict[str, Any]:
    registration = next(
        (
            row
            for row in registrations
            if isinstance(row, dict)
            and row.get("campaignCode") == campaign["campaignCode"]
        ),
        {},
    )
    counts = _query_rows(
        'SELECT COUNT(*) AS "count" FROM "referralTracking" WHERE "campaign" = :code',
        {"code": campaign["campaignCode"]},
    )
    profiles = _query_rows(
        """
        SELECT COUNT(*) AS "count" FROM "referralProfiles" profile
        CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(profile."registrations"::jsonb, '[]'::jsonb)
        ) registration
        WHERE registration->>'campaignCode' = :code
          AND registration->>'status' = 'active'
        """,
        {"code": campaign["campaignCode"]},
    )
    active = int(profiles[0]["count"] or 0)
    slot_limit = int(campaign["slotLimit"] or 0)
    return {
        "campaignCode": campaign["campaignCode"],
        "name": campaign["name"],
        "description": campaign["description"],
        "coverPhoto": campaign["coverPhoto"],
        "startDate": campaign["startDate"],
        "endDate": campaign["endDate"],
        "maxRewards": campaign["maxRewards"],
        "rewardAmount": _money(campaign["rewardAmount"]),
        "bonusThreshold": _money(campaign["bonusThreshold"]),
        "bonusMultiplier": f"{float(campaign['bonusMultiplier'] or 0):.2f}",
        "status": campaign["status"],
        "createdAt": campaign["createdAt"],
        "registrationStatus": registration.get("status", "none"),
        "registration": {
            "status": registration.get("status", "none"),
            "promoCode": registration.get("promoCode"),
            "profileCode": registration.get("profileCode"),
            "joinedAt": registration.get("joinedAt"),
        },
        "campaignLink": f"https://tediwave.com/r/{quote(campaign['campaignCode'])}",
        "myReferralCount": int(counts[0]["count"] or 0),
        "activeRegistrations": active,
        "availableSlots": max(0, slot_limit - active) if slot_limit > 0 else None,
        "timeRemaining": _time_remaining(campaign.get("endDate")),
    }


def _join_campaign(
    user_id: int, campaign: dict[str, Any], source: str
) -> dict[str, str]:
    with get_database_engine().begin() as connection:
        profile = (
            connection.execute(
                text(
                    """
                    SELECT "id", "profileCode", "registrations", "promotionCodes"
                    FROM "referralProfiles"
                    WHERE "userId" = :user_id
                    ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .first()
        )
        if profile is None:
            raise HTTPException(
                status_code=409, detail="Referral profile support is not configured"
            )
        registrations = _json_array(profile["registrations"])
        promotions = _json_array(profile["promotionCodes"])
        code = campaign["campaignCode"]
        previous = next(
            (
                item
                for item in registrations
                if isinstance(item, dict) and item.get("campaignCode") == code
            ),
            {},
        )
        promo_code = previous.get("promoCode") or f"PRM{secrets.token_hex(5).upper()}"
        profile_code = profile["profileCode"]
        registration = {
            "userId": user_id,
            "campaignCode": code,
            "promoCode": promo_code,
            "profileCode": profile_code,
            "status": "active",
            "source": source.strip() or "web",
            "joinedAt": datetime.now(UTC).isoformat(),
            "leftAt": None,
        }
        index = next(
            (
                position
                for position, item in enumerate(registrations)
                if isinstance(item, dict) and item.get("campaignCode") == code
            ),
            None,
        )
        if index is None:
            registrations.append(registration)
        else:
            registrations[index] = registration
        if not any(
            isinstance(item, dict)
            and item.get("campaignCode") == code
            and item.get("promoCode") == promo_code
            for item in promotions
        ):
            promotions.append(
                {
                    "userId": user_id,
                    "campaignCode": code,
                    "promoCode": promo_code,
                    "promoName": "Campaign referral promotion",
                    "status": "active",
                    "createdAt": datetime.now(UTC).isoformat(),
                    "expiresAt": None,
                }
            )
        connection.execute(
            text(
                """
                UPDATE "referralProfiles"
                SET "registrations" = CAST(:registrations AS JSONB),
                    "promotionCodes" = CAST(:promotions AS JSONB)
                WHERE "id" = :profile_id
                """
            ),
            {
                "registrations": json.dumps(registrations),
                "promotions": json.dumps(promotions),
                "profile_id": profile["id"],
            },
        )
    return {
        "campaignCode": code,
        "promoCode": promo_code,
        "profileCode": str(profile_code),
    }


def _leave_campaign(user_id: int, campaign_code: str) -> None:
    with get_database_engine().begin() as connection:
        profile = (
            connection.execute(
                text(
                    """
                    SELECT "id", "registrations" FROM "referralProfiles"
                    WHERE "userId" = :user_id
                    ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .first()
        )
        if not profile:
            return
        registrations = _json_array(profile["registrations"])
        changed = False
        for item in registrations:
            if (
                isinstance(item, dict)
                and item.get("campaignCode") == campaign_code
                and item.get("status") == "active"
            ):
                item["status"] = "left"
                item["leftAt"] = datetime.now(UTC).isoformat()
                changed = True
        if changed:
            connection.execute(
                text(
                    """
                    UPDATE "referralProfiles" SET "registrations" = CAST(:value AS JSONB)
                    WHERE "id" = :profile_id
                    """
                ),
                {
                    "value": json.dumps(registrations),
                    "profile_id": profile["id"],
                },
            )


def _query_rows(
    statement: str, parameters: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    with get_database_engine().connect() as connection:
        rows = connection.execute(text(statement), parameters or {}).mappings()
        return [dict(row) for row in rows]


def _execute(statement: str, parameters: dict[str, Any]) -> int:
    with get_database_engine().begin() as connection:
        result = connection.execute(text(statement), parameters)
        return max(result.rowcount or 0, 0)


def _json_array(value: Any) -> list[Any]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    return value if isinstance(value, list) else []


def _is_qualified(row: dict[str, Any]) -> bool:
    return (
        str(row.get("kycStatus") or "").lower() == "approved"
        and str(row.get("kycLevel") or "").lower()
        in {"tier1", "tier2", "tier3", "merchant"}
        and (
            float(row.get("walletBalance") or 0) >= 1000
            or float(row.get("credited") or 0) >= 1000
        )
    )


def _referral_tier(count: int) -> dict[str, Any]:
    if count >= 200:
        tier = ("Platinum", None, None)
    elif count >= 51:
        tier = ("Gold", "Platinum", 200)
    elif count >= 11:
        tier = ("Silver", "Gold", 51)
    else:
        tier = ("Bronze", "Silver", 11)
    return {"name": tier[0], "totalReferrals": count, "nextTier": tier[1], "nextTarget": tier[2]}


def _achievements(stats: dict[str, Any]) -> list[dict[str, Any]]:
    referrals = int(stats["totalReferrals"])
    qualified = int(stats["qualifiedReferrals"])
    earned = float(stats["totalRewardsEarned"])
    return [
        {"key": "firstReferral", "label": "First Referral", "unlocked": referrals >= 1},
        {"key": "firstQualifiedReferral", "label": "First Qualified Referral", "unlocked": qualified >= 1},
        {"key": "tenQualified", "label": "10 Qualified Referrals", "unlocked": qualified >= 10},
        {"key": "fiftyQualified", "label": "50 Qualified Referrals", "unlocked": qualified >= 50},
        {"key": "thousandEarned", "label": "NGN 1,000 Earned", "unlocked": earned >= 1000},
        {"key": "topReferrer", "label": "Top Referrer", "unlocked": qualified >= 100},
    ]


def _goals(qualified: int) -> dict[str, Any]:
    target = next((value for value in (10, 50, 100, 200) if qualified < value), 200)
    return {
        "currentGoal": {
            "type": "qualifiedReferrals",
            "label": "Referral goal",
            "target": target,
            "current": qualified,
            "progress": min(1, qualified / target),
            "reward": _money(target * 10),
            "summary": f"Goal of {target} referrals, {qualified} of {target} completed",
        }
    }


def _time_remaining(value: Any) -> str | None:
    if not value:
        return None
    end_date = value.date() if isinstance(value, datetime) else value
    if isinstance(end_date, str):
        try:
            end_date = datetime.fromisoformat(end_date).date()
        except ValueError:
            return None
    if not hasattr(end_date, "year"):
        return None
    end = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), UTC)
    remaining = end - datetime.now(UTC)
    if remaining.total_seconds() <= 0:
        return "Ended"
    days = remaining.days
    hours = int(remaining.seconds / 3600)
    return f"{str(days) + 'd ' if days else ''}{hours}h left".strip()


def _money(value: Any) -> str:
    return f"{float(value or 0):.2f}"


def _optional_value(value: Any) -> str | None:
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return str(value)
    return None


def _environment(auth: dict[str, Any]) -> str:
    value = str(auth.get("environment", "LIVE")).upper()
    if value not in {"LIVE", "TEST"}:
        raise HTTPException(status_code=401, detail="Authentication is required")
    return value


def _valid_email(value: str) -> bool:
    local, separator, domain = value.partition("@")
    return bool(
        separator
        and local
        and domain
        and "." in domain
        and not any(character.isspace() for character in value)
    )
