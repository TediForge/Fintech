"""JRB tax identity lookup by Nigerian NIN and date-of-birth identity data."""

import asyncio
import json
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from time import strptime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.providers.kyc.ng.tax.jrb.credentials import (
    JrbTaxCredentials,
    load_jrb_tax_credentials,
)
from app.providers.types import ProviderError

_RESOLVE_ENDPOINT = "https://taxid.jrb.gov.ng/v1/resolve"
_TIMEOUT_SECONDS = 30
_HEADERS = {
    "content-type": "application/json",
    "accept": "application/json, text/plain, */*",
    "origin": "https://taxid.nrs.gov.ng",
    "referer": "https://taxid.nrs.gov.ng/",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
}


@dataclass(frozen=True)
class JrbTaxClient:
    """Credential-injected client for JRB's public tax resolver."""

    credentials: JrbTaxCredentials

    async def resolve_tax_id_for_nin(
        self, nin: str, first_name: str, last_name: str, date_of_birth: str
    ) -> dict[str, Any]:
        _validate_nin(nin)
        if not isinstance(first_name, str) or not first_name.strip():
            return {}
        if not isinstance(last_name, str) or not last_name.strip():
            return {}
        if not isinstance(date_of_birth, str) or not date_of_birth.strip():
            return {}
        return await asyncio.to_thread(
            self._resolve_tax_id_for_nin, nin, first_name, last_name, date_of_birth
        )

    def _resolve_tax_id_for_nin(
        self, nin: str, first_name: str, last_name: str, date_of_birth: str
    ) -> dict[str, Any]:
        formatted_dob = _format_date_of_birth(date_of_birth)
        name_variants = _name_variants(first_name, last_name)
        payload_variants: list[dict[str, str]] = []
        for variant_first, variant_last in name_variants:
            payload_variants.extend(
                [
                    {
                        "nin": nin,
                        "firstName": variant_first,
                        "lastName": variant_last,
                        "dateOfBirth": formatted_dob,
                    },
                    {
                        "nin": nin,
                        "firstName": variant_first,
                        "lastName": variant_last,
                        "dateOfBirth": _slash_date_of_birth(date_of_birth),
                    },
                ]
            )
        payload_variants.append(
            {
                "nin": nin,
                "firstname": first_name.strip().upper(),
                "lastname": last_name.strip().upper(),
                "dob": formatted_dob,
            }
        )

        errors: list[ProviderError] = []
        for payload in payload_variants:
            try:
                response = _request_json(payload)
            except ProviderError as error:
                errors.append(error)
                continue
            data = response.get("data", response)
            if not isinstance(data, dict):
                continue
            tax_id = _first(data, "tax_id", "taxId", "taxid")
            residency = _first(data, "tax_residency", "taxResidency", "residency")
            if tax_id is not None or residency is not None:
                return {"taxId": tax_id, "taxResidency": residency}
        if errors and len(errors) == len(payload_variants):
            raise ProviderError(
                "JRB tax identity resolution could not be completed"
            ) from errors[-1]
        return {}


@lru_cache(maxsize=1)
def get_jrb_tax_client() -> JrbTaxClient:
    """Return a reused client with the provider's no-credential contract."""
    return JrbTaxClient(load_jrb_tax_credentials())


async def resolve_tax_id_for_nin(
    nin: str, first_name: str, last_name: str, date_of_birth: str
) -> dict[str, Any]:
    """Resolve tax ID and tax residency from verified NIN identity details."""
    return await get_jrb_tax_client().resolve_tax_id_for_nin(
        nin, first_name, last_name, date_of_birth
    )


def _request_json(payload: dict[str, str]) -> dict[str, Any]:
    request = Request(
        _RESOLVE_ENDPOINT,
        data=json.dumps(payload, separators=(",", ":")).encode(),
        headers=_HEADERS,
        method="POST",
    )
    try:
        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            status = response.status
            body = response.read()
    except HTTPError as error:
        raise ProviderError(
            f"JRB tax resolver failed with status {error.code}",
            error.code if 400 <= error.code < 500 else 502,
        ) from error
    except (TimeoutError, URLError, OSError) as error:
        raise ProviderError("Unable to connect to JRB tax resolver") from error
    try:
        result = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError("JRB tax resolver returned invalid JSON", 502) from error
    if status < 200 or status >= 300 or not isinstance(result, dict):
        raise ProviderError("JRB tax resolver returned an invalid response", 502)
    return result


def _name_variants(first_name: str, last_name: str) -> list[tuple[str, str]]:
    first = first_name.strip()
    last = last_name.strip()
    candidates = [
        (first, last),
        (first.upper(), last.upper()),
        (first.lower(), last.lower()),
        (first.title(), last.title()),
    ]
    return list(dict.fromkeys(candidates))


def _format_date_of_birth(value: str) -> str:
    normalized = _normalize_date_of_birth(value)
    if normalized is None:
        return value.strip()
    return date.fromisoformat(normalized).strftime("%d/%m/%Y")


def _slash_date_of_birth(value: str) -> str:
    normalized = _normalize_date_of_birth(value)
    return (
        normalized.replace("-", "/") if normalized else value.strip().replace("-", "/")
    )


def _normalize_date_of_birth(value: str) -> str | None:
    supplied = value.strip()
    formats = ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%m-%d-%Y", "%m/%d/%Y")
    for date_format in formats:
        try:
            parsed = strptime(supplied, date_format)
        except ValueError:
            continue
        parsed_date = date(parsed.tm_year, parsed.tm_mon, parsed.tm_mday)
        if parsed_date.strftime(date_format) == supplied:
            return parsed_date.isoformat()
    try:
        return date.fromisoformat(supplied).isoformat()
    except ValueError:
        return None


def _first(value: dict[str, Any], *keys: str) -> Any:
    return next((value[key] for key in keys if value.get(key) is not None), None)


def _validate_nin(value: str) -> None:
    if (
        not isinstance(value, str)
        or len(value) != 11
        or not value.isascii()
        or not value.isdigit()
    ):
        raise ProviderError("Enter a valid 11-digit NIN", 400)
