"""Repository for all database activity in PostgreSQL."""

from sqlalchemy import text

from database.db_01.connection import get_database_engine


def get_active_api_keys(service: str, limit: int | None = None) -> list[str]:
    """Load active non-empty API keys for a provider in database order."""
    normalized_service = service.strip()
    if not normalized_service:
        raise ValueError("Provider service name must not be empty.")
    if limit is not None and limit < 1:
        raise ValueError("API key query limit must be a positive integer.")

    statement = """
        SELECT "apiKey"
        FROM "apiKeys"
        WHERE "service" = :service
          AND "isActive" = TRUE
          AND "apiKey" IS NOT NULL
          AND "apiKey" <> ''
        ORDER BY "id" ASC
    """
    parameters: dict[str, object] = {"service": normalized_service}
    if limit is not None:
        statement += "\nLIMIT :limit"
        parameters["limit"] = limit

    with get_database_engine().connect() as connection:
        rows = connection.execute(text(statement), parameters)
        return [
            api_key.strip()
            for (api_key,) in rows
            if isinstance(api_key, str) and api_key.strip()
        ]
