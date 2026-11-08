"""PostgreSQL connection for db-02, the migrated TediVerify database."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Connection, Engine

from app.config import get_settings


@lru_cache(maxsize=1)
def get_db_02_engine() -> Engine:
    """Create the db-02 engine from TediVerify's PostgreSQL migration settings."""
    settings = get_settings()
    required = {
        "migrationPgHost": settings.tediverify_database_host,
        "migrationPgDatabase": settings.tediverify_database_name,
        "migrationPgUser": settings.tediverify_database_user,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(
            "db-02 configuration is incomplete; set the required PostgreSQL "
            f"connection settings: {', '.join(missing)}."
        )

    url = URL.create(
        "postgresql+psycopg",
        username=settings.tediverify_database_user,
        password=(
            settings.tediverify_database_password.get_secret_value()
            if settings.tediverify_database_password is not None
            else None
        ),
        host=settings.tediverify_database_host,
        port=settings.tediverify_database_port,
        database=settings.tediverify_database_name,
    )
    connect_args = {"sslmode": "require"} if settings.tediverify_database_ssl else {}
    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_size=settings.tediverify_database_pool_size,
        max_overflow=0,
    )


def get_db_02() -> Iterator[Connection]:
    """Yield a db-02 connection and close it when the consumer finishes."""
    with get_db_02_engine().connect() as connection:
        yield connection


def close_db_02_engine() -> None:
    """Dispose of the db-02 engine and allow it to be recreated."""
    if get_db_02_engine.cache_info().currsize:
        get_db_02_engine().dispose()
        get_db_02_engine.cache_clear()
