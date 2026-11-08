"""Groq API keys loaded from the provider-specific apiKeys lookup."""

from dataclasses import dataclass

from sqlalchemy import text

from database.db_01.connection import get_database_engine


@dataclass(frozen=True)
class GroqCredentials:
    api_keys: tuple[str, ...]


def load_groq_credentials() -> GroqCredentials:
    """Load all active Groq keys in rotation order."""
    statement = text(
        """
        SELECT "apiKey"
        FROM "apiKeys"
        WHERE "service" = 'groq'
          AND "isActive" = TRUE
          AND "apiKey" IS NOT NULL
          AND "apiKey" <> ''
        ORDER BY "id" ASC
        """
    )
    with get_database_engine().connect() as connection:
        rows = connection.execute(statement).all()
    return GroqCredentials(
        tuple(
            api_key.strip()
            for (api_key,) in rows
            if isinstance(api_key, str) and api_key.strip()
        )
    )
