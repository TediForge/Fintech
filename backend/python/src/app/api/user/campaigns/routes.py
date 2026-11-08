"""Active customer campaign discovery and analytics."""

import asyncio
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from app.api.deps import require_user
from database.db_01.connection import get_database_engine

router = APIRouter()
_EVENTS = {"impression", "view", "click", "conversion"}


class CampaignEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    event: str
    source: str | None = Field(default=None, max_length=100)
    platform: str | None = Field(default=None, max_length=50)


@router.get("/")
async def list_campaigns(
    request: Request, _auth: dict[str, Any] = Depends(require_user)
) -> dict[str, Any]:
    platform = request.query_params.get("platform", "app").lower()
    if platform not in {"app", "web", "all"}:
        raise HTTPException(status_code=400, detail="Platform must be app, web, or all")

    def fetch() -> list[dict[str, Any]]:
        with get_database_engine().connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT "id", "name", "title", "description", "imageUrl",
                           "destination", "actionType", "platform", "status",
                           "priority", "startsAt", "endsAt", "createdAt",
                           "updatedAt", "analytics"
                    FROM "campaigns"
                    WHERE "status" = 'active' AND ("platform" = :platform OR "platform" = 'all')
                      AND "startsAt" <= CURRENT_TIMESTAMP AND "endsAt" >= CURRENT_TIMESTAMP
                    ORDER BY "priority" DESC, "id" DESC
                    """
                ),
                {"platform": platform},
            ).mappings()
            return [_campaign(dict(row)) for row in rows]

    campaigns = await asyncio.to_thread(fetch)
    return {
        "success": True,
        "status": 200,
        "message": "Campaigns retrieved successfully",
        "data": {"campaigns": campaigns, "count": len(campaigns)},
    }


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: int, _auth: dict[str, Any] = Depends(require_user)
) -> dict[str, Any]:
    rows = await asyncio.to_thread(
        _fetch_campaign, campaign_id, None
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign = _campaign(rows[0])
    if campaign["status"] != "active":
        raise HTTPException(status_code=404, detail="Campaign is not active")
    return {
        "success": True,
        "status": 200,
        "message": "Campaign retrieved successfully",
        "data": {"campaign": campaign},
    }


@router.patch("/{campaign_id}")
async def record_campaign_event(
    campaign_id: int,
    payload: CampaignEvent,
    request: Request,
    auth: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    if payload.event not in _EVENTS:
        raise HTTPException(status_code=400, detail="Campaign analytics payload is invalid")

    def update() -> bool:
        with get_database_engine().begin() as connection:
            row = connection.execute(
                text('SELECT "status", "platform", "analytics" FROM "campaigns" WHERE "id" = :id LIMIT 1'),
                {"id": campaign_id},
            ).mappings().first()
            if row is None:
                raise HTTPException(status_code=404, detail="Campaign not found")
            if row["status"] != "active":
                raise HTTPException(status_code=404, detail="Campaign is not active")
            analytics = _analytics(row["analytics"])
            today = datetime.now().date().isoformat()
            duplicate = any(
                int(item.get("campaignId", 0) or 0) == campaign_id
                and str(item.get("userId", "")) == str(auth["user_id"])
                and item.get("eventType") == payload.event
                and str(item.get("createdAt", "")).startswith(today)
                for item in analytics
            )
            if not duplicate:
                analytics.append(
                    {
                        "campaignId": campaign_id,
                        "userId": str(auth["user_id"]),
                        "eventType": payload.event,
                        "ipAddress": request.client.host if request.client else None,
                        "userAgent": request.headers.get("user-agent"),
                        "source": payload.source,
                        "platform": payload.platform or row["platform"],
                        "createdAt": datetime.now().isoformat(sep=" ", timespec="seconds"),
                    }
                )
                connection.execute(
                    text('UPDATE "campaigns" SET "analytics" = CAST(:analytics AS JSONB) WHERE "id" = :id'),
                    {"analytics": json.dumps(analytics), "id": campaign_id},
                )
            return duplicate

    duplicate = await asyncio.to_thread(update)
    return {
        "success": True,
        "status": 200,
        "message": "Campaign event already recorded for today"
        if duplicate
        else "Campaign analytics updated successfully",
        "data": {"campaignId": campaign_id, "event": payload.event, "duplicate": duplicate},
    }


def _fetch_campaign(campaign_id: int, _unused: None) -> list[dict[str, Any]]:
    with get_database_engine().connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT "id", "name", "title", "description", "imageUrl",
                       "destination", "actionType", "platform", "status", "priority",
                       "startsAt", "endsAt", "createdAt", "updatedAt", "analytics"
                FROM "campaigns" WHERE "id" = :id LIMIT 1
                """
            ),
            {"id": campaign_id},
        ).mappings()
        return [dict(row) for row in rows]


def _campaign(row: dict[str, Any]) -> dict[str, Any]:
    row["id"] = int(row.get("id") or 0)
    row["name"] = str(row.get("name") or "")
    row["title"] = str(row.get("title") or row["name"])
    row["actionType"] = row.get("actionType") or "url"
    row["platform"] = str(row.get("platform") or "all")
    row["status"] = str(row.get("status") or "active")
    row["priority"] = int(row.get("priority") or 0)
    row["analytics"] = _analytics(row.get("analytics"))
    return row


def _analytics(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    return [entry for entry in value if isinstance(entry, dict)] if isinstance(value, list) else []
