"""Runtime-overridable Remita endpoint configuration from Node's environment."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class RemitaConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    remita_live_base_url: str | None = None
    remita_test_base_url: str | None = None
    remita_live_lookup_path: str | None = None
    remita_test_lookup_path: str | None = None
    remita_live_payment_path: str | None = None
    remita_test_payment_path: str | None = None
    remita_live_status_path: str | None = None
    remita_test_status_path: str | None = None
