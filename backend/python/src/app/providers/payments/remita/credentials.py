"""Remita credentials loaded from the mode-specific apiKeys columns."""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.providers.types import ProviderError

RemitaMode = Literal["LIVE", "TEST"]


@dataclass(frozen=True)
class RemitaCredentials:
    api_key: str
    secret_key: str
    merchant_id: str
    environment: RemitaMode


def load_remita_credentials(environment: RemitaMode) -> RemitaCredentials:
    """Load exactly the apiKeys fields and environment mapping used in Node."""
    if environment not in {"LIVE", "TEST"}:
        raise ProviderError("A valid Remita environment is required", 400)
    provider_environment = "production" if environment == "LIVE" else "test"
    statement = text(
        """
        SELECT "apiKey", "secretKey", "encryptionKey"
        FROM "apiKeys"
        WHERE "service" = 'remita'
          AND "environment" = :environment
          AND "isActive" = TRUE
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        row = connection.execute(
            statement, {"environment": provider_environment}
        ).mappings().first()
    if row is None or not row["apiKey"] or not row["secretKey"]:
        raise ProviderError(
            f"Remita {provider_environment} credentials are not configured", 503
        )
    return RemitaCredentials(
        api_key=str(row["apiKey"]),
        secret_key=str(row["secretKey"]),
        merchant_id=str(row["encryptionKey"] or ""),
        environment=environment,
    )
