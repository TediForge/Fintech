"""Centralized application settings."""

from functools import lru_cache

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings shared by application components and provider adapters."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    database_host: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_HOST", "DB_HOST", "dbHost"),
    )
    database_port: int = Field(
        default=5432,
        validation_alias=AliasChoices("DATABASE_PORT", "DB_PORT", "dbPort"),
    )
    database_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_NAME", "DB_NAME", "dbName"),
    )
    database_user: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_USER", "DB_USER", "dbUser"),
    )
    database_password: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_PASSWORD", "DB_PASSWORD", "dbPassword"),
    )
    tediverify_database_host: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TEDIVERIFY_DATABASE_HOST", "migrationPgHost"),
    )
    tediverify_database_port: int = Field(
        default=5432,
        validation_alias=AliasChoices("TEDIVERIFY_DATABASE_PORT", "migrationPgPort"),
    )
    tediverify_database_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TEDIVERIFY_DATABASE_NAME", "migrationPgDatabase"),
    )
    tediverify_database_user: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TEDIVERIFY_DATABASE_USER", "migrationPgUser"),
    )
    tediverify_database_password: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("TEDIVERIFY_DATABASE_PASSWORD", "migrationPgPassword"),
    )
    tediverify_database_ssl: bool = Field(
        default=False,
        validation_alias=AliasChoices("TEDIVERIFY_DATABASE_SSL", "migrationPgSsl"),
    )
    tediverify_database_pool_size: int = Field(
        default=10,
        ge=1,
        le=100,
        validation_alias=AliasChoices("TEDIVERIFY_DATABASE_POOL_SIZE", "dbConnectionLimit"),
    )
    jwt_secret: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("JWT_SECRET", "jwtSecret"),
    )
    jwt_algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("JWT_ALGORITHM", "jwtAlgorithm"),
    )
    jwt_expires_minutes: int | None = Field(
        default=None,
        gt=0,
        validation_alias=AliasChoices("JWT_EXPIRES_MINUTES", "jwtExpiresMinutes"),
    )
    smtp_host: str | None = Field(default=None, validation_alias="SMTP_HOST")
    smtp_port: int = Field(default=587, ge=1, le=65535, validation_alias="SMTP_PORT")
    smtp_secure: bool = Field(default=True, validation_alias="SMTP_SECURE")
    smtp_user: str | None = Field(default=None, validation_alias="SMTP_USER")
    smtp_password: SecretStr | None = Field(
        default=None, validation_alias="SMTP_PASSWORD"
    )
    smtp_from_name: str | None = Field(default=None, validation_alias="SMTP_FROM_NAME")
    smtp_from_email: str | None = Field(
        default=None, validation_alias="SMTP_FROM_EMAIL"
    )
    smtp_timeout_seconds: float = Field(
        default=30, gt=0, validation_alias="SMTP_TIMEOUT_SECONDS"
    )
    fcm_service_account_json: SecretStr | None = Field(
        default=None, validation_alias="FCM_SERVICE_ACCOUNT_JSON"
    )
    fcm_project_id: str | None = Field(default=None, validation_alias="FCM_PROJECT_ID")
    email_outbox_interval_seconds: float = Field(
        default=5, gt=0, validation_alias="EMAIL_OUTBOX_INTERVAL_SECONDS"
    )
    email_outbox_batch_size: int = Field(
        default=10, ge=1, le=100, validation_alias="EMAIL_OUTBOX_BATCH_SIZE"
    )
    email_outbox_max_attempts: int = Field(
        default=5, ge=1, le=20, validation_alias="EMAIL_OUTBOX_MAX_ATTEMPTS"
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings instance."""
    return Settings()
