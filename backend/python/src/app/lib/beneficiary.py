"""Saved beneficiary normalization and persistence."""

import json
from datetime import datetime
from importlib.resources import files
from typing import Any, TypedDict

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.lib.cache import get_cached_payload

_BENEFICIARY_RULES = json.loads(
    files("app.data").joinpath("beneficiaries.json").read_text(encoding="utf-8")
)


def _load_beneficiary_key_map(name: str) -> dict[str, tuple[str, ...]]:
    rules = _BENEFICIARY_RULES.get(name)
    if not isinstance(rules, dict) or any(
        not isinstance(service, str)
        or not isinstance(keys, list)
        or any(not isinstance(key, str) or not key for key in keys)
        for service, keys in rules.items()
    ):
        raise ValueError(f"app.data/beneficiaries.json has invalid {name} data")
    return {service: tuple(keys) for service, keys in rules.items()}


_REQUIRED_KEYS = _load_beneficiary_key_map("requiredKeys")
_IDENTITY_KEYS = _load_beneficiary_key_map("identityKeys")


class BeneficiaryRecord(TypedDict):
    id: int
    service: str
    details: dict[str, Any]
    createdAt: datetime | str | None
    updatedAt: datetime | str | None


def normalize_beneficiary_service(value: str) -> str:
    service = value.strip().lower()
    if service == "transfers":
        return "transfer"
    if service in {"giftcards", "gift-card", "gift-cards"}:
        return "giftcard"
    if service in {"cabletv", "cable-tv"}:
        return "cable"
    return service


def is_supported_beneficiary_service(value: str) -> bool:
    return normalize_beneficiary_service(value) in _REQUIRED_KEYS


def save_or_update_beneficiary(
    user_id: int,
    service_input: str,
    environment_input: str,
    metadata: dict[str, Any],
) -> bool:
    service = normalize_beneficiary_service(service_input)
    environment = _normalize_environment(environment_input)
    required = _REQUIRED_KEYS.get(service)
    identity = _IDENTITY_KEYS.get(service)
    if not required or not identity or user_id <= 0:
        return False
    sanitized: dict[str, str] = {}
    for key in required:
        value = metadata.get(key)
        if value is None or not str(value).strip():
            return False
        sanitized[key] = str(value).strip()
    if sanitized.get("network"):
        sanitized["network"] = sanitized["network"].upper()
    for key in ("serviceCode", "productCode"):
        if sanitized.get(key):
            sanitized[key] = sanitized[key].lower()
    if sanitized.get("meterType"):
        sanitized["meterType"] = sanitized["meterType"].lower()
    if sanitized.get("recipientEmail"):
        sanitized["recipientEmail"] = sanitized["recipientEmail"].lower()
    if sanitized.get("bankCode"):
        sanitized["bankCode"] = "".join(
            character
            for character in sanitized["bankCode"]
            if character.isascii() and character.isalnum()
        ).upper()
    for key in ("name", "payId", "recipientTag"):
        value = metadata.get(key)
        if value is not None and str(value).strip():
            sanitized[key] = str(value).strip()

    identity_conditions = " AND ".join(
        f'"metadata" ->> :identity_key_{index} = :identity_value_{index}'
        for index, _ in enumerate(identity)
    )
    parameters: dict[str, Any] = {
        "user_id": user_id,
        "service": service,
        "environment": environment,
    }
    for index, key in enumerate(identity):
        parameters[f"identity_key_{index}"] = key
        parameters[f"identity_value_{index}"] = sanitized[key]
    payload = json.dumps(sanitized)
    with get_database_engine().begin() as connection:
        row = (
            connection.execute(
                text(
                    f"""
                SELECT "id" FROM "beneficiaries"
                WHERE "userId" = :user_id AND "service" = :service
                  AND "environment" = :environment AND "deletedAt" IS NULL
                  AND {identity_conditions}
                LIMIT 1
                """
                ),
                parameters,
            )
            .mappings()
            .first()
        )
        if row:
            result = connection.execute(
                text(
                    """
                    UPDATE "beneficiaries"
                    SET "metadata" = CAST(:payload AS JSONB),
                        "updatedAt" = CURRENT_TIMESTAMP
                    WHERE "id" = :id AND "userId" = :user_id
                      AND "environment" = :environment
                    """
                ),
                {
                    "payload": payload,
                    "id": row["id"],
                    "user_id": user_id,
                    "environment": environment,
                },
            )
            return result.rowcount == 1
        result = connection.execute(
            text(
                """
                INSERT INTO "beneficiaries" ("userId", "service", "environment", "metadata")
                VALUES (:user_id, :service, :environment, CAST(:payload AS JSONB))
                """
            ),
            {
                "user_id": user_id,
                "service": service,
                "environment": environment,
                "payload": payload,
            },
        )
        return result.rowcount == 1


