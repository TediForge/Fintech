"""Reloadly gift-card credentials loaded from its environment-specific apiKeys row."""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.providers.types import ProviderError

ReloadlyMode = Literal["live", "test"]
ReloadlyEnvironment = Literal["production", "sandbox"]


@dataclass(frozen=True)
class ReloadlyCredentials:
    client_id: str
    client_secret: str
    mode: ReloadlyMode


def load_reloadly_credentials(mode: ReloadlyMode = "live") -> ReloadlyCredentials:
    """Load the first active Reloadly credential row for the requested mode."""
    if mode not in {"live", "test"}:
        raise ProviderError("Reloadly mode is invalid", 400)
    environment: ReloadlyEnvironment = "sandbox" if mode == "test" else "production"
    statement = text(
        """
        SELECT "apiKey", "secretKey"
        FROM "apiKeys"
        WHERE "service" = 'reloadly'
          AND "environment" = :environment
          AND "isActive" = TRUE
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        row = connection.execute(
            statement, {"environment": environment}
        ).mappings().first()
    if (
        row is None
        or not isinstance(row["apiKey"], str)
        or not row["apiKey"].strip()
        or not isinstance(row["secretKey"], str)
        or not row["secretKey"].strip()
    ):
        raise ProviderError("Reloadly credentials are not configured", 503)
    return ReloadlyCredentials(
        client_id=row["apiKey"].strip(),
        client_secret=row["secretKey"].strip(),
        mode=mode,
    )
