import asyncio

import pytest

from app.providers.goods.reloadly import (
    ReloadlyClient,
    available_reloadly_brands,
    build_reloadly_brand_catalog,
    set_reloadly_brand_logo_blocked,
    sync_reloadly_brand_cache,
)
from app.providers.goods.reloadly.credentials import (
    ReloadlyCredentials,
    load_reloadly_credentials,
)
from app.providers.types import ProviderError


def test_reloadly_client_authenticates_and_uses_environment_endpoint(monkeypatch) -> None:
    requests = []

    def fake_request(url, method, headers, payload, timeout_seconds):
        requests.append((url, method, headers, payload, timeout_seconds))
        if url == "https://auth.reloadly.com/oauth/token":
            return {"access_token": "access-token"}, 200
        return {"balance": 10}, 200

    monkeypatch.setattr(
        "app.providers.goods.reloadly.client._request_json", fake_request
    )
    client = ReloadlyClient(
        ReloadlyCredentials("client-id", "client-secret", "test")
    )

    result = asyncio.run(client.get_balance())

    assert result == {"balance": 10}
    assert requests[0][3] == {
        "client_id": "client-id",
        "client_secret": "client-secret",
        "grant_type": "client_credentials",
        "audience": "https://giftcards-sandbox.reloadly.com",
    }
    assert requests[1][0] == "https://giftcards-sandbox.reloadly.com/accounts/balance"
    assert requests[1][2]["authorization"] == "Bearer access-token"
    assert len(requests) == 2


def test_reloadly_pricing_calculates_discount_and_markup() -> None:
    client = ReloadlyClient(ReloadlyCredentials("id", "secret", "live"))

    async def get_card_details(_product_id):
        return {
            "recipientCurrencyCode": "USD",
            "senderCurrencyCode": "USD",
            "senderFee": 2,
        }

    async def get_fx_rate(currency, _amount):
        return {"senderAmount": 0.001} if currency == "NGN" else {"senderAmount": 20}

    async def get_product_discounts(_product_id):
        return [{"percentage": 10}]

    client.get_card_details = get_card_details
    client.get_fx_rate = get_fx_rate
    client.get_product_discounts = get_product_discounts

    result = asyncio.run(client.calculate_pricing("123", 20, "usd"))

    assert result["baseCost"] == 22_000
    assert result["discountAmount"] == 2_000
    assert result["finalPrice"] == 20_900
    assert result["senderCurrency"] == "USD"


def test_reloadly_brand_catalog_merges_brands_and_products() -> None:
    class Client:
        async def get_gift_cards_products(self, page, _size):
            if page:
                return {"content": []}
            return {
                "content": [
                    {
                        "productId": 10,
                        "productName": "Acme",
                        "brand": {"brandId": 1, "brandName": "ACME"},
                        "logoUrls": ["https://img.example/acme.png"],
                    },
                    {
                        "productId": 11,
                        "productName": "Acme Gift",
                        "brand": {"brandId": 1, "brandName": "Acme"},
                        "logoUrls": ["https://img.example/acme.png"],
                    },
                    {
                        "productId": 12,
                        "brand": {"brandId": 2, "brandName": "Beta"},
                        "logoUrls": ["https://img.example/beta.png"],
                    },
                ]
            }

    brands = asyncio.run(build_reloadly_brand_catalog(Client()))

    assert brands[0]["brandName"] == "ACME"
    assert brands[0]["brandIds"] == [1]
    assert brands[0]["productIds"] == [10, 11]
    assert len(brands[0]["logos"]) == 1
    blocked = available_reloadly_brands(
        {
            "brands": [
                {
                    **brands[0],
                    "logos": [
                        {**brands[0]["logos"][0], "blocked": True}
                    ],
                },
                {
                    **brands[1],
                    "logos": [
                        {**brands[1]["logos"][0], "blocked": False}
                    ],
                },
            ]
        }
    )
    assert [brand["brandName"] for brand in blocked] == ["Beta"]


def test_reloadly_brand_cache_preserves_and_updates_logo_blocks(monkeypatch) -> None:
    existing = {
        "updatedAt": "2026-01-01T00:00:00+00:00",
        "mode": "live",
        "brands": [
            {
                "brandName": "Acme",
                "brandIds": [1],
                "productIds": [10],
                "logos": [
                    {
                        "logoUrl": "https://img.example/acme.png",
                        "brandIds": [1],
                        "productIds": [10],
                        "blocked": True,
                    }
                ],
            }
        ],
    }
    persisted = []

    class Client:
        async def get_gift_cards_products(self, _page, _size):
            return {
                "content": [
                    {
                        "productId": 10,
                        "brand": {"brandId": 1, "brandName": "Acme"},
                        "logoUrls": ["https://img.example/acme.png"],
                    }
                ]
            }

    monkeypatch.setattr(
        "app.providers.goods.reloadly.client.get_cached_payload",
        lambda *_args: existing,
    )
    monkeypatch.setattr(
        "app.providers.goods.reloadly.client.get_reloadly_client",
        lambda _mode: Client(),
    )
    monkeypatch.setattr(
        "app.providers.goods.reloadly.client.store_cached_payload",
        lambda *args: persisted.append(args[1]),
    )

    result = asyncio.run(sync_reloadly_brand_cache())

    assert result["brands"][0]["logos"][0]["blocked"] is True
    result = set_reloadly_brand_logo_blocked(
        "https://img.example/acme.png", False
    )
    assert result["brands"][0]["logos"][0]["blocked"] is False
    assert len(persisted) == 2


def test_reloadly_credential_query_uses_environment_and_provider_filter(monkeypatch) -> None:
    queries = []

    class Result:
        def mappings(self):
            return self

        def first(self):
            return {"apiKey": "client-id", "secretKey": "client-secret"}

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def execute(self, query, params):
            queries.append((str(query), params))
            return Result()

    class Engine:
        def connect(self):
            return Connection()

    monkeypatch.setattr(
        "app.providers.goods.reloadly.credentials.get_database_engine",
        lambda: Engine(),
    )

    credentials = load_reloadly_credentials("test")

    assert credentials == ReloadlyCredentials("client-id", "client-secret", "test")
    assert queries[0][1] == {"environment": "sandbox"}
    assert '"service" = \'reloadly\'' in queries[0][0]
    assert '"isActive" = TRUE' in queries[0][0]
    assert "LIMIT 1" in queries[0][0]


def test_reloadly_unimplemented_apis_fail_closed() -> None:
    from app.providers.goods.reloadly import request_reloadly_airtime

    with pytest.raises(ProviderError) as error:
        request_reloadly_airtime()

    assert error.value.status == 501
