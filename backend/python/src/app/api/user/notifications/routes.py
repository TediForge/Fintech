"""Authenticated customer notification inbox."""

import asyncio
import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from app.api.deps import require_user
from database.db_01.connection import get_database_engine

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]


@router.get("/")
async def list_notifications(auth: AuthenticatedUser) -> dict[str, Any]:
    def fetch() -> list[dict[str, Any]]:
        with get_database_engine().connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT "id", "userId", "title", "message", "category",
                           "coverImageUrl", "profileImageUrl", "actionLabel",
                           "actionRoute", "actionData", "dateSent", "isRead",
                           "isArchived", "createdAt", "updatedAt"
                    FROM "notifications"
                    WHERE "userId" = :user_id AND "isArchived" = FALSE
                    ORDER BY "createdAt" DESC
                    """
                ),
                {"user_id": auth["user_id"]},
            ).mappings()
            return [_notification_data(dict(row)) for row in rows]

    return {
        "status": "success",
        "message": "Notifications fetched successfully",
        "data": await asyncio.to_thread(fetch),
    }


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str, auth: AuthenticatedUser
) -> dict[str, str]:
    affected = await asyncio.to_thread(
        _update_notification,
        notification_id,
        auth["user_id"],
        "isArchived",
    )
    if not affected:
        raise HTTPException(
            status_code=404, detail="Notification was not found or already updated"
        )
    return {"status": "success", "message": "Notification archived successfully"}


@router.post("/{notification_id}/read")
async def read_notification(
    notification_id: str, auth: AuthenticatedUser
) -> dict[str, str]:
    affected = await asyncio.to_thread(
        _update_notification,
        notification_id,
        auth["user_id"],
        "isRead",
    )
    if not affected:
        raise HTTPException(
            status_code=404, detail="Notification was not found or already updated"
        )
    return {"status": "success", "message": "Notification marked as read"}


def _update_notification(notification_id: str, user_id: int, field: str) -> int:
    if field not in {"isArchived", "isRead"}:
        raise ValueError("Unsupported notification update")
    condition = "AND NOT \"isArchived\"" if field == "isArchived" else "AND NOT \"isRead\""
    with get_database_engine().begin() as connection:
        result = connection.execute(
            text(
                f'UPDATE "notifications" SET "{field}" = TRUE, '
                f'"updatedAt" = CURRENT_TIMESTAMP WHERE "id" = :notification_id '
                f'AND "userId" = :user_id {condition}'
            ),
            {"notification_id": notification_id, "user_id": user_id},
        )
        return max(result.rowcount or 0, 0)


def _notification_data(row: dict[str, Any]) -> dict[str, Any]:
    value = row.get("actionData")
    if isinstance(value, str):
        try:
            row["actionData"] = json.loads(value)
        except json.JSONDecodeError:
            row["actionData"] = None
    return row
