"""Small database helpers shared across application packages."""

from typing import Any

from sqlalchemy import text

from database.db_01.connection import get_database_engine


def query_rows(
    statement: str, parameters: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    with get_database_engine().connect() as connection:
        rows = connection.execute(text(statement), parameters or {}).mappings()
        return [dict(row) for row in rows]


def execute_statement(
    statement: str, parameters: dict[str, Any] | None = None
) -> int:
    with get_database_engine().begin() as connection:
        result = connection.execute(text(statement), parameters or {})
        return max(result.rowcount or 0, 0)
