"""In-app notification service and persistence."""

import asyncio
import json
import uuid
from collections.abc import Mapping
from typing import Any

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.services.notification.shared import (
    find_notification_user,
    is_notification_setting_enabled,
)

_ALLOWED_CATEGORIES = {"transaction", "security", "promo", "system"}


class NotificationError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


class InAppSender:
    async def send(self, input: Mapping[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(send_in_app_notification, input)


def send_in_app_notification(input: Mapping[str, Any]) -> dict[str, Any]:
    message = input.get("message")
    phone = input.get("phone")
    email = input.get("email")
    if (
        not isinstance(message, str)
        or not message.strip()
        or not (isinstance(phone, str) and phone.strip())
        and not (isinstance(email, str) and email.strip())
    ):
        raise TypeError("Recipient and notification message are required")
    user = find_notification_user(
        phone if isinstance(phone, str) else None,
        email if isinstance(email, str) else None,
    )
    if not user:
        raise NotificationError(404, "Recipient user could not be found")
    user_id = user["userId"]
    if not is_notification_setting_enabled(
        user_id, "security", "inAppAccessEnabled"
    ):
        raise NotificationError(403, "User has disabled in-app notifications")

    requested_category = input.get("category")
    requested_category = (
        requested_category.strip().lower()
        if isinstance(requested_category, str) and requested_category.strip()
        else "general"
    )
    category = requested_category if requested_category in _ALLOWED_CATEGORIES else "general"
    action_data = input.get("actionData")
    if isinstance(action_data, str) and action_data.strip():
        parsed = json.loads(action_data)
        if not isinstance(parsed, dict):
            raise TypeError("actionData must be a JSON object")
        action_data = json.dumps(parsed)
    elif isinstance(action_data, dict):
        action_data = json.dumps(action_data)
    else:
        action_data = None

    statement = text(
        """
        INSERT INTO "notifications"
            ("id", "userId", "title", "message", "category", "coverImageUrl",
             "profileImageUrl", "actionLabel", "actionRoute", "actionData",
             "dateSent", "isRead")
        VALUES
            (:id, :user_id, :title, :message, :category, :cover_image,
             :profile_image, :action_label, :action_route,
             CAST(:action_data AS JSONB), CURRENT_TIMESTAMP, FALSE)
        """
    )
    with get_database_engine().begin() as connection:
        connection.execute(
            statement,
            {
                "id": str(uuid.uuid4()),
                "user_id": str(user_id),
                "title": _optional_string(input.get("title")) or "Message from Tediwave",
                "message": message,
                "category": category,
                "cover_image": input.get("coverImage") or "",
                "profile_image": input.get("profileImage") or "",
                "action_label": input.get("actionLabel") or "",
                "action_route": input.get("actionRoute") or "",
                "action_data": action_data,
            },
        )
    return {
        "success": True,
        "message": "In-app notification sent successfully",
        "data": {"categoryUsed": category, "deliveryType": "in_app"},
    }


def _optional_string(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None
