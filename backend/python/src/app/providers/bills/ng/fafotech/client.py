"""Fafotech balance and data bundle operations."""

import asyncio
import json
import math
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from app.providers.bills.ng.fafotech.credentials import (
    FafotechCredentials,
    load_fafotech_credentials,
)
from app.providers.types import (
    DataPurchaseInput,
    NormalizedDataPlan,
    ProviderError,
    ProviderResponse,
    ProviderStatus,
)

_BASE_URL = "https://fafotech.com/api"
_TIMEOUT_SECONDS = 60
_BALANCE_TIMEOUT_SECONDS = 30
_PROFIT_MARGINS = {
    "SME": 0.03,
    "SME 2": 0.03,
    "DATA COUPONS": 0.03,
    "AWOOF GIFTING": 0.03,
    "CORPORATE GIFTING": 0.04,
    "GIFTING": 0.05,
    "TALK MORE": 0.05,
    "DEFAULT": 0.03,
}
_NETWORKS = ("MTN", "GLO", "9MOBILE", "AIRTEL")
_NETWORK_IDS = {"mtn": 1, "glo": 2, "airtel": 3, "9mobile": 4}
_SOCIAL_PLATFORMS = (
    ("facebook", "Facebook"),
    ("whatsapp", "WhatsApp"),
    ("tiktok", "TikTok"),
    ("instagram", "Instagram"),
    ("youtube", "YouTube"),
    ("opera", "Opera Mini"),
    ("social", "Social"),
)
_BROADBAND_PATTERN = re.compile(
    r"\b(broadband|boardband|router|modem|home|fixed|mifi|hybrid|hynetflex)\b"
)
FafotechMode = Literal["live", "test"]
_MOCK_DATA_PLANS = (
    {"id": 212, "plan": "1GB SME", "plan_type": "SME", "plan_amount": 300, "month_validate": "30 days"},
    {"id": 213, "plan": "2GB SME", "plan_type": "SME", "plan_amount": 550, "month_validate": "30 days"},
)


async def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    query: dict[str, Any] | None = None,
    timeout_seconds: float = 60,
) -> tuple[Any, int]:
    if query:
        url = f"{url}{'&' if '?' in url else '?'}{urlencode(query)}"
    return await asyncio.to_thread(
        _request_json_sync, url, method, headers or {}, body, timeout_seconds
    )


def _request_json_sync(
    url: str,
    method: str,
    headers: dict[str, str],
    body: bytes | None,
    timeout_seconds: float,
) -> tuple[Any, int]:
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            response_body = response.read()
            status = response.status
    except HTTPError as error:
        raise ProviderError(
            f"Fafotech request failed with status {error.code}", error.code
        ) from error
    except (TimeoutError, URLError, OSError) as error:
        raise ProviderError("Unable to connect to Fafotech") from error
    try:
        return json.loads(response_body), status
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError("Fafotech returned invalid JSON", 502) from error


