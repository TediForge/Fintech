"""Remita RRR lookup, payment, and status operations."""

import asyncio
import json
from typing import Any, Literal, TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from app.providers.payments.remita.config import RemitaConfig
from app.providers.payments.remita.credentials import (
    RemitaCredentials,
    RemitaMode,
    load_remita_credentials,
)
from app.providers.types import ProviderError

_LIVE_BASE_URL = "https://login.remita.net"
_TEST_BASE_URL = "https://remitademo.net"
_DEFAULT_PATHS = {
    "lookup": "/remita/ecomm/api/rrrlookup",
    "payment": "/remita/ecomm/init.reg",
    "status": "/remita/ecomm/api/transactionstatus",
}
_REQUEST_TIMEOUT_SECONDS = 45


class RemitaNormalizedResponse(TypedDict):
    success: bool
    code: str
    message: str
    rrr: str
    amount: float
    currency: str
    payerName: str
    status: str
    reference: str
    raw: Any


class RemitaClient:
    """Remita REST client with injected provider-specific credentials."""

    def __init__(
        self,
        credentials: RemitaCredentials,
        config: RemitaConfig | None = None,
    ) -> None:
        self.credentials = credentials
        self.config = config or RemitaConfig()

    async def lookup(self, rrr: str) -> Any:
        return await self._request(self._path("lookup"), {"rrr": rrr})

    async def pay(
        self, rrr: str, amount: float, currency: str, reference: str
    ) -> Any:
        return await self._request(
            self._path("payment"),
            {
                "rrr": rrr,
                "amount": f"{amount:.2f}",
                "currency": currency,
                "transactionId": reference,
            },
        )

    async def status(self, rrr: str, reference: str = "") -> Any:
        payload: dict[str, Any] = {"rrr": rrr}
        if reference:
            payload["transactionId"] = reference
        return await self._request(self._path("status"), payload)

    def normalize(self, response: Any) -> RemitaNormalizedResponse:
        data = response.get("data") if isinstance(response, dict) else None
        data = data if isinstance(data, dict) else {}
        nested = data.get("data") if isinstance(data.get("data"), dict) else data
        response_code = data.get(
            "responseCode", data.get("status", data.get("statusCode", ""))
        )
        try:
            amount = float(nested.get("amount", nested.get("amt", 0)) or 0)
        except (TypeError, ValueError):
            amount = 0.0
        return {
            "success": str(response_code).lower()
            in {"00", "0", "success", "successful", "200"},
            "code": str(data.get("responseCode", data.get("statusCode", data.get("code", "")))),
            "message": str(data.get("responseMsg", data.get("message", data.get("statusMessage", "")))),
            "rrr": str(nested.get("rrr", nested.get("RRR", ""))),
            "amount": amount,
            "currency": str(nested.get("currency", "NGN")).upper(),
            "payerName": str(nested.get("payerName", nested.get("name", ""))),
            "status": str(nested.get("status", nested.get("paymentStatus", "unknown"))).lower(),
            "reference": str(nested.get("transactionId", nested.get("reference", ""))),
            "raw": response,
        }

    def _path(self, operation: Literal["lookup", "payment", "status"]) -> str:
        mode = self.credentials.environment.lower()
        configured = getattr(self.config, f"remita_{mode}_{operation}_path")
        return (configured or _DEFAULT_PATHS[operation]).strip()

    def _base_url(self) -> str:
        mode = self.credentials.environment.lower()
        configured = getattr(self.config, f"remita_{mode}_base_url")
        default = _LIVE_BASE_URL if self.credentials.environment == "LIVE" else _TEST_BASE_URL
        return (configured or default).rstrip("/")

    async def _request(self, path: str, payload: dict[str, Any]) -> Any:
        url = urljoin(self._base_url() + "/", path.lstrip("/"))
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Api-Key": self.credentials.api_key,
            "authorization": f"Bearer {self.credentials.secret_key}",
        }
        if self.credentials.merchant_id:
            headers["Merchant-Id"] = self.credentials.merchant_id
        return await asyncio.to_thread(
            _request_json, url, headers, payload, _REQUEST_TIMEOUT_SECONDS
        )


def get_remita_client(environment: RemitaMode = "LIVE") -> RemitaClient:
    return RemitaClient(load_remita_credentials(environment))


def create_remita_client(
    environment: RemitaMode, config: RemitaConfig | None = None
) -> RemitaClient:
    return RemitaClient(load_remita_credentials(environment), config)


async def lookup_remita_rrr(environment: RemitaMode, rrr: str) -> Any:
    return await get_remita_client(environment).lookup(rrr)


async def pay_remita_rrr(
    environment: RemitaMode,
    rrr: str,
    amount: float,
    currency: str,
    reference: str,
) -> Any:
    return await get_remita_client(environment).pay(rrr, amount, currency, reference)


async def get_remita_rrr_status(
    environment: RemitaMode, rrr: str, reference: str = ""
) -> Any:
    return await get_remita_client(environment).status(rrr, reference)


def _request_json(
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout_seconds: int,
) -> Any:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body = response.read()
            status = response.status
    except HTTPError as error:
        body = error.read()
        status = error.code
    except (TimeoutError, URLError, OSError) as error:
        raise ProviderError("Unable to reach Remita", 502) from error
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        data = {}
    if not 200 <= status < 300:
        message = data.get("message") if isinstance(data, dict) else None
        raise ProviderError(
            str(message or "Remita request failed"),
            status if 400 <= status < 500 else 502,
        )
    return {"httpCode": status, "data": data, "raw": body.decode("utf-8", errors="replace")}
