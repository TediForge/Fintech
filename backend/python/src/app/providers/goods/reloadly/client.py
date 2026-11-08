"""Reloadly gift-card API client and brand catalog operations."""

import asyncio
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Never, TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

from app.lib.cache import get_cached_payload, store_cached_payload
from app.providers.goods.reloadly.credentials import (
    ReloadlyCredentials,
    ReloadlyMode,
    load_reloadly_credentials,
)
from app.providers.types import ProviderError

_AUTH_URL = "https://auth.reloadly.com/oauth/token"
_LIVE_BASE_URL = "https://giftcards.reloadly.com"
_TEST_BASE_URL = "https://giftcards-sandbox.reloadly.com"
_REQUEST_TIMEOUT_SECONDS = 30
_AUTH_TIMEOUT_SECONDS = 30
_BRAND_CACHE_KEY = "reloadly.giftcard.brands"
_BRAND_CACHE_TTL_SECONDS = 365 * 24 * 60 * 60


class ReloadlyPricing(TypedDict):
    baseCost: float
    discountAmount: float
    discountedCost: float
    convertedNgnCost: float
    markupAmount: float
    ourMarkupAmount: float
    markupPercentage: float
    ourRetailRateNgnPerUsd: float
    finalPrice: float
    senderCurrency: str
    ngnRateUsed: float
    fxRateUsdToNgn: float
    senderFee: float
    senderFeeUsd: float
    baseUsdCost: float
    discountUsd: float
    receiverAmountNaira: float
    senderAmountLocal: float


class ReloadlyLogo(TypedDict):
    logoUrl: str
    brandIds: list[int]
    productIds: list[int]
    blocked: bool


class ReloadlyBrand(TypedDict):
    brandName: str
    brandIds: list[int]
    productIds: list[int]
    logos: list[ReloadlyLogo]


class ReloadlyBrandCache(TypedDict):
    updatedAt: str | None
    mode: ReloadlyMode | None
    brands: list[ReloadlyBrand]


class _LogoSummary(TypedDict):
    logoUrl: str
    brandIds: list[int]
    productIds: list[int]


class _BrandSummary(TypedDict):
    brandName: str
    brandIds: list[int]
    productIds: list[int]
    logos: dict[str, _LogoSummary]


class _BrandCatalogEntry(TypedDict):
    brandName: str
    brandIds: list[int]
    productIds: list[int]
    logos: list[_LogoSummary]


