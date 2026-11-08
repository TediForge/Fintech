"""Safe Haven configuration loaded from its provider-owned database tables."""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.providers.types import ProviderError

SafeHavenMode = Literal["live", "test"]


@dataclass(frozen=True)
class SafeHavenCredentials:
    client_id: str
    private_key_path: str
    base_url: str
    company_url: str
    callback_url: str
    main_account_number: str
    rc_number: str
    identity_id: str
    state: Literal["production", "sandbox"]


def load_safehaven_credentials(mode: SafeHavenMode) -> SafeHavenCredentials:
    """Load the selected environment config and latest company profile."""
    if mode not in {"live", "test"}:
        raise ProviderError("Safe Haven environment is invalid", 503)
    state = "production" if mode == "live" else "sandbox"
    config_query = text(
        """
        SELECT "clientId", "privateKeyPath", "baseUrl", "companyUrl",
               "callbackUrl", "mainAccountNumber"
        FROM "safeHavenConfig"
        WHERE "environment" = :environment
        ORDER BY "id" DESC
        LIMIT 1
        """
    )
    profile_query = text(
        """
        SELECT "rcNumber", "identityId"
        FROM "safeHavenCompanyProfile"
        ORDER BY "id" DESC
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        config = connection.execute(
            config_query, {"environment": state}
        ).mappings().first()
        profile = connection.execute(profile_query).mappings().first()
    if config is None or profile is None:
        raise ProviderError("Safe Haven configuration is incomplete", 503)
    return SafeHavenCredentials(
        client_id=str(config["clientId"]),
        private_key_path=str(config["privateKeyPath"]),
        base_url=str(config["baseUrl"]),
        company_url=str(config["companyUrl"]),
        callback_url=str(config["callbackUrl"] or ""),
        main_account_number=str(config["mainAccountNumber"] or ""),
        rc_number=str(profile["rcNumber"]),
        identity_id=str(profile["identityId"]),
        state=state,
    )