class FafotechClient:
    """Fafotech HTTP operations using fixed provider endpoints and timeouts."""

    def __init__(self, credentials: FafotechCredentials | None = None) -> None:
        self._credentials = credentials

    async def get_balance(self, mode: str = "test", api_key: str | None = None) -> float:
        selected_mode = _normalize_mode(mode)
        if selected_mode == "test":
            return 50_000
        credential = (
            api_key.strip()
            if api_key and api_key.strip()
            else self._get_api_key()
        )

        data, _ = await request_json(
            f"{_BASE_URL}/user/",
            headers={
                "Authorization": f"Token {credential}",
                "Content-Type": "application/json",
                "accept": "application/json",
            },
            timeout_seconds=_BALANCE_TIMEOUT_SECONDS,
        )
        if not isinstance(data, dict):
            raise ProviderError("Fafotech returned an invalid balance response", 503)
        if data.get("error") or data.get("message"):
            raise ProviderError(str(data.get("error") or data.get("message")), 503)
        user = data.get("user")
        user_balance = user.get("Account_Balance") if isinstance(user, dict) else None
        balance_value = user_balance if user_balance is not None else data.get("balance")
        try:
            balance = float(balance_value)
        except (TypeError, ValueError) as error:
            raise ProviderError("Fafotech returned an invalid balance", 503) from error
        if not math.isfinite(balance) or balance < 0:
            raise ProviderError("Fafotech returned an invalid balance", 503)
        return balance

    async def get_data_plan_catalog(
        self, search: str = "", mode: FafotechMode = "live"
    ) -> dict[str, list[NormalizedDataPlan]]:
        selected_mode = _normalize_mode(mode)
        if selected_mode == "test":
            return _mock_data_plans(search)
        api_key = self._get_api_key()
        query = search.strip()
        url = (
            f"{_BASE_URL}/data/?{urlencode({'search': query})}"
            if query
            else f"{_BASE_URL}/network/"
        )
        source, _ = await request_json(
            url,
            headers={
                "Authorization": f"Token {api_key}",
                "accept": "application/json",
            },
            timeout_seconds=_TIMEOUT_SECONDS,
        )
        if not isinstance(source, dict):
            raise ProviderError("Fafotech returned an invalid data-plan response")

        output: dict[str, list[NormalizedDataPlan]] = {}
        for network in _NETWORKS:
            grouped: dict[tuple[str, str, str], NormalizedDataPlan] = {}
            raw_plans = source.get(f"{network}_PLAN")
            if isinstance(raw_plans, list):
                for item in raw_plans:
                    if not isinstance(item, dict):
                        continue
                    plan = _clean_plan(item, network)
                    if plan is None:
                        continue
                    key = (network, plan["duration_category"], plan["plan_size"])
                    current = grouped.get(key)
                    if (
                        current is None
                        or plan["validity_days"] > current["validity_days"]
                        or (
                            plan["validity_days"] == current["validity_days"]
                            and plan["selling_price"] < current["selling_price"]
                        )
                        or (
                            plan["validity_days"] == current["validity_days"]
                            and plan["selling_price"] == current["selling_price"]
                            and plan["providerPlanId"] > current["providerPlanId"]
                        )
                    ):
                        grouped[key] = plan
            output[f"{network}_PLAN"] = list(grouped.values())
        return output

    async def purchase_data(self, input: DataPurchaseInput) -> ProviderResponse:
        mode = _normalize_mode(input["mode"])
        network_id = _NETWORK_IDS.get(input["network"].strip().lower())
        try:
            numeric_plan_id = float(input["providerPlanId"])
        except (TypeError, ValueError):
            numeric_plan_id = 0
        if (
            not network_id
            or not math.isfinite(numeric_plan_id)
            or not numeric_plan_id.is_integer()
            or numeric_plan_id < 1
            or numeric_plan_id > 9_007_199_254_740_991
            or not input["phone"].strip()
        ):
            raise ProviderError(
                "Required Fafotech data purchase parameters are invalid", 400
            )
        plan_id = int(numeric_plan_id)

        payload = {
            "network": network_id,
            "mobile_number": input["phone"],
            "plan": plan_id,
            "Ported_number": input["ported"],
        }
        if mode == "test":
            raw: object = {
                "id": 3_500_000,
                "ident": f"DATA-mock-{uuid.uuid4()}",
                "customer_ref": "",
                "network": network_id,
                "balance_before": "1000.00",
                "api_response": (
                    f"You have successfully gifted mock test plan to {input['phone']}"
                ),
                "balance_after": "950.00",
                "mobile_number": input["phone"],
                "plan": plan_id,
                "Status": "successful",
                "plan_network": input["network"].upper(),
                "plan_name": "Mock Plan",
                "plan_amount": "50.0",
                "create_date": datetime.now(timezone.utc).isoformat(),
                "Ported_number": input["ported"],
            }
            http_status = 200
        else:
            api_key = self._get_api_key()
            balance = await self.get_balance(input["mode"], api_key)
            if input["amount"] <= 0 or balance < input["amount"]:
                raise ProviderError("Provider service temporarily unavailable", 503)
            raw, http_status = await request_json(
                f"{_BASE_URL}/data/",
                method="POST",
                headers={
                    "Authorization": f"Token {api_key}",
                    "Content-Type": "application/json",
                    "accept": "application/json",
                },
                body=json.dumps(payload).encode("utf-8"),
                timeout_seconds=_TIMEOUT_SECONDS,
            )
        return _classify_provider_response(raw, mode, http_status)

    async def purchase_airtime(
        self,
        network: str,
        amount: Decimal | float | int | str,
        mobile_number: str,
        mode: FafotechMode = "test",
        ported: bool = True,
        airtime_type: str = "VTU",
    ) -> dict[str, Any]:
        selected_mode = _normalize_mode(mode)
        network_id = _NETWORK_IDS.get(network.strip().lower())
        normalized_amount = _positive_decimal(amount, "amount")
        if not network_id or not mobile_number.strip():
            raise ProviderError("Invalid Fafotech airtime parameters", 400)
        payload = {
            "network": network_id,
            "amount": str(normalized_amount),
            "mobile_number": mobile_number.strip(),
            "Ported_number": ported,
            "airtime_type": airtime_type,
        }
        if selected_mode == "test":
            return _mock_response(
                {
                    "id": 512_000,
                    "ident": f"AIRTIME-mock-{uuid.uuid4()}",
                    "amount": str(normalized_amount),
                    "mobile_number": mobile_number.strip(),
                }
            )
        return await self._provider_request(
            "POST", "/topup/", payload=payload
        )

    async def query_airtime(self, transaction_id: str, mode: FafotechMode = "test") -> dict[str, Any]:
        return await self._query_transaction("topup", transaction_id, mode)

    async def validate_cable(
        self, cable_name: int | str, smart_card_number: str, mode: FafotechMode = "test"
    ) -> dict[str, Any]:
        selected_mode = _normalize_mode(mode)
        if not smart_card_number.strip():
            raise ProviderError("smartCardNumber is required", 400)
        if selected_mode == "test":
            return _mock_response(
                {"customerName": "Mock Customer", "smartCardNumber": smart_card_number.strip(), "cableName": str(cable_name)}
            )
        return await self._provider_request(
            "GET",
            "/validateiuc/",
            query={"smart_card_number": smart_card_number.strip(), "cablename": cable_name},
        )

    async def purchase_cable(
        self,
        cable_name: int | str,
        cable_plan: int | str,
        smart_card_number: str,
        mode: FafotechMode = "test",
    ) -> dict[str, Any]:
        selected_mode = _normalize_mode(mode)
        if not smart_card_number.strip():
            raise ProviderError("smartCardNumber is required", 400)
        payload = {
            "cablename": cable_name,
            "cableplan": cable_plan,
            "smart_card_number": smart_card_number.strip(),
        }
        if selected_mode == "test":
            return _mock_response(
                {"id": 2_500_000, "ident": f"CABLE-mock-{uuid.uuid4()}", **payload}
            )
        return await self._provider_request(
            "POST", "/cablesub/", payload=payload
        )

    async def query_cable(self, transaction_id: str, mode: FafotechMode = "test") -> dict[str, Any]:
        return await self._query_transaction("cablesub", transaction_id, mode)

    async def validate_meter(
        self,
        meter_number: str,
        disco_name: int | str,
        meter_type: int,
        mode: FafotechMode = "test",
    ) -> dict[str, Any]:
        selected_mode = _normalize_mode(mode)
        if not meter_number.strip():
            raise ProviderError("meterNumber is required", 400)
        if isinstance(meter_type, bool) or not isinstance(meter_type, int):
            raise ProviderError("meterType is invalid", 400)
        if selected_mode == "test":
            return _mock_response(
                {"customerName": "Mock Customer", "meterNumber": meter_number.strip()}
            )
        return await self._provider_request(
            "GET",
            "/validatemeter/",
            query={
                "meternumber": meter_number.strip(),
                "disconame": disco_name,
                "mtype": meter_type,
            },
        )

    async def purchase_electricity(
        self,
        disco_name: int | str,
        amount: Decimal | float | int | str,
        meter_number: str,
        meter_type: int,
        mode: FafotechMode = "test",
    ) -> dict[str, Any]:
        selected_mode = _normalize_mode(mode)
        normalized_amount = _positive_decimal(amount, "amount")
        if not meter_number.strip():
            raise ProviderError("meterNumber is required", 400)
        if isinstance(meter_type, bool) or not isinstance(meter_type, int):
            raise ProviderError("meterType is invalid", 400)
        payload = {
            "disco_name": disco_name,
            "amount": str(normalized_amount),
            "meter_number": meter_number.strip(),
            "MeterType": meter_type,
        }
        if selected_mode == "test":
            return _mock_response(
                {
                    "id": 4_500_000,
                    "ident": f"ELECTRICITY-mock-{uuid.uuid4()}",
                    "meterNumber": meter_number.strip(),
                    **payload,
                }
            )
        return await self._provider_request(
            "POST", "/billpayment/", payload=payload
        )

    async def query_electricity(
        self, transaction_id: str, mode: FafotechMode = "test"
    ) -> dict[str, Any]:
        return await self._query_transaction("billpayment", transaction_id, mode)

    async def get_provider_status(self, mode: FafotechMode = "test") -> dict[str, Any]:
        selected_mode = _normalize_mode(mode)
        balance = await self.get_balance(selected_mode)
        return {
            "provider": "fafotech",
            "environment": selected_mode.upper(),
            "status": "available",
            "balance": str(balance),
            "mock": selected_mode == "test",
            "networks": [
                {"name": name, "id": _NETWORK_IDS[name.lower()]}
                for name in _NETWORKS
            ],
        }

    async def _query_transaction(
        self, endpoint: str, transaction_id: str, mode: FafotechMode
    ) -> dict[str, Any]:
        selected_mode = _normalize_mode(mode)
        identifier = transaction_id.strip()
        if not identifier:
            raise ProviderError("transactionId is required", 400)
        if selected_mode == "test":
            return _mock_response({"id": identifier})
        return await self._provider_request(
            "GET",
            f"/{endpoint}/{quote(identifier, safe='')}/",
        )

    async def _provider_request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
        timeout_seconds: int = _TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        api_key = self._get_api_key()
        result, status = await request_json(
            f"{_BASE_URL}{path}",
            method=method,
            headers={
                "Authorization": f"Token {api_key}",
                "accept": "application/json",
            },
            body=json.dumps(payload).encode("utf-8") if payload is not None else None,
            query=query,
            timeout_seconds=timeout_seconds,
        )
        if not 200 <= status < 300:
            raise ProviderError("Fafotech request failed", status)
        if not isinstance(result, dict):
            raise ProviderError("Fafotech returned an invalid response", 502)
        return result

    def _get_api_key(self) -> str:
        credentials = self._credentials or load_fafotech_credentials()
        return credentials.api_key


