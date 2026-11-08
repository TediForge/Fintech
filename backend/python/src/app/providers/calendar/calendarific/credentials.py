"""Calendarific credentials loaded from its provider-owned apiKeys lookup."""

from dataclasses import dataclass

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.providers.types import ProviderError


@dataclass(frozen=True)
class CalendarificCredentials:
    api_key: str


def load_calendarific_credentials() -> CalendarificCredentials:
    """Load the first active Calendarific key in ascending id order."""
    statement = text(
        """
        SELECT "apiKey"
        FROM "apiKeys"
        WHERE "service" = 'calendarific'
          AND "isActive" = TRUE
          AND "apiKey" IS NOT NULL
          AND "apiKey" <> ''
        ORDER BY "id" ASC
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        row = connection.execute(statement).first()
    if row is None or not isinstance(row[0], str) or not row[0].strip():
        raise ProviderError("Active Calendarific API key is not configured", 503)
    return CalendarificCredentials(api_key=row[0].strip())