def get_beneficiaries(
    user_id: int, service_input: str, environment_input: str
) -> list[BeneficiaryRecord]:
    service = normalize_beneficiary_service(service_input)
    environment = _normalize_environment(environment_input)
    required = _REQUIRED_KEYS.get(service)
    if not required or user_id <= 0:
        return []
    with get_database_engine().connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT "id", "metadata", "createdAt", "updatedAt"
                FROM "beneficiaries"
                WHERE "userId" = :user_id AND "service" = :service
                  AND "environment" = :environment AND "deletedAt" IS NULL
                ORDER BY "updatedAt" DESC
                """
            ),
            {"user_id": user_id, "service": service, "environment": environment},
        ).mappings()
        records = [
            _format_beneficiary(row, service, required, environment) for row in rows
        ]
    return [record for record in records if record is not None]


def get_beneficiary_by_id(
    user_id: int,
    service_input: str,
    beneficiary_id: int,
    environment_input: str,
) -> BeneficiaryRecord | None:
    service = normalize_beneficiary_service(service_input)
    environment = _normalize_environment(environment_input)
    required = _REQUIRED_KEYS.get(service)
    if not required or user_id <= 0 or beneficiary_id <= 0:
        return None
    with get_database_engine().connect() as connection:
        row = (
            connection.execute(
                text(
                    """
                SELECT "id", "metadata", "createdAt", "updatedAt"
                FROM "beneficiaries"
                WHERE "id" = :id AND "userId" = :user_id AND "service" = :service
                  AND "environment" = :environment AND "deletedAt" IS NULL
                LIMIT 1
                """
                ),
                {
                    "id": beneficiary_id,
                    "user_id": user_id,
                    "service": service,
                    "environment": environment,
                },
            )
            .mappings()
            .first()
        )
    return (
        _format_beneficiary(row, service, required, environment)
        if row is not None
        else None
    )


def delete_beneficiary(
    user_id: int,
    service_input: str,
    beneficiary_id: int,
    environment_input: str,
) -> bool:
    service = normalize_beneficiary_service(service_input)
    environment = _normalize_environment(environment_input)
    if service not in _REQUIRED_KEYS or user_id <= 0 or beneficiary_id <= 0:
        return False
    with get_database_engine().begin() as connection:
        result = connection.execute(
            text(
                """
                UPDATE "beneficiaries" SET "deletedAt" = CURRENT_TIMESTAMP
                WHERE "id" = :id AND "userId" = :user_id AND "service" = :service
                  AND "environment" = :environment AND "deletedAt" IS NULL
                """
            ),
            {
                "id": beneficiary_id,
                "user_id": user_id,
                "service": service,
                "environment": environment,
            },
        )
    return result.rowcount == 1


def resolve_transfer_bank_name(
    bank_code: str, environment: str, fallback: str = ""
) -> str:
    code = _normalize_bank_code(bank_code)
    if not code:
        return fallback
    mode = _normalize_environment(environment)
    for key in (f"transferBanksNG{mode.title()}", f"transferBankItemsNG{mode.title()}"):
        cached = get_cached_payload(key, mode)
        root = cached.get("data") if isinstance(cached, dict) else cached
        if not isinstance(root, list):
            continue
        for entry in root:
            if not isinstance(entry, dict):
                continue
            candidate = _normalize_bank_code(
                str(
                    entry.get(
                        "bankCode", entry.get("routingKey", entry.get("code", ""))
                    )
                )
            )
            name = str(entry.get("name", "")).strip()
            if candidate == code and name:
                return name
    return fallback


def _format_beneficiary(
    row: Any, service: str, required: tuple[str, ...], environment: str
) -> BeneficiaryRecord | None:
    details = _parse_metadata(row["metadata"])
    if details is None or any(
        not str(details.get(key, "")).strip() for key in required
    ):
        return None
    if service == "transfer" and details.get("bankCode"):
        details["bankName"] = resolve_transfer_bank_name(
            str(details["bankCode"]), environment, str(details.get("bankName", ""))
        )
    return {
        "id": int(row["id"]),
        "service": service,
        "details": details,
        "createdAt": row["createdAt"],
        "updatedAt": row["updatedAt"],
    }


def _parse_metadata(value: Any) -> dict[str, Any] | None:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None
    return value if isinstance(value, dict) else None


def _normalize_environment(value: str) -> str:
    return "TEST" if value.strip().upper() == "TEST" else "LIVE"


def _normalize_bank_code(value: str) -> str:
    return "".join(character for character in value if character.isalnum()).upper()
