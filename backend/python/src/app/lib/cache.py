"""Database-backed application cache operations."""

import json
import re
from collections.abc import Callable
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import text

from database.db_01.connection import get_database_engine

CacheEnvironment = Literal["LIVE", "TEST"]
_CACHE_KEY_PATTERN = re.compile(r"^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$")


def normalize_cache_key(cache_key: str) -> str:
    key = cache_key.strip()
    if len(key) > 191 or not _CACHE_KEY_PATTERN.fullmatch(key):
        raise ValueError(
            "cache_key must be 1 to 191 characters and contain only letters, "
            "numbers, dots, underscores, colons, or hyphens."
        )
    return key


def normalize_cache_environment(environment: str) -> CacheEnvironment:
    mode = environment.strip().upper()
    if mode == "LIVE":
        return "LIVE"
    if mode == "TEST":
        return "TEST"
    raise ValueError("environment must be LIVE or TEST.")


def get_cached_payload(cache_key: str, environment: str = "LIVE") -> Any | None:
    key = normalize_cache_key(cache_key)
    mode = normalize_cache_environment(environment)
    statement = text(
        """
        SELECT "payload"
        FROM "cookies"
        WHERE "cacheKey" = :cache_key
          AND "environment" = :environment
          AND "expiresAt" > CURRENT_TIMESTAMP
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        payload = connection.execute(
            statement, {"cache_key": key, "environment": mode}
        ).scalar_one_or_none()
    if isinstance(payload, str):
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return None
    return payload


def store_cached_payload(
    cache_key: str,
    payload: Any,
    ttl_seconds: int,
    environment: str = "LIVE",
) -> dict[str, str]:
    key = normalize_cache_key(cache_key)
    mode = normalize_cache_environment(environment)
    _validate_cache_ttl(ttl_seconds)
    statement = text(
        """
        INSERT INTO "cookies"
            ("cacheKey", "environment", "payload", "createdAt", "expiresAt", "updatedAt")
        VALUES
            (:cache_key, :environment, CAST(:payload AS JSONB), CURRENT_TIMESTAMP,
             CURRENT_TIMESTAMP + (:ttl_seconds * INTERVAL '1 second'), CURRENT_TIMESTAMP)
        ON CONFLICT ("cacheKey", "environment") DO UPDATE SET
            "payload" = EXCLUDED."payload",
            "expiresAt" = EXCLUDED."expiresAt",
            "updatedAt" = CURRENT_TIMESTAMP
        """
    )
    with get_database_engine().begin() as connection:
        connection.execute(
            statement,
            {
                "cache_key": key,
                "environment": mode,
                "payload": json.dumps(payload),
                "ttl_seconds": ttl_seconds,
            },
        )
        expires_at = connection.execute(
            text(
                """
                SELECT "expiresAt" FROM "cookies"
                WHERE "cacheKey" = :cache_key AND "environment" = :environment
                LIMIT 1
                """
            ),
            {"cache_key": key, "environment": mode},
        ).scalar_one_or_none()
    if expires_at is None:
        raise RuntimeError("Saved cache expiration could not be loaded.")
    return {
        "cacheKey": key,
        "environment": mode,
        "expiresAt": _format_datetime(expires_at),
    }


def update_cached_payload(
    cache_key: str, payload: Any, ttl_seconds: int, environment: str = "LIVE"
) -> dict[str, str]:
    return store_cached_payload(cache_key, payload, ttl_seconds, environment)


def edit_cached_payload(
    cache_key: str,
    identifier: str,
    payload: Any,
    ttl_seconds: int,
    environment: str = "LIVE",
) -> dict[str, str]:
    return _mutate_cached_payload(
        cache_key,
        ttl_seconds,
        environment,
        lambda current: {**_as_record(current), identifier: payload},
    )


def append_cached_payload(
    cache_key: str,
    identifier: str,
    item: Any,
    ttl_seconds: int,
    environment: str = "LIVE",
) -> dict[str, str]:
    def append(current: Any) -> dict[str, Any]:
        value = _as_record(current)
        entries = value.get(identifier)
        if not isinstance(entries, list):
            entries = []
        return {**value, identifier: [*entries, item]}

    return _mutate_cached_payload(cache_key, ttl_seconds, environment, append)


def is_successful_cache_response(payload: Any, data_path: str = "data") -> bool:
    if not isinstance(payload, (dict, list)):
        return False
    if isinstance(payload, dict):
        status = str(payload.get("status", "")).strip().lower()
        if status and status not in {"success", "successful", "approved", "ok"}:
            return False
        response_code = str(payload.get("responseCode", payload.get("response_code", "")))
        if response_code and response_code not in {"00", "0"}:
            return False
    data = payload
    for part in filter(None, data_path.split(".")):
        if not isinstance(data, dict) or part not in data:
            return False
        data = data[part]
    return isinstance(data, (dict, list)) and bool(data)


def fetch_or_store_cached_payload(
    cache_key: str,
    ttl_seconds: int,
    fetch_callback: Callable[[], Any],
    environment: str = "LIVE",
) -> Any:
    cached = get_cached_payload(cache_key, environment)
    if cached is not None:
        return cached
    payload = fetch_callback()
    store_cached_payload(cache_key, payload, ttl_seconds, environment)
    return payload


def delete_cached_payload(cache_key: str, environment: str = "LIVE") -> bool:
    statement = text(
        """
        DELETE FROM "cookies"
        WHERE "cacheKey" = :cache_key AND "environment" = :environment
        """
    )
    with get_database_engine().begin() as connection:
        result = connection.execute(
            statement,
            {
                "cache_key": normalize_cache_key(cache_key),
                "environment": normalize_cache_environment(environment),
            },
        )
    return bool(result.rowcount and result.rowcount > 0)


def claim_cached_payload_step(
    cache_key: str,
    expected_step: str,
    claimed_step: str,
    environment: str = "LIVE",
) -> bool:
    key = normalize_cache_key(cache_key)
    mode = normalize_cache_environment(environment)
    with get_database_engine().begin() as connection:
        payload = connection.execute(
            text(
                """
                SELECT "payload" FROM "cookies"
                WHERE "cacheKey" = :cache_key AND "environment" = :environment
                  AND "expiresAt" > CURRENT_TIMESTAMP
                LIMIT 1 FOR UPDATE
                """
            ),
            {"cache_key": key, "environment": mode},
        ).scalar_one_or_none()
        current = _decode_payload(payload)
        if not isinstance(current, dict) or current.get("step") != expected_step:
            return False
        connection.execute(
            text(
                """
                UPDATE "cookies" SET "payload" = CAST(:payload AS JSONB),
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "cacheKey" = :cache_key AND "environment" = :environment
                  AND "expiresAt" > CURRENT_TIMESTAMP
                """
            ),
            {
                "payload": json.dumps({**current, "step": claimed_step}),
                "cache_key": key,
                "environment": mode,
            },
        )
    return True


def purge_expired_cached_payloads() -> int:
    with get_database_engine().begin() as connection:
        result = connection.execute(
            text('DELETE FROM "cookies" WHERE "expiresAt" <= CURRENT_TIMESTAMP')
        )
    return max(result.rowcount or 0, 0)


def _mutate_cached_payload(
    cache_key: str,
    ttl_seconds: int,
    environment: str,
    mutate: Callable[[Any], dict[str, Any]],
) -> dict[str, str]:
    key = normalize_cache_key(cache_key)
    mode = normalize_cache_environment(environment)
    _validate_cache_ttl(ttl_seconds)
    with get_database_engine().begin() as connection:
        payload = connection.execute(
            text(
                """
                SELECT "payload" FROM "cookies"
                WHERE "cacheKey" = :cache_key AND "environment" = :environment
                  AND "expiresAt" > CURRENT_TIMESTAMP
                LIMIT 1 FOR UPDATE
                """
            ),
            {"cache_key": key, "environment": mode},
        ).scalar_one_or_none()
        updated_payload = mutate(_decode_payload(payload))
        connection.execute(
            text(
                """
                INSERT INTO "cookies"
                    ("cacheKey", "environment", "payload", "createdAt", "expiresAt", "updatedAt")
                VALUES
                    (:cache_key, :environment, CAST(:payload AS JSONB), CURRENT_TIMESTAMP,
                     CURRENT_TIMESTAMP + (:ttl_seconds * INTERVAL '1 second'), CURRENT_TIMESTAMP)
                ON CONFLICT ("cacheKey", "environment") DO UPDATE SET
                    "payload" = EXCLUDED."payload",
                    "expiresAt" = EXCLUDED."expiresAt",
                    "updatedAt" = CURRENT_TIMESTAMP
                """
            ),
            {
                "cache_key": key,
                "environment": mode,
                "payload": json.dumps(updated_payload),
                "ttl_seconds": ttl_seconds,
            },
        )
        expires_at = connection.execute(
            text(
                """
                SELECT "expiresAt" FROM "cookies"
                WHERE "cacheKey" = :cache_key AND "environment" = :environment
                LIMIT 1
                """
            ),
            {"cache_key": key, "environment": mode},
        ).scalar_one_or_none()
    if expires_at is None:
        raise RuntimeError("Saved cache expiration could not be loaded.")
    return {
        "cacheKey": key,
        "environment": mode,
        "expiresAt": _format_datetime(expires_at),
    }


def _validate_cache_ttl(ttl_seconds: int) -> None:
    if isinstance(ttl_seconds, bool) or not isinstance(ttl_seconds, int) or ttl_seconds < 1:
        raise ValueError("ttl_seconds must be a positive integer.")


def _decode_payload(payload: Any) -> Any:
    if isinstance(payload, str):
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return None
    return payload


def _as_record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _format_datetime(value: datetime | str) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return value
