import pytest

from app.config import Settings
from database.db_02.connection import close_db_02_engine, get_db_02_engine


def test_db_02_uses_tediverify_postgresql_migration_settings() -> None:
    settings = Settings(
        _env_file=None,
        migrationPgHost="127.0.0.1",
        migrationPgPort=5433,
        migrationPgDatabase="tediverify",
        migrationPgUser="verify_user",
        migrationPgPassword="password",
        migrationPgSsl="true",
        dbConnectionLimit=7,
    )

    assert settings.tediverify_database_host == "127.0.0.1"
    assert settings.tediverify_database_port == 5433
    assert settings.tediverify_database_name == "tediverify"
    assert settings.tediverify_database_user == "verify_user"
    assert settings.tediverify_database_password is not None
    assert settings.tediverify_database_password.get_secret_value() == "password"
    assert settings.tediverify_database_ssl is True
    assert settings.tediverify_database_pool_size == 7


def test_db_02_requires_postgresql_connection_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    get_db_02_engine.cache_clear()
    monkeypatch.setattr(
        "database.db_02.connection.get_settings",
        lambda: Settings(_env_file=None),
    )

    with pytest.raises(RuntimeError, match="migrationPgHost"):
        get_db_02_engine()

    close_db_02_engine()


def test_db_02_engine_uses_postgresql_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(
        _env_file=None,
        migrationPgHost="127.0.0.1",
        migrationPgPort=5433,
        migrationPgDatabase="tediverify",
        migrationPgUser="verify_user",
        migrationPgPassword="password",
        migrationPgSsl="true",
        TEDIVERIFY_DATABASE_POOL_SIZE=7,
    )
    get_db_02_engine.cache_clear()
    monkeypatch.setattr(
        "database.db_02.connection.get_settings",
        lambda: settings,
    )

    engine = get_db_02_engine()

    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "psycopg"
    assert engine.url.host == "127.0.0.1"
    assert engine.url.port == 5433
    assert engine.url.database == "tediverify"
    assert engine.url.username == "verify_user"
    assert engine.url.password == "password"
    assert engine.pool.size() == 7
    close_db_02_engine()