@dataclass
class ReloadlyClient:
    """Reloadly client; API credentials are injected from the provider loader."""

    credentials: ReloadlyCredentials
    _token: str | None = None

    @classmethod
    def create(cls, mode: ReloadlyMode = "live") -> "ReloadlyClient":
        return cls(load_reloadly_credentials(mode))

    @property
    def base_url(self) -> str:
        return _TEST_BASE_URL if self.credentials.mode == "test" else _LIVE_BASE_URL

    @property
    def audience(self) -> str:
        return self.base_url

    async def get_access_token(self) -> str:
        if self._token:
            return self._token
        result, status = await asyncio.to_thread(
            _request_json,
            _AUTH_URL,
            "POST",
            {"content-type": "application/json", "accept": "application/json"},
            {
                "client_id": self.credentials.client_id,
                "client_secret": self.credentials.client_secret,
                "grant_type": "client_credentials",
                "audience": self.audience,
            },
            _AUTH_TIMEOUT_SECONDS,
        )
        if (
            not 200 <= status < 300
            or not isinstance(result, dict)
            or not isinstance(result.get("access_token"), str)
        ):
            raise _provider_error(result, status, "Reloadly authentication failed")
        self._token = result["access_token"]
        return self._token

    async def get_countries(self) -> Any:
        return await self._request("/countries")

    async def get_balance(self) -> Any:
        return await self._request("/accounts/balance")

    async def get_gift_cards_by_country(self, country_code: str) -> Any:
        return await self._request(
            f"/products?{urlencode({'countryCode': country_code})}"
        )

    async def get_gift_cards_products(self, page: int = 0, size: int = 200) -> Any:
        page = max(0, page)
        size = min(200, max(1, size))
        return await self._request(
            f"/products?{urlencode({'page': page, 'size': size})}"
        )

    async def get_card_details(self, product_id: str) -> Any:
        return await self._request(f"/products/{quote(product_id, safe='')}")

    async def get_redeem_instructions(self) -> Any:
        return await self._request("/redeem-instructions")

    async def get_redeem_instructions_by_brand(self, brand_id: str) -> Any:
        return await self._request(
            f"/redeem-instructions/{quote(brand_id, safe='')}"
        )

    async def get_fx_rate(self, recipient_currency: str, recipient_amount: float) -> Any:
        return await self._request(
            f"/fx-rate?{urlencode({'currencyCode': recipient_currency, 'amount': recipient_amount})}"
        )

    async def get_product_discounts(self, product_id: str) -> Any:
        return await self._request(
            f"/products/{quote(product_id, safe='')}/discounts"
        )

    async def get_discounts(self) -> Any:
        return await self._request("/discounts")

    async def create_order(self, payload: dict[str, Any]) -> Any:
        return await self._request("/orders", "POST", payload)

    async def get_redeem_codes(self, transaction_id: str) -> Any:
        return await self._request(
            f"/orders/transactions/{quote(transaction_id, safe='')}/cards"
        )

    async def get_transactions(self, query: dict[str, Any] | None = None) -> Any:
        params = {
            key: value
            for key, value in (query or {}).items()
            if value is not None
        }
        query_string = urlencode(params)
        return await self._request(
            f"/reports/transactions{f'?{query_string}' if query_string else ''}"
        )

    async def get_transaction(self, transaction_id: str) -> Any:
        return await self._request(
            f"/reports/transactions/{quote(transaction_id, safe='')}"
        )

    async def calculate_pricing(
        self,
        product_id: str,
        recipient_amount: float,
        recipient_currency_code: str,
    ) -> ReloadlyPricing:
        if not math.isfinite(recipient_amount) or recipient_amount <= 0:
            raise ProviderError("Recipient amount must be greater than zero", 400)
        details_value = await self.get_card_details(product_id)
        if not isinstance(details_value, dict):
            raise ProviderError("Reloadly product details are invalid")
        recipient_currency = recipient_currency_code.strip().upper()
        product_currency = str(details_value.get("recipientCurrencyCode") or "").upper()
        if not recipient_currency or not product_currency or recipient_currency != product_currency:
            raise ProviderError(
                "Recipient currency does not match the selected Reloadly product", 400
            )
        sender_currency = str(
            details_value.get("senderCurrencyCode") or recipient_currency
        ).upper()
        sender_fee = _numeric(details_value.get("senderFee"))
        fx_value = await self.get_fx_rate(recipient_currency, recipient_amount)
        fx = fx_value if isinstance(fx_value, dict) else {}
        product_rate = _numeric(
            details_value.get("recipientCurrencyToSenderCurrencyExchangeRate")
        )
        sender_amount = _numeric(fx.get("senderAmount"), recipient_amount)
        if sender_currency != recipient_currency and product_rate > 0:
            sender_amount = recipient_amount * product_rate
        elif (
            sender_currency != recipient_currency
            and _numeric(fx.get("recipientAmount")) > 0
        ):
            sender_amount = _numeric(fx.get("recipientAmount"))
        ngn_fx_value = await self.get_fx_rate("NGN", 1)
        ngn_fx = ngn_fx_value if isinstance(ngn_fx_value, dict) else {}
        ngn_rate = (
            1 / _numeric(ngn_fx.get("senderAmount"))
            if _numeric(ngn_fx.get("senderAmount")) > 0
            else 1
        )
        sender_amount_local = (
            sender_amount
            if sender_currency == "NGN"
            else sender_amount * ngn_rate
        )
        sender_amount_usd = (
            sender_amount
            if sender_currency == "USD"
            else (sender_amount_local / ngn_rate or sender_amount)
        )
        receiver_amount_naira = (
            recipient_amount
            if recipient_currency == "NGN"
            else sender_amount_local
        )
        discount_data = await self.get_product_discounts(product_id)
        discount_rows = discount_data if isinstance(discount_data, list) else []
        discount_row = next(
            (
                item
                for item in discount_rows
                if isinstance(item, dict) and "percentage" in item
            ),
            {},
        )
        discount_percentage = _numeric(discount_row.get("percentage"))
        sender_fee_usd = (
            sender_fee
            if sender_currency == "USD"
            else sender_fee / ngn_rate
            if sender_fee > 0 and ngn_rate > 0
            else 0
        )
        base_usd_cost = sender_amount_usd + sender_fee_usd
        discount_usd = sender_amount_usd * discount_percentage / 100
        discounted_cost = _round_money(
            max(base_usd_cost - discount_usd, 0) * ngn_rate
        )
        discount_amount = discount_usd * ngn_rate
        base_cost = _round_money(base_usd_cost * ngn_rate)
        markup_rate = 0.05
        base_usd_before_fee = max(sender_amount_usd - discount_usd, 0)
        fee_ngn = sender_fee_usd * ngn_rate
        base_ngn_before_markup = base_usd_before_fee * ngn_rate
        final_price = _round_money(
            base_ngn_before_markup * (1 + markup_rate) + fee_ngn
        )
        our_markup_amount = _round_money(
            final_price - (base_ngn_before_markup + fee_ngn)
        )
        markup_amount = _round_money(final_price - discounted_cost)
        return {
            "baseCost": base_cost,
            "discountAmount": discount_amount,
            "discountedCost": discounted_cost,
            "convertedNgnCost": discounted_cost,
            "markupAmount": markup_amount,
            "ourMarkupAmount": our_markup_amount,
            "markupPercentage": markup_rate,
            "ourRetailRateNgnPerUsd": ngn_rate * (1 + markup_rate),
            "finalPrice": final_price,
            "senderCurrency": sender_currency,
            "ngnRateUsed": ngn_rate,
            "fxRateUsdToNgn": ngn_rate,
            "senderFee": sender_fee,
            "senderFeeUsd": sender_fee_usd,
            "baseUsdCost": base_usd_cost,
            "discountUsd": discount_usd,
            "receiverAmountNaira": receiver_amount_naira,
            "senderAmountLocal": sender_amount_local,
        }

    async def _request(
        self,
        path: str,
        method: Literal["GET", "POST"] = "GET",
        payload: dict[str, Any] | None = None,
    ) -> Any:
        token = await self.get_access_token()
        url = urljoin(self.base_url.rstrip("/") + "/", path.lstrip("/"))
        headers = {
            "accept": "application/com.reloadly.giftcards-v1+json",
            "authorization": f"Bearer {token}",
        }
        if payload is not None:
            headers["content-type"] = "application/json"
        result, status = await asyncio.to_thread(
            _request_json,
            url,
            method,
            headers,
            payload if method != "GET" else None,
            _REQUEST_TIMEOUT_SECONDS,
        )
        if not 200 <= status < 300:
            raise _provider_error(result, status, "Reloadly request failed")
        return result