@lru_cache(maxsize=1)
def get_fafotech_client() -> FafotechClient:
    """Return the shared Fafotech client."""
    return FafotechClient()


async def get_fafotech_balance(mode: str = "test", api_key: str | None = None) -> float:
    return await get_fafotech_client().get_balance(mode, api_key)


async def get_data_plan_catalog(
    search: str = "", mode: FafotechMode = "live",
) -> dict[str, list[NormalizedDataPlan]]:
    return await get_fafotech_client().get_data_plan_catalog(search, mode)


async def purchase_data(input: DataPurchaseInput) -> ProviderResponse:
    return await get_fafotech_client().purchase_data(input)


async def purchase_airtime(
    network: str, amount: Decimal | float | int | str, mobile_number: str,
    mode: FafotechMode = "test", ported: bool = True, airtime_type: str = "VTU",
) -> dict[str, Any]:
    return await get_fafotech_client().purchase_airtime(
        network, amount, mobile_number, mode, ported, airtime_type
    )


async def query_airtime(transaction_id: str, mode: FafotechMode = "test") -> dict[str, Any]:
    return await get_fafotech_client().query_airtime(transaction_id, mode)


async def validate_cable(
    cable_name: int | str, smart_card_number: str, mode: FafotechMode = "test"
) -> dict[str, Any]:
    return await get_fafotech_client().validate_cable(cable_name, smart_card_number, mode)


