import asyncio
from types import SimpleNamespace

import pytest

from app.providers.bills.ng.fafotech import (
    FafotechClient,
    get_fafotech_provider_status,
    purchase_airtime,
    purchase_cable,
    purchase_electricity,
    query_airtime,
    query_cable,
    query_electricity,
    validate_cable,
    validate_meter,
)
from app.providers.types import ProviderError


def test_fafotech_live_services_use_provider_endpoints(monkeypatch) -> None:
    calls = []

    async def fake_request(url, **kwargs):
        calls.append((url, kwargs))
        return {"Status": "successful"}, 200

    monkeypatch.setattr(
        "app.providers.bills.ng.fafotech.client.request_json", fake_request
    )
    client = FafotechClient(SimpleNamespace(api_key="database-key"))

    results = asyncio.run(_call_live_services(client))

    assert all(result["Status"] == "successful" for result in results)
    assert [url.removeprefix("https://fafotech.com/api") for url, _ in calls] == [
        "/topup/",
        "/topup/airtime%2Ftransaction/",
        "/validateiuc/",
        "/cablesub/",
        "/cablesub/cable-transaction/",
        "/validatemeter/",
        "/billpayment/",
        "/billpayment/electricity-transaction/",
    ]
    assert calls[0][1]["method"] == "POST"
    assert calls[0][1]["headers"]["Authorization"] == "Token database-key"
    assert calls[2][1]["query"] == {
        "smart_card_number": "1234567890",
        "cablename": 1,
    }
    assert calls[5][1]["query"] == {
        "meternumber": "12345",
        "disconame": 1,
        "mtype": 1,
    }


async def _call_live_services(client: FafotechClient) -> list[dict]:
    return [
        await client.purchase_airtime("mtn", 100, "08000000000", mode="live"),
        await client.query_airtime("airtime/transaction", mode="live"),
        await client.validate_cable(1, "1234567890", mode="live"),
        await client.purchase_cable(1, 2, "1234567890", mode="live"),
        await client.query_cable("cable-transaction", mode="live"),
        await client.validate_meter("12345", 1, 1, mode="live"),
        await client.purchase_electricity(1, 1000, "12345", 1, mode="live"),
        await client.query_electricity("electricity-transaction", mode="live"),
    ]


def test_fafotech_test_services_return_mock_results() -> None:
    client = FafotechClient()

    results = asyncio.run(_call_test_services(client))
    status = asyncio.run(get_fafotech_provider_status())

    assert all(
        callable(operation)
        for operation in (
            purchase_airtime,
            purchase_cable,
            purchase_electricity,
            query_airtime,
            query_cable,
            query_electricity,
            validate_cable,
            validate_meter,
        )
    )
    assert all(result["mock"] for result in results)
    assert status["mock"] is True
    assert status["balance"] == "50000"


async def _call_test_services(client: FafotechClient) -> list[dict]:
    return [
        await client.purchase_airtime("mtn", 100, "08000000000"),
        await client.query_airtime("transaction"),
        await client.validate_cable(1, "1234567890"),
        await client.purchase_cable(1, 2, "1234567890"),
        await client.query_cable("transaction"),
        await client.validate_meter("12345", 1, 1),
        await client.purchase_electricity(1, 1000, "12345", 1),
        await client.query_electricity("transaction"),
    ]


def test_fafotech_rejects_invalid_service_inputs() -> None:
    client = FafotechClient()

    with pytest.raises(ProviderError):
        asyncio.run(client.purchase_airtime("unknown", 100, "08000000000"))
    with pytest.raises(ProviderError):
        asyncio.run(client.purchase_electricity(1, 0, "12345", 1))
    with pytest.raises(ProviderError):
        asyncio.run(client.query_cable(""))
