"""Face++ credentials loaded from its provider-specific apiKeys lookup."""

from dataclasses import dataclass

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.providers.types import ProviderError


@dataclass(frozen=True)
class FacePPCredentials:
    api_key: str
    secret_key: str


def load_facepp_credentials() -> FacePPCredentials:
    """Load the first active, complete Face++ credential row."""
    statement = text(
        """
        SELECT "apiKey", "secretKey"
        FROM "apiKeys"
        WHERE "service" = 'facepp'
          AND "isActive" = TRUE
          AND "apiKey" IS NOT NULL
          AND "apiKey" <> ''
          AND "secretKey" IS NOT NULL
          AND "secretKey" <> ''
        ORDER BY CASE WHEN "environment" = 'production' THEN 0 ELSE 1 END,
                 "id" ASC
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        row = connection.execute(statement).mappings().first()
    if row is None:
        raise ProviderError("Face++ credentials are not configured", 503)
    return FacePPCredentials(
        api_key=str(row["apiKey"]),
        secret_key=str(row["secretKey"]),
    )
