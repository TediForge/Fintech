"""Accord fallback adapter for Nigerian NIN verification."""

import asyncio
import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.providers.types import ProviderError

_VERIFY_ENDPOINT = (
    "https://accordofficial.com/membership-registration/api/verify-nin.php"
)
_TIMEOUT_SECONDS = 30
_BROWSER_HEADERS = {
    "content-type": "application/json",
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://accordofficial.com",
    "referer": "https://accordofficial.com/membership-registration/",
    "x-requested-with": "XMLHttpRequest",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
}


@dataclass(frozen=True)
class AccordNinClient:
    """Accord verifier; connections use the platform's verified TLS defaults."""

    async def verify_nin(self, nin: str) -> dict[str, Any]:
        if (
            not isinstance(nin, str)
            or len(nin) != 11
            or not nin.isascii()
            or not nin.isdigit()
        ):
            raise ProviderError("Enter a valid 11-digit NIN", 400)
        return await asyncio.to_thread(self._verify_nin, nin)

    def _verify_nin(self, nin: str) -> dict[str, Any]:
        request = Request(
            _VERIFY_ENDPOINT,
            data=json.dumps({"nin": nin}, separators=(",", ":")).encode(),
            headers=_BROWSER_HEADERS,
            method="POST",
        )
        try:
            with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
                status = response.status
                response_body = response.read()
        except HTTPError as error:
            raise ProviderError(
                f"Accord NIN verification failed with status {error.code}",
                error.code if 400 <= error.code < 500 else 502,
            ) from error
        except (TimeoutError, URLError, OSError) as error:
            raise ProviderError(
                "Unable to connect to Accord NIN verification"
            ) from error

        payload = _decode_json(response_body)
        if not payload.get("success"):
            raise ProviderError("Accord rejected the NIN verification request", 400)
        if not isinstance(payload.get("data"), dict):
            raise ProviderError("Accord NIN response is missing identity data", 502)
        if status < 200 or status >= 300:
            raise ProviderError("Accord NIN verification failed", 502)
        return payload


async def verify_nin_with_accord(nin: str) -> dict[str, Any]:
    """Verify an 11-digit Nigerian NIN using the Accord endpoint."""
    return await AccordNinClient().verify_nin(nin)


def _decode_json(body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError(
            "Accord NIN verification returned invalid JSON", 502
        ) from error
    if not isinstance(payload, dict):
        raise ProviderError("Accord NIN verification returned an invalid response", 502)
    return payload
