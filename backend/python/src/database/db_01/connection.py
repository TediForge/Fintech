"""PostgreSQL engine configuration and lifecycle."""

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Engine

from app.config import get_settings


@lru_cache(maxsize=1)
def get_database_engine() -> Engine:
    """Create and return the shared PostgreSQL engine."""
    settings = get_settings()
    if settings.database_url is not None:
        url: str | URL = settings.database_url.get_secret_value()
    else:
        required = {
            "DATABASE_HOST": settings.database_host,
            "DATABASE_NAME": settings.database_name,
            "DATABASE_USER": settings.database_user,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError(
                "Database configuration is incomplete; set DATABASE_URL or "
                f"the required connection settings: {', '.join(missing)}."
            )
        url = URL.create(
            "postgresql+psycopg",
            username=settings.database_user,
            password=(
                settings.database_password.get_secret_value()
                if settings.database_password is not None
                else None
            ),
            host=settings.database_host,
            port=settings.database_port,
            database=settings.database_name,
        )
    return create_engine(url, pool_pre_ping=True)


def close_database_engine() -> None:
    """Dispose of the shared engine and allow it to be recreated."""
    if get_database_engine.cache_info().currsize:
        get_database_engine().dispose()
        get_database_engine.cache_clear()
