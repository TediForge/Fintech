"""Sudo Africa credentials loaded from its production unified apiKeys row."""

from dataclasses import dataclass

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.providers.types import ProviderError


@dataclass(frozen=True)
class SudoCredentials:
    api_key: str


def load_sudo_credentials() -> SudoCredentials:
    """Mirror Node's production-key lookup (also used for sandbox requests)."""
    statement = text(
        """
        SELECT "apiKey"
        FROM "apiKeys"
        WHERE "service" = 'sudo-africa'
          AND "credentialType" = 'unified'
          AND "environment" = 'production'
          AND "isActive" = TRUE
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        api_key = connection.execute(statement).scalar_one_or_none()
    if not isinstance(api_key, str) or not api_key.strip():
        raise ProviderError("Active Sudo Africa API key is not configured", 503)
    return SudoCredentials(api_key=api_key.strip())
