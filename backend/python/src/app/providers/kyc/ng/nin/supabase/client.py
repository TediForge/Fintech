"""Supabase Edge Function adapter for Nigerian NIN verification."""

import asyncio
import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.providers.kyc.ng.nin.supabase.credentials import (
    SupabaseNinCredentials,
    load_supabase_nin_credentials,
)
from app.providers.types import ProviderError

_VERIFY_ENDPOINT = "https://tmochuqahzwyquhgiwzn.supabase.co/functions/v1/verify-nin"
_TIMEOUT_SECONDS = 15


@dataclass(frozen=True)
class SupabaseNinClient:
    """NIN verification client with an injected public anon key."""

    credentials: SupabaseNinCredentials

    async def verify_nin(self, nin: str) -> dict[str, Any]:
        _validate_nin(nin)
        return await asyncio.to_thread(self._verify_nin, nin)

    def _verify_nin(self, nin: str) -> dict[str, Any]:
        body = json.dumps({"nin": nin}, separators=(",", ":")).encode()
        request = Request(
            _VERIFY_ENDPOINT,
            data=body,
            method="POST",
            headers={
                "content-type": "application/json",
                "apikey": self.credentials.api_key,
                "authorization": f"Bearer {self.credentials.api_key}",
                "accept": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
                status = response.status
                response_body = response.read()
        except HTTPError as error:
            raise ProviderError(
                f"Supabase NIN verification failed with status {error.code}",
                error.code if 400 <= error.code < 500 else 502,
            ) from error
        except (TimeoutError, URLError, OSError) as error:
            raise ProviderError(
                "Unable to connect to Supabase NIN verification"
            ) from error

        payload = _decode_json(response_body)
        if status != 200 or not payload.get("success"):
            raise ProviderError("Supabase NIN verification was unsuccessful", 502)
        if not isinstance(payload.get("data"), dict):
            raise ProviderError("Supabase NIN response is missing identity data", 502)
        return payload


@lru_cache(maxsize=1)
def get_supabase_nin_client() -> SupabaseNinClient:
    """Return a reusable client after loading its approved credentials."""
    return SupabaseNinClient(load_supabase_nin_credentials())


async def verify_nin_with_supabase(nin: str) -> dict[str, Any]:
    """Verify an 11-digit Nigerian NIN with the Supabase Edge Function."""
    _validate_nin(nin)
    return await get_supabase_nin_client().verify_nin(nin)


def _decode_json(body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError(
            "Supabase NIN verification returned invalid JSON", 502
        ) from error
    if not isinstance(payload, dict):
        raise ProviderError(
            "Supabase NIN verification returned an invalid response", 502
        )
    return payload


def _validate_nin(value: str) -> None:
    if (
        not isinstance(value, str)
        or len(value) != 11
        or not value.isascii()
        or not value.isdigit()
    ):
        raise ProviderError("Enter a valid 11-digit NIN", 400)
