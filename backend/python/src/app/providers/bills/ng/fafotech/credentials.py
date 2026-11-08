"""Fafotech API key loaded from its provider-specific apiKeys lookup."""

from dataclasses import dataclass

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.providers.types import ProviderError


@dataclass(frozen=True)
class FafotechCredentials:
    api_key: str


def load_fafotech_credentials() -> FafotechCredentials:
    """Load the first active Fafotech key in database order."""
    statement = text(
        """
        SELECT "apiKey"
        FROM "apiKeys"
        WHERE "service" = 'fafotech'
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
        raise ProviderError("Active fafotech API key is not configured", 503)
    return FafotechCredentials(api_key=row[0].strip())
