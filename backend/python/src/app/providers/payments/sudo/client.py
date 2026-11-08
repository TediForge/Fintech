"""Sudo Africa API operations and response handling."""

import asyncio
import json
from functools import lru_cache
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from app.providers.payments.sudo.credentials import (
    SudoCredentials,
    load_sudo_credentials,
)
from app.providers.types import ProviderError

SudoAfricaMode = Literal["live", "test"]
SudoAfricaMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]
SudoAfricaQuery = dict[str, str | int | bool | None]
_TIMEOUT_SECONDS = 30


class SudoClient:
    """Sudo Africa API adapter with database credentials injected per client."""

    def __init__(self, credentials: SudoCredentials | None = None) -> None:
        self.credentials = credentials

    async def request(
        self,
        path: str,
        mode: SudoAfricaMode,
        method: SudoAfricaMethod,
        payload: dict[str, Any] | None = None,
        query: SudoAfricaQuery | None = None,
    ) -> dict[str, Any]:
        if mode not in {"live", "test"}:
            raise ProviderError("Sudo Africa mode is invalid", 400)
        credentials = self.credentials or load_sudo_credentials()
        base_url = (
            "https://api.sudo.africa"
            if mode == "live"
            else "https://api.sandbox.sudo.cards"
        )
        url = f"{base_url}/{path.lstrip('/')}"
        parameters = {
            key: str(value)
            for key, value in (query or {}).items()
            if value is not None and value != ""
        }
        if parameters:
            url = f"{url}?{urlencode(parameters)}"
        headers = {
            "accept": "application/json",
            "authorization": f"Bearer {credentials.api_key}",
        }
        if payload is not None:
            headers["content-type"] = "application/json"
        data, status = await asyncio.to_thread(
            _request_json, url, method, headers, payload, _TIMEOUT_SECONDS
        )
        masked = _mask_sensitive(data)
        if status < 200 or status >= 300:
            message = (
                masked.get("message")
                if isinstance(masked, dict) and isinstance(masked.get("message"), str)
                else "Sudo Africa request failed"
            )
            raise ProviderError(
                message, status if 400 <= status < 500 else 502
            )
        return {"data": masked, "status": status}


@lru_cache(maxsize=1)
def get_sudo_client() -> SudoClient:
    return SudoClient()


async def _call(
    path: str,
    mode: SudoAfricaMode,
    method: SudoAfricaMethod,
    payload: dict[str, Any] | None = None,
    query: SudoAfricaQuery | None = None,
    unwrap: bool = False,
) -> Any:
    result = await get_sudo_client().request(path, mode, method, payload, query)
    return result["data"] if unwrap else result


def _id(value: str) -> str:
    return quote(value, safe="")


