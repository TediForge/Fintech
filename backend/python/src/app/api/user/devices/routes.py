"""Authenticated user's known-device management."""

import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from app.api.deps import require_user
from database.db_01.connection import get_database_engine

router = APIRouter()


class DeviceBlockRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fingerprint: str = Field(min_length=1, max_length=255)
    status: str


@router.get("/")
async def list_devices(
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    def fetch() -> list[dict[str, Any]]:
        with get_database_engine().connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT d."deviceId", d."fingerprint", d."deviceModel",
                           d."status", d."lastIp", d."lastCountry", d."lastRegion",
                           d."firstSeen", d."lastSeen",
                           (
                             SELECT COUNT(*) FROM "authRefreshTokens" rt
                             WHERE rt."accountType" = 'user'
                               AND rt."accountId" = d."userId"
                               AND rt."fingerprint" = d."fingerprint"
                               AND rt."revokedAt" IS NULL
                               AND rt."expiresAt" > CURRENT_TIMESTAMP
                           ) AS "activeRefreshTokens"
                    FROM "knownDevices" d
                    WHERE d."userId" = :user_id
                    ORDER BY d."lastSeen" DESC
                    """
                ),
                {"user_id": auth["user_id"]},
            ).mappings()
            return [dict(row) for row in rows]

    rows = await asyncio.to_thread(fetch)
    devices = [
        {
            "deviceId": int(row["deviceId"]),
            "fingerprint": row["fingerprint"],
            "deviceName": row["deviceModel"],
            "status": row["status"],
            "lastIp": row["lastIp"],
            "lastCountry": row["lastCountry"],
            "lastRegion": row["lastRegion"],
            "firstSeen": row["firstSeen"],
            "lastSeen": row["lastSeen"],
            "activeRefreshTokens": int(row["activeRefreshTokens"]),
            "isCurrent": row["fingerprint"] == auth.get("device_fingerprint"),
        }
        for row in rows
    ]
    return {
        "success": True,
        "status": 200,
        "message": "Account devices retrieved successfully",
        "data": {
            "totalUniqueDevices": len(devices),
            "activeRefreshSessions": sum(
                device["activeRefreshTokens"] for device in devices
            ),
            "devices": devices,
        },
    }


@router.patch("/")
async def block_device(
    payload: DeviceBlockRequest,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    if payload.status != "blocked":
        raise HTTPException(
            status_code=400, detail="fingerprint and blocked status are required"
        )

    def update() -> tuple[str | None, int]:
        with get_database_engine().begin() as connection:
            device = (
                connection.execute(
                    text(
                        """
                        SELECT "status" FROM "knownDevices"
                        WHERE "userId" = :user_id AND "fingerprint" = :fingerprint
                        LIMIT 1 FOR UPDATE
                        """
                    ),
                    {
                        "user_id": auth["user_id"],
                        "fingerprint": payload.fingerprint,
                    },
                )
                .mappings()
                .first()
            )
            if device is None:
                return None, 0
            if device["status"] == "blocked":
                return "blocked", 0
            connection.execute(
                text(
                    """
                    UPDATE "knownDevices" SET "status" = 'blocked'
                    WHERE "userId" = :user_id AND "fingerprint" = :fingerprint
                    """
                ),
                {
                    "user_id": auth["user_id"],
                    "fingerprint": payload.fingerprint,
                },
            )
            result = connection.execute(
                text(
                    """
                    UPDATE "authRefreshTokens" SET "revokedAt" = CURRENT_TIMESTAMP
                    WHERE "accountType" = 'user' AND "accountId" = :user_id
                      AND "fingerprint" = :fingerprint AND "revokedAt" IS NULL
                    """
                ),
                {
                    "user_id": auth["user_id"],
                    "fingerprint": payload.fingerprint,
                },
            )
            return "updated", max(result.rowcount or 0, 0)

    outcome, revoked = await asyncio.to_thread(update)
    if outcome is None:
        raise HTTPException(status_code=404, detail="Device not found")
    if outcome == "blocked":
        raise HTTPException(status_code=409, detail="Device is already blocked")
    return {
        "success": True,
        "status": 200,
        "message": "Device blocked and refresh sessions revoked",
        "data": {
            "fingerprint": payload.fingerprint,
            "status": "blocked",
            "revokedRefreshTokens": revoked,
        },
    }
