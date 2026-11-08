"""Database lookups shared by notification channels."""

from typing import Any

from sqlalchemy import text

from database.db_01.connection import get_database_engine


def find_notification_user(
    phone: str | None = None, email: str | None = None
) -> dict[str, Any] | None:
    normalized_phone = phone.strip() if phone and phone.strip() else None
    normalized_email = email.strip() if email and email.strip() else None
    if normalized_phone is None and normalized_email is None:
        return None

    statement = text(
        """
        SELECT "userId", "email", "phoneNumber", "firstName"
        FROM "users"
        WHERE (:phone IS NOT NULL AND "phoneNumber" = :phone)
           OR (:email IS NOT NULL AND LOWER("email") = LOWER(:email))
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        row = connection.execute(
            statement,
            {"phone": normalized_phone, "email": normalized_email},
        ).mappings().first()
    return dict(row) if row is not None else None


def is_notification_setting_enabled(
    user_id: int,
    category: str,
    setting: str,
) -> bool:
    statement = text(
        """
        SELECT "settings" ->> :setting AS "settingValue"
        FROM "userSettings"
        WHERE "userId" = :user_id AND "category" = :category
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        value = connection.execute(
            statement,
            {"setting": setting, "user_id": user_id, "category": category},
        ).scalar_one_or_none()
    if value is None:
        return True
    return str(value).strip().lower() in {"1", "true", "yes", "on"}

