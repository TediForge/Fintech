"""Flutterwave credentials loaded from the exact apiKeys columns used by Node."""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.providers.types import ProviderError

FlutterwaveMode = Literal["live", "test"]


@dataclass(frozen=True)
class FlutterwaveCredentials:
    public_key: str
    secret_key: str
    encryption_key: str
    webhook_hash: str
    environment: FlutterwaveMode


def load_flutterwave_credentials(mode: FlutterwaveMode) -> FlutterwaveCredentials:
    """Load one active credential row for the requested runtime environment."""
    if mode not in {"live", "test"}:
        raise ProviderError("Flutterwave mode is invalid", 400)
    environment = "production" if mode == "live" else "test"
    statement = text(
        """
        SELECT "apiKey", "secretKey", "encryptionKey", "webhookHash"
        FROM "apiKeys"
        WHERE "service" = :service
          AND "isActive" = TRUE
          AND LOWER("environment") = :environment
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        row = connection.execute(
            statement, {"service": "flutterwave", "environment": environment}
        ).mappings().first()
    if row is None or not row["secretKey"]:
        raise ProviderError(f"Flutterwave {mode} credentials are not configured", 503)
    return FlutterwaveCredentials(
        public_key=str(row["apiKey"] or ""),
        secret_key=str(row["secretKey"]),
        encryption_key=str(row["encryptionKey"] or ""),
        webhook_hash=str(row["webhookHash"] or ""),
        environment=mode,
    )