async def build_reloadly_brand_catalog(
    client: ReloadlyClient,
) -> list[_BrandCatalogEntry]:
    brands: dict[str, _BrandSummary] = {}
    for page in range(100):
        result = await client.get_gift_cards_products(page, 200)
        content = result.get("content") if isinstance(result, dict) else None
        if not isinstance(content, list) or not content:
            break
        for value in content:
            if not isinstance(value, dict):
                continue
            brand = value.get("brand") if isinstance(value.get("brand"), dict) else {}
            brand_id = _integer(brand.get("brandId"))
            product_id = _integer(value.get("productId"))
            brand_name = str(
                brand.get("brandName") or value.get("productName") or ""
            ).strip()
            logos = value.get("logoUrls")
            logo_url = str(logos[0] or "").strip() if isinstance(logos, list) and logos else ""
            if not brand_name or not logo_url or brand_id is None:
                continue
            key = brand_name.lower()
            record = brands.setdefault(
                key,
                {
                    "brandName": brand_name,
                    "brandIds": [],
                    "productIds": [],
                    "logos": {},
                },
            )
            _add_unique(record["brandIds"], brand_id)
            if product_id is not None:
                _add_unique(record["productIds"], product_id)
            logo = record["logos"].setdefault(
                logo_url,
                {"logoUrl": logo_url, "brandIds": [], "productIds": []},
            )
            _add_unique(logo["brandIds"], brand_id)
            if product_id is not None:
                _add_unique(logo["productIds"], product_id)
        total_pages = _numeric(result.get("totalPages")) if isinstance(result, dict) else 0
        if (total_pages > 0 and page + 1 >= total_pages) or len(content) < 200:
            break
    return [
        {
            "brandName": brand["brandName"],
            "brandIds": brand["brandIds"],
            "productIds": brand["productIds"],
            "logos": list(brand["logos"].values()),
        }
        for brand in sorted(brands.values(), key=lambda item: item["brandName"].lower())
    ]


def get_reloadly_client(mode: ReloadlyMode = "live") -> ReloadlyClient:
    return ReloadlyClient.create(mode)


def get_reloadly_brand_cache(mode: ReloadlyMode = "live") -> ReloadlyBrandCache:
    environment = "TEST" if mode == "test" else "LIVE"
    value = get_cached_payload(_BRAND_CACHE_KEY, environment)
    return _normalize_brand_cache(value if isinstance(value, dict) else {})


async def sync_reloadly_brand_cache(mode: ReloadlyMode = "live") -> ReloadlyBrandCache:
    client = get_reloadly_client(mode)
    fresh = await build_reloadly_brand_catalog(client)
    previous = get_reloadly_brand_cache(mode)
    blocked_by_url = {
        logo["logoUrl"]: logo["blocked"]
        for brand in previous["brands"]
        for logo in brand["logos"]
    }
    brands: list[ReloadlyBrand] = [
        {
            **brand,
            "logos": [
                {**logo, "blocked": blocked_by_url.get(logo["logoUrl"], False)}
                for logo in brand["logos"]
            ],
        }
        for brand in fresh
    ]
    cache: ReloadlyBrandCache = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "brands": brands,
    }
    _store_brand_cache(mode, cache)
    return cache


