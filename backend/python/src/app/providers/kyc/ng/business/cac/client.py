"""Nigerian CAC company search and tax-ID lookup."""

import asyncio
import json
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from app.providers.kyc.ng.business.cac.credentials import (
    CacCredentials,
    load_cac_credentials,
)
from app.providers.types import ProviderError

_SEARCH_ENDPOINT = (
    "https://authapp.cac.gov.ng/name_similarity_app/api/public_search/search"
)
_TAX_ID_ENDPOINT = (
    "https://icrp.cac.gov.ng/tin_service/api/v1/public/tin/generate-tax-id"
)
_TIMEOUT_SECONDS = 30
_SEARCH_HEADERS = {
    "content-type": "application/json",
    "accept": "*/*",
    "origin": "https://icrp.cac.gov.ng",
    "referer": "https://icrp.cac.gov.ng/",
}
_TAX_ID_HEADERS = {
    "accept": "application/json",
    "origin": "https://icrp.cac.gov.ng",
    "referer": "https://icrp.cac.gov.ng/",
}
_DETAIL_FIELDS = (
    "approvedName",
    "rcNumber",
    "companyRegistrationDate",
    "companyId",
    "classificationName",
    "classificationId",
    "natureOfBusiness",
    "status",
    "taxId",
)


@dataclass(frozen=True)
class CacClient:
    """Read-only client for CAC's public company-search endpoints."""

    credentials: CacCredentials

    async def fetch_business_details_by_registration_number(
        self, company_number: str
    ) -> dict[str, Any]:
        rc_number = _normalize_rc_number(company_number)
        company = await asyncio.to_thread(_search_company, rc_number)
        if company is None:
            raise ProviderError(
                "No company was found for that registration number", 404
            )

        details = {
            field: _optional_text(company.get(field)) for field in _DETAIL_FIELDS
        }
        details["rcNumber"] = details["rcNumber"] or rc_number
        details["providerReference"] = json.dumps(
            company, ensure_ascii=False, separators=(",", ":")
        )

        if (
            not details["taxId"]
            and details["companyId"]
            and details["rcNumber"]
            and details["classificationId"]
        ):
            details["taxId"] = await asyncio.to_thread(
                _fetch_tax_id,
                details["companyId"],
                details["rcNumber"],
                details["classificationId"],
            )
        return details


@lru_cache(maxsize=1)
def get_cac_client() -> CacClient:
    """Return a reusable client with the provider's no-credential contract."""
    return CacClient(load_cac_credentials())


async def fetch_business_details_by_registration_number(
    company_number: str,
) -> dict[str, Any]:
    """Fetch company identity details by CAC registration number."""
    return await get_cac_client().fetch_business_details_by_registration_number(
        company_number
    )


def _search_company(rc_number: str) -> dict[str, Any] | None:
    payload, status = _request_json(
        _SEARCH_ENDPOINT,
        {"SearchType": "RC_NUMBER", "searchTerm": rc_number},
        _SEARCH_HEADERS,
    )
    if status < 200 or status >= 300:
        raise ProviderError(f"CAC company search failed with status {status}")
    for item in _extract_result_items(payload):
        if not isinstance(item, dict):
            continue
        item_rc = _optional_text(item.get("rcNumber"))
        if item_rc == rc_number:
            return item
    return None


def _fetch_tax_id(
    company_id: str, rc_number: str, classification_id: str
) -> str | None:
    endpoint = (
        f"{_TAX_ID_ENDPOINT}/{quote(company_id, safe='')}"
        f"?{urlencode({'rc': rc_number, 'type': classification_id})}"
    )
    payload, status = _request_json(endpoint, None, _TAX_ID_HEADERS)
    if status < 200 or status >= 300:
        raise ProviderError(f"CAC tax-ID lookup failed with status {status}")
    if not isinstance(payload, dict):
        raise ProviderError("CAC tax-ID lookup returned an invalid response", 502)
    data = payload.get("data")
    if not isinstance(data, dict):
        return None
    return _optional_text(data.get("tax_id"))


def _request_json(
    endpoint: str,
    payload: dict[str, str] | None,
    headers: dict[str, str],
) -> tuple[dict[str, Any] | list[Any], int]:
    data = (
        json.dumps(payload, separators=(",", ":")).encode()
        if payload is not None
        else None
    )
    request = Request(
        endpoint,
        data=data,
        headers=headers,
        method="POST" if data is not None else "GET",
    )
    try:
        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            status = response.status
            body = response.read()
    except HTTPError as error:
        raise ProviderError(
            f"CAC request failed with status {error.code}",
            error.code if 400 <= error.code < 500 else 502,
        ) from error
    except (TimeoutError, URLError, OSError) as error:
        raise ProviderError("Unable to connect to CAC") from error
    try:
        result = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError("CAC returned invalid JSON", 502) from error
    if not isinstance(result, (dict, list)):
        raise ProviderError("CAC returned an invalid response", 502)
    return result, status


def _extract_result_items(response: dict[str, Any] | list[Any]) -> list[Any]:
    if isinstance(response, list):
        return response
    for key in ("data", "results"):
        items = response.get(key)
        if isinstance(items, list):
            return items
    return []


def _normalize_rc_number(value: str) -> str:
    if not isinstance(value, str):
        raise ProviderError("incorporationNumber must contain digits", 400)
    digits = re.sub(r"[^0-9]", "", value)
    if not digits:
        raise ProviderError("incorporationNumber must contain digits", 400)
    if not 4 <= len(digits) <= 12:
        raise ProviderError("incorporationNumber must be between 4 and 12 digits", 400)
    return digits


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