async def purchase_cable(
    cable_name: int | str, cable_plan: int | str, smart_card_number: str,
    mode: FafotechMode = "test",
) -> dict[str, Any]:
    return await get_fafotech_client().purchase_cable(
        cable_name, cable_plan, smart_card_number, mode
    )


async def query_cable(transaction_id: str, mode: FafotechMode = "test") -> dict[str, Any]:
    return await get_fafotech_client().query_cable(transaction_id, mode)


async def validate_meter(
    meter_number: str, disco_name: int | str, meter_type: int,
    mode: FafotechMode = "test",
) -> dict[str, Any]:
    return await get_fafotech_client().validate_meter(
        meter_number, disco_name, meter_type, mode
    )


async def purchase_electricity(
    disco_name: int | str, amount: Decimal | float | int | str,
    meter_number: str, meter_type: int, mode: FafotechMode = "test",
) -> dict[str, Any]:
    return await get_fafotech_client().purchase_electricity(
        disco_name, amount, meter_number, meter_type, mode
    )


async def query_electricity(
    transaction_id: str, mode: FafotechMode = "test"
) -> dict[str, Any]:
    return await get_fafotech_client().query_electricity(transaction_id, mode)


async def get_fafotech_provider_status(mode: FafotechMode = "test") -> dict[str, Any]:
    return await get_fafotech_client().get_provider_status(mode)


