"""Safe Haven virtual-account operations."""

import asyncio
import base64
import json
import math
import secrets
import time
from pathlib import Path
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from app.providers.payments.safehaven.credentials import (
    SafeHavenCredentials,
    SafeHavenMode,
    load_safehaven_credentials,
)
from app.providers.types import ProviderError

_REQUEST_TIMEOUT_SECONDS = 60
_AUTH_TIMEOUT_SECONDS = 30


class SafeHavenClient:
    """Safe Haven client with database credentials injected at construction."""

    def __init__(self, credentials: SafeHavenCredentials) -> None:
        self.credentials = credentials
        self._access_token: str | None = None
        self._ibs_client_id: str | None = None
        self._authentication_lock = asyncio.Lock()

    @classmethod
    async def create(cls, mode: SafeHavenMode = "test") -> "SafeHavenClient":
        return cls(load_safehaven_credentials(mode))

    def get_state(self) -> Literal["production", "sandbox"]:
        return self.credentials.state

    def get_profile(self) -> dict[str, str]:
        return {
            "rcNumber": self.credentials.rc_number,
            "identityId": self.credentials.identity_id,
            "mainAccountNumber": self.credentials.main_account_number,
        }

    def get_callback_url(self) -> str:
        return self.credentials.callback_url

    async def get_access_token(self) -> str:
        await self._authenticate()
        if self._access_token is None:
            raise ProviderError("Safe Haven authentication failed", 502)
        return self._access_token

    async def get_ibs_client_id(self) -> str:
        await self._authenticate()
        if self._ibs_client_id is None:
            raise ProviderError("Safe Haven authentication failed", 502)
        return self._ibs_client_id

    async def execute_request(
        self,
        endpoint: str,
        method: Literal["GET", "POST"] = "GET",
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if self.credentials.state == "sandbox":
            return {
                "http_code": 200,
                "data": {
                    "success": True,
                    "status": "success",
                    "message": "Simulated transaction completed without external debit",
                    "environment": self.credentials.state,
                    "data": {
                        "reference": f"TS-MOCK-{int(time.time() * 1000)}-{secrets.token_hex(2)}",
                        "status": "successful",
                        "amount": (payload or {}).get("amount", 0),
                        "currency": (payload or {}).get("currency", "NGN"),
                    },
                },
            }
        token = await self.get_access_token()
        ibs_client_id = await self.get_ibs_client_id()
        url = urljoin(
            self.credentials.base_url.rstrip("/") + "/",
            endpoint.lstrip("/"),
        )
        result, status = await asyncio.to_thread(
            _request_json,
            url,
            method,
            {
                "authorization": f"Bearer {token}",
                "ClientID": ibs_client_id,
                "content-type": "application/json",
                "accept": "application/json",
            },
            payload if method != "GET" else None,
            _REQUEST_TIMEOUT_SECONDS,
        )
        return {"http_code": status, "data": result}

    async def _authenticate(self) -> None:
        if self._access_token and self._ibs_client_id:
            return
        async with self._authentication_lock:
            if self._access_token and self._ibs_client_id:
                return
            try:
                private_key_data = await asyncio.to_thread(
                    Path(self.credentials.private_key_path).read_bytes
                )
                private_key = serialization.load_pem_private_key(
                    private_key_data, password=None
                )
            except (OSError, ValueError, TypeError) as error:
                raise ProviderError(
                    "Safe Haven private key is not available", 503
                ) from error
            now = int(time.time())
            claims = {
                "iss": self.credentials.company_url.rstrip("/"),
                "sub": self.credentials.client_id,
                "aud": self.credentials.base_url.rstrip("/"),
                "iat": now,
                "exp": now + 3600,
                "jti": secrets.token_hex(16),
            }
            unsigned = (
                f"{_base64url(json.dumps({'alg': 'RS256', 'typ': 'JWT'}).encode())}."
                f"{_base64url(json.dumps(claims, separators=(',', ':')).encode())}"
            )
            try:
                signature = private_key.sign(
                    unsigned.encode("ascii"),
                    padding.PKCS1v15(),
                    hashes.SHA256(),
                )
            except (AttributeError, TypeError, ValueError) as error:
                raise ProviderError(
                    "Safe Haven private key is not available", 503
                ) from error
            assertion = f"{unsigned}.{_base64url(signature)}"
            token_url = urljoin(
                self.credentials.base_url.rstrip("/") + "/", "oauth2/token"
            )
            result, status = await asyncio.to_thread(
                _request_json,
                token_url,
                "POST",
                {"content-type": "application/json", "accept": "application/json"},
                {
                    "grant_type": "client_credentials",
                    "client_id": self.credentials.client_id,
                    "client_assertion_type": (
                        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
                    ),
                    "client_assertion": assertion,
                },
                _AUTH_TIMEOUT_SECONDS,
            )
            if (
                status < 200
                or status >= 300
                or not isinstance(result, dict)
                or not isinstance(result.get("access_token"), str)
                or not isinstance(result.get("ibs_client_id"), str)
            ):
                raise ProviderError("Safe Haven authentication failed", 502)
            self._access_token = result["access_token"]
            self._ibs_client_id = result["ibs_client_id"]


def get_safehaven_client(mode: SafeHavenMode = "test") -> SafeHavenClient:
    return SafeHavenClient(load_safehaven_credentials(mode))


async def generate_virtual_account(input: dict[str, Any]) -> dict[str, Any]:
    amount = input.get("amount")
    reference = input.get("externalReference")
    if (
        isinstance(amount, bool)
        or not isinstance(amount, (int, float))
        or not _is_finite_positive(amount)
        or not isinstance(reference, str)
        or not reference.strip()
    ):
        raise ProviderError("A valid amount and external reference are required", 400)
    mode = input.get("mode", "test")
    if mode not in {"live", "test"}:
        raise ProviderError("Safe Haven environment is invalid", 503)
    client = await SafeHavenClient.create(mode)
    profile = client.get_profile()
    if not profile["mainAccountNumber"]:
        raise ProviderError("Safe Haven settlement account is unavailable", 503)
    result = await client.execute_request(
        "virtual-accounts",
        "POST",
        {
            "validFor": input.get("validFor", 900),
            "callbackUrl": client.get_callback_url(),
            "settlementAccount": {
                "bankCode": "090286",
                "accountNumber": profile["mainAccountNumber"],
            },
            "amountControl": input.get("amountControl", "Fixed"),
            "amount": int(amount),
            "externalReference": reference.strip(),
        },
    )
    body = result.get("data") if isinstance(result.get("data"), dict) else {}
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    try:
        status_code = int(body.get("statusCode", 0))
    except (TypeError, ValueError):
        status_code = 0
    if (
        result["http_code"] not in {200, 201}
        or status_code not in {200, 201}
        or not data
    ):
        raise ProviderError(
            str(body.get("message") or body.get("error") or "Safe Haven could not generate a virtual account"),
            502,
        )
    return {
        "success": True,
        "message": "Virtual account generated successfully",
        "data": {
            "bank_name": "Safe Haven Microfinance Bank",
            "account_number": str(data.get("accountNumber") or ""),
            "account_name": str(data.get("accountName") or "CardGlade Checkout"),
            "amount": data.get("amount", amount),
            "expiry": str(data.get("expiryDate") or ""),
            "reference": reference.strip(),
        },
    }


def initiate_safehaven_transfer() -> None:
    raise ProviderError(
        "Safe Haven transfers have no executable provider operation", 501
    )


def get_safehaven_transfer_status() -> None:
    raise ProviderError(
        "Safe Haven transfer status has no executable provider operation", 501
    )


def initialize_safehaven_ussd_payment() -> None:
    raise ProviderError(
        "Safe Haven USSD payments have no executable provider operation", 501
    )


def verify_safehaven_ussd_payment() -> None:
    raise ProviderError(
        "Safe Haven USSD verification has no executable provider operation", 501
    )


def _request_json(
    url: str,
    method: str,
    headers: dict[str, str],
    payload: dict[str, Any] | None,
    timeout_seconds: int,
) -> tuple[Any, int]:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body = response.read()
            status = response.status
    except HTTPError as error:
        body = error.read()
        status = error.code
    except (TimeoutError, URLError, OSError) as error:
        raise ProviderError("Unable to reach Safe Haven", 502) from error
    try:
        result = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        result = {}
    return result, status


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _is_finite_positive(value: int | float) -> bool:
    return math.isfinite(value) and value > 0