async def create_account(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/accounts", mode, "POST", payload)


async def list_accounts(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/accounts", mode, "GET", query=query)


async def view_account(account_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/accounts/{_id(account_id)}", mode, "GET", query=query)


async def get_account_balance(account_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/accounts/{_id(account_id)}/balance", mode, "GET", query=query)


async def get_account_transactions(account_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/accounts/{_id(account_id)}/transactions", mode, "GET", query=query)


async def create_customer(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/customers", mode, "POST", payload)


async def list_customers(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/customers", mode, "GET", query=query)


async def view_customer(customer_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/customers/{_id(customer_id)}", mode, "GET", query=query)


async def update_customer(customer_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/customers/{_id(customer_id)}", mode, "PUT", payload)


async def generate_customer_document_url(customer_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/customers/{_id(customer_id)}/documents/url", mode, "PUT", payload)


async def create_card(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/cards", mode, "POST", payload)


async def list_cards(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/cards", mode, "GET", query=query)


async def list_customer_cards(customer_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/cards/customer/{_id(customer_id)}", mode, "GET", query=query)


async def view_card(card_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/cards/{_id(card_id)}", mode, "GET", query=query)


async def update_card(card_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/cards/{_id(card_id)}", mode, "PUT", payload)


async def digitalize_card(card_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/cards/digitalize/{_id(card_id)}", mode, "PUT", payload)


async def change_card_pin(card_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/cards/{_id(card_id)}/pin", mode, "PUT", payload)


async def send_card_pin(card_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/cards/{_id(card_id)}/send-pin", mode, "PUT", payload)


async def enroll_card_two_factor(card_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/cards/{_id(card_id)}/enroll2fa", mode, "PUT", payload)


async def order_physical_cards(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/cards/order", mode, "POST", payload)


async def generate_card_token(card_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/cards/{_id(card_id)}/token", mode, "GET", query=query)


async def list_card_transactions(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/cards/transactions", mode, "GET", query=query)


async def list_card_transactions_for_card(card_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/cards/{_id(card_id)}/transactions", mode, "GET", query=query)


async def view_card_transaction(transaction_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/cards/transactions/{_id(transaction_id)}", mode, "GET", query=query)


async def update_card_transaction(transaction_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/cards/transactions/{_id(transaction_id)}", mode, "PUT", payload)


async def list_authorizations(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/cards/authorizations", mode, "GET", query=query)


async def list_card_authorizations(card_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/cards/{_id(card_id)}/authorizations", mode, "GET", query=query)


async def view_authorization(authorization_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/cards/authorizations/{_id(authorization_id)}", mode, "GET", query=query)


async def update_authorization(authorization_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/cards/authorizations/{_id(authorization_id)}", mode, "PUT", payload)


async def create_card_program(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/card-programs", mode, "POST", payload)


async def list_card_programs(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/card-programs", mode, "GET", query=query)


async def view_card_program(program_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/card-programs/{_id(program_id)}", mode, "GET", query=query)


async def update_card_program(program_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/card-programs/{_id(program_id)}", mode, "PATCH", payload)


async def list_card_program_cards(program_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/card-programs/{_id(program_id)}/cards", mode, "GET", query=query)


async def create_dispute(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/cards/disputes", mode, "POST", payload)


async def list_disputes(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/cards/disputes", mode, "GET", query=query)


async def view_dispute(dispute_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/cards/disputes/{_id(dispute_id)}", mode, "GET", query=query)


async def update_dispute(dispute_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/cards/disputes/{_id(dispute_id)}", mode, "PUT", payload)


async def create_funding_source(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/fundingsources", mode, "POST", payload)


async def list_funding_sources(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/fundingsources", mode, "GET", query=query)


async def view_funding_source(source_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call(f"/fundingsources/{_id(source_id)}", mode, "GET", query=query)


async def update_funding_source(source_id: str, payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call(f"/fundingsources/{_id(source_id)}", mode, "PUT", payload)


async def authorize_just_in_time_transaction(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/gateways/jit-authorization", mode, "POST", payload)


async def order_physical_card(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/cards/order", mode, "POST", payload)


async def fund_simulator_account(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/accounts/simulator/fund", mode, "POST", payload)


async def generate_simulator_card(mode: SudoAfricaMode, query: SudoAfricaQuery | None = None) -> dict[str, Any]:
    return await _call("/cards/simulator/generate", mode, "GET", query=query)


async def enquire_simulator_balance(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/cards/simulator/balance_enqiry", mode, "POST", payload)


async def simulate_card_authorization(payload: dict[str, Any], mode: SudoAfricaMode) -> dict[str, Any]:
    return await _call("/cards/simulator/authorization", mode, "POST", payload)


async def simulate_authorization_reversal(
    authorization_id: str, mode: SudoAfricaMode, query: SudoAfricaQuery | None = None
) -> dict[str, Any]:
    return await _call(
        f"/cards/simulator/authorization/{_id(authorization_id)}/reversal",
        mode,
        "GET",
        query=query,
    )


async def get_transfer_banks(
    country: str = "NG", mode: SudoAfricaMode = "live"
) -> Any:
    return await _call("/accounts/banks", mode, "GET", query={"country": country}, unwrap=True)


async def verify_transfer_recipient(
    bank_code: str, account_number: str, mode: SudoAfricaMode
) -> Any:
    return await _call(
        "/accounts/transfer/name-enquiry",
        mode,
        "POST",
        {"bankCode": bank_code, "accountNumber": account_number},
        unwrap=True,
    )


async def create_bank_transfer(payload: dict[str, Any], mode: SudoAfricaMode) -> Any:
    return await _call("/accounts/transfer", mode, "POST", payload, unwrap=True)


async def get_bank_transfer_status(transfer_id: str, mode: SudoAfricaMode) -> Any:
    if not transfer_id.strip() or len(transfer_id) > 150:
        raise ProviderError("transferId is invalid", 400)
    return await _call(
        f"/accounts/transfers/{_id(transfer_id.strip())}", mode, "GET", unwrap=True
    )


async def get_transfer_rate(
    currency_pair: str,
    mode: SudoAfricaMode,
    query: SudoAfricaQuery | None = None,
) -> dict[str, Any]:
    return await _call(
        f"/accounts/transfer/rate/{_id(currency_pair)}",
        mode,
        "GET",
        query=query,
    )


def _request_json(
    url: str,
    method: SudoAfricaMethod,
    headers: dict[str, str],
    payload: dict[str, Any] | None,
    timeout_seconds: int,
) -> tuple[Any, int]:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8")
        if payload is not None and method != "GET"
        else None,
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
        raise ProviderError("Unable to reach Sudo Africa", 502) from error
    try:
        return json.loads(body), status
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError("Sudo Africa returned an invalid response", 502) from error


def _mask_sensitive(value: Any) -> Any:
    if isinstance(value, list):
        return [_mask_sensitive(item) for item in value]
    if not isinstance(value, dict):
        return value
    sensitive = {
        "secretkey",
        "password",
        "pin",
        "oldpin",
        "newpin",
        "accountnumber",
        "expirationdate",
        "cvv",
        "pan",
        "cardnumber",
        "token",
    }
    return {
        key: "***"
        if key.lower() in sensitive and isinstance(nested, str)
        else _mask_sensitive(nested)
        for key, nested in value.items()
    }