def _normalize_mode(mode: str) -> FafotechMode:
    normalized = mode.strip().lower()
    if normalized == "live":
        return "live"
    if normalized == "test":
        return "test"
    raise ProviderError("Fafotech mode must be live or test", 400)


def _positive_decimal(value: Decimal | float | int | str, field: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise ProviderError(f"{field} must be greater than zero", 400) from error
    if not amount.is_finite() or amount <= 0:
        raise ProviderError(f"{field} must be greater than zero", 400)
    return amount


def _mock_response(payload: dict[str, Any], status: str = "successful") -> dict[str, Any]:
    return {**payload, "Status": status, "mock": True}


def _mock_data_plans(search: str = "") -> dict[str, list[NormalizedDataPlan]]:
    del search
    output: dict[str, list[NormalizedDataPlan]] = {}
    for network in _NETWORKS:
        plans = [
            cleaned
            for item in _MOCK_DATA_PLANS
            if (cleaned := _clean_plan(item, network)) is not None
        ]
        output[f"{network}_PLAN"] = plans
    return output


def _clean_plan(plan: dict[str, Any], network: str) -> NormalizedDataPlan | None:
    provider_id = _positive_plan_id(plan.get("id"))
    if provider_id is None:
        return None
    raw_name = str(plan.get("plan") or "")
    raw_validity = str(plan.get("month_validate") or "")
    combined_text = f"{raw_name} {raw_validity}".lower()
    platform_name = next(
        (name for marker, name in _SOCIAL_PLATFORMS if marker in combined_text), ""
    )
    volume = _sanitize_volume(raw_name)
    if (
        not volume
        or not _is_standard_volume(volume)
        or _BROADBAND_PATTERN.search(combined_text)
    ):
        return None

    validity, validity_days = _format_validity(raw_validity)
    if platform_name:
        duration = "Socials"
    elif validity_days == 365:
        duration = "Yearly"
    elif validity_days <= 6:
        duration = "Daily"
    elif validity_days == 7:
        duration = "Weekly"
    else:
        duration = "Monthly"

    plan_type = str(plan.get("plan_type") or "").upper()
    try:
        cost = float(plan.get("plan_amount") or 0)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(cost) or cost <= 0:
        return None

    selling_price = _normalize_price(cost, _PROFIT_MARGINS.get(plan_type, 0.03))
    return {
        "providerPlanId": provider_id,
        "network": network,
        "plan_type": plan_type,
        "plan_name": f"{volume}{f' {platform_name}' if platform_name else ''}",
        "plan_size": volume,
        "provider_price": cost,
        "selling_price": selling_price,
        "profit": selling_price - cost,
        "validity": validity,
        "duration_category": duration,
        "platformName": platform_name,
        "validity_days": validity_days,
    }


def _positive_plan_id(value: Any) -> str | None:
    try:
        plan_id = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return str(plan_id) if plan_id > 0 else None


def _sanitize_volume(plan_name: str) -> str | None:
    name = plan_name.strip()
    if "=" in name:
        name = name.split("=")[-1]
    elif "+" in name:
        name = name.split("+", maxsplit=1)[0]
    match = re.search(r"(\d+\.?\d*)\s*(GB|MB)", name, re.IGNORECASE)
    return match.group(0).strip().upper() if match else None


def _is_standard_volume(volume: str) -> bool:
    match = re.search(r"\d+\.?\d*", volume)
    if not match:
        return False
    value = float(match.group(0))
    return math.isfinite(value) and abs(value * 2 - round(value * 2)) < 0.0001


def _format_validity(raw: str) -> tuple[str, int]:
    text = re.sub(r"\s*\+\s*.*$", "", raw.strip().lower())
    text = re.sub(r"\b\d+\s*(mins?|minutes?|talktime)\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return _days_result(30)
    day_match = re.search(r"(\d+)\s*day", text, re.IGNORECASE)
    if day_match:
        return _days_result(int(day_match.group(1)))
    if re.search(r"(monthly|one\s*month|1\s*month|a\s*month)", text, re.IGNORECASE):
        return _days_result(30)
    if re.search(r"(weekly|one\s*week|1\s*week)", text, re.IGNORECASE):
        return _days_result(7)
    if re.search(r"(daily|one\s*day)", text, re.IGNORECASE):
        return _days_result(1)
    if re.search(r"(quarterly|3\s*month|90\s*day)", text, re.IGNORECASE):
        return _days_result(90)
    if re.search(r"(yearly|one\s*year|1\s*year|365\s*day)", text, re.IGNORECASE):
        return _days_result(365)
    if re.search(r"(bi-monthly|2\s*month|60\s*day)", text, re.IGNORECASE):
        return _days_result(60)
    match = re.search(r"(\d+)\s*(month|year)", text, re.IGNORECASE)
    if match:
        multiplier = 30 if match.group(2).lower() == "month" else 365
        return _days_result(int(match.group(1)) * multiplier)
    return _days_result(30)


def _days_result(days: int) -> tuple[str, int]:
    return f"{days} Day{'s' if days != 1 else ''}", days


def _normalize_price(cost: float, margin: float) -> float:
    target = cost * (1 + margin)
    minimum = cost * 1.01
    step = 10 if target < 500 else 50 if target < 2000 else 100 if target < 10000 else 500
    rounded = math.ceil(target / step) * step
    return float(rounded if rounded >= minimum else math.ceil(target / 10) * 10)


def _classify_provider_response(
    raw: object, mode: str, http_status: int
) -> ProviderResponse:
    raw_text = json.dumps(raw).upper()
    if any(word in raw_text for word in ("REFUNDED", "REVERSED", "CHARGEBACK")):
        status: ProviderStatus = "reversed"
    elif any(
        word in raw_text
        for word in (
            "FAILED",
            "FAIL",
            "ERROR",
            "DECLINED",
            "REJECTED",
            "INSUFFICIENT",
            "BALANCE",
            "INVALID",
        )
    ):
        status = "failed"
    elif any(word in raw_text for word in ("SUCCESS", "SUCCESSFUL", "COMPLETED", "DONE", "OK")):
        status = "success"
    elif any(word in raw_text for word in ("PENDING", "PROCESSING", "IN_PROGRESS", "QUEUED")):
        status = "pending"
    else:
        status = "failed"
    if http_status >= 400 and status == "success":
        status = "failed"
    return {
        "status": status,
        "provider_raw": raw if isinstance(raw, dict) else {},
        "bridge_logic": "fafotech_keyword_v2",
        "environment": mode,
    }