def set_reloadly_brand_logo_blocked(
    logo_url: str, blocked: bool, mode: ReloadlyMode = "live"
) -> ReloadlyBrandCache:
    cache = get_reloadly_brand_cache(mode)
    found = False
    for brand in cache["brands"]:
        for logo in brand["logos"]:
            if logo["logoUrl"] == logo_url:
                logo["blocked"] = blocked
                found = True
    if not found:
        raise ProviderError("Brand was not found", 404)
    cache["updatedAt"] = datetime.now(timezone.utc).isoformat()
    cache["mode"] = mode
    _store_brand_cache(mode, cache)
    return cache


def available_reloadly_brands(
    cache: dict[str, Any],
) -> list[ReloadlyBrand]:
    result: list[ReloadlyBrand] = []
    brands = cache.get("brands")
    if not isinstance(brands, list):
        return result
    for brand in brands:
        if not isinstance(brand, dict) or not isinstance(brand.get("logos"), list):
            continue
        logos = [
            logo
            for logo in brand["logos"]
            if isinstance(logo, dict) and not bool(logo.get("blocked", False))
        ]
        if logos:
            result.append({**brand, "logos": logos})
    return result


reloadly_airtime_integration_status: Literal["specification-only"] = "specification-only"
reloadly_utility_payments_integration_status: Literal["specification-only"] = "specification-only"


def request_reloadly_airtime() -> Never:
    raise ProviderError(
        "Reloadly airtime operations have no active Node provider implementation",
        501,
    )


def request_reloadly_utility_payment() -> Never:
    raise ProviderError(
        "Reloadly utility-payment operations have no active Node provider implementation",
        501,
    )


def _store_brand_cache(mode: ReloadlyMode, cache: ReloadlyBrandCache) -> None:
    environment = "TEST" if mode == "test" else "LIVE"
    store_cached_payload(
        _BRAND_CACHE_KEY, cache, _BRAND_CACHE_TTL_SECONDS, environment
    )


def _normalize_brand_cache(value: dict[str, Any]) -> ReloadlyBrandCache:
    brands: list[ReloadlyBrand] = []
    source_brands = value.get("brands")
    if isinstance(source_brands, list):
        for brand in source_brands:
            if not isinstance(brand, dict):
                continue
            raw_logos = brand.get("logos")
            logos: list[ReloadlyLogo] = []
            if isinstance(raw_logos, list):
                for logo in raw_logos:
                    if not isinstance(logo, dict):
                        continue
                    logos.append(
                        {
                            "logoUrl": str(logo.get("logoUrl") or ""),
                            "brandIds": _number_list(logo.get("brandIds")),
                            "productIds": _number_list(logo.get("productIds")),
                            "blocked": bool(logo.get("blocked", brand.get("blocked", False))),
                        }
                    )
            brands.append(
                {
                    "brandName": str(brand.get("brandName") or ""),
                    "brandIds": _number_list(
                        brand.get(
                            "brandIds",
                            [brand["brandId"]] if "brandId" in brand else [],
                        )
                    ),
                    "productIds": _number_list(brand.get("productIds")),
                    "logos": logos,
                }
            )
    mode_value = value.get("mode")
    return {
        "updatedAt": value.get("updatedAt")
        if isinstance(value.get("updatedAt"), str)
        else None,
        "mode": mode_value if mode_value in {"live", "test"} else None,
        "brands": brands,
    }


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
        raise ProviderError("Unable to reach Reloadly", 502) from error
    try:
        return json.loads(body), status
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError("Reloadly returned invalid JSON", 502) from error


def _provider_error(data: Any, status: int, fallback: str) -> ProviderError:
    message = data.get("message") if isinstance(data, dict) else None
    return ProviderError(
        message if isinstance(message, str) else fallback,
        status if 400 <= status < 500 else 502,
    )


def _numeric(value: Any, fallback: float = 0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return fallback
    return result if math.isfinite(result) else fallback


def _integer(value: Any) -> int | None:
    number = _numeric(value, float("nan"))
    return int(number) if math.isfinite(number) and number.is_integer() else None


def _number_list(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    return [number for item in value if (number := _integer(item)) is not None]


def _round_money(value: float) -> float:
    return math.floor((value + 1e-9) * 100 + 0.5) / 100


def _add_unique(values: list[int], value: int) -> None:
    if value not in values:
        values.append(value)
