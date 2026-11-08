import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

from app.providers.bills.ng.fafotech import (
    FafotechClient,
    get_data_plan_catalog,
    get_fafotech_balance,
    purchase_data,
)
from app.providers.sports.football import (
    FootballDataClient,
    fetch_popular_matches,
)


def test_fafotech_public_exports_and_test_balance(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.providers.bills.ng.fafotech.client.load_fafotech_credentials",
        lambda: SimpleNamespace(api_key="database-key"),
    )

    balance = asyncio.run(get_fafotech_balance())

    assert balance == 50_000
    assert callable(get_data_plan_catalog)
    assert callable(purchase_data)
    assert isinstance(FafotechClient(), FafotechClient)


def test_fafotech_catalog_normalizes_and_deduplicates_plans(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.providers.bills.ng.fafotech.client.load_fafotech_credentials",
        lambda: SimpleNamespace(api_key="database-key"),
    )
    monkeypatch.setattr(
        "app.providers.bills.ng.fafotech.client.request_json",
        _async_result(
            {
                "MTN_PLAN": [
                    {"id": 1, "plan": "1GB", "month_validate": "30 Days", "plan_type": "SME", "plan_amount": "100"},
                    {"id": 2, "plan": "1GB", "month_validate": "30 Days", "plan_type": "SME", "plan_amount": "90"},
                    {"id": 3, "plan": "1.25GB Router", "month_validate": "30 Days", "plan_type": "SME", "plan_amount": "50"},
                    {"plan": "1GB", "month_validate": "30 Days", "plan_type": "SME", "plan_amount": "50"},
                    {"id": 4, "plan": "1GB Router", "month_validate": "30 Days", "plan_type": "SME", "plan_amount": "50"},
                ]
            }
        ),
    )

    result = asyncio.run(get_data_plan_catalog())

    assert len(result["MTN_PLAN"]) == 1
    assert result["MTN_PLAN"][0]["providerPlanId"] == "2"
    assert result["MTN_PLAN"][0]["plan_size"] == "1GB"
    assert result["MTN_PLAN"][0]["validity_days"] == 30


def test_fafotech_test_purchase_classifies_provider_response(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.providers.bills.ng.fafotech.client.load_fafotech_credentials",
        lambda: SimpleNamespace(api_key="database-key"),
    )

    result = asyncio.run(
        purchase_data(
            {
                "network": "mtn",
                "phone": "08000000000",
                "providerPlanId": "123",
                "amount": 50,
                "ported": False,
                "mode": "test",
            }
        )
    )

    assert result["status"] == "failed"
    assert result["bridge_logic"] == "fafotech_keyword_v2"
    assert result["environment"] == "test"


def test_football_data_normalizes_lagos_times_and_sorts_competitions(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.providers.sports.football.client.get_cached_payload",
        lambda *args: None,
    )
    monkeypatch.setattr(
        "app.providers.sports.football.client.load_football_credentials",
        lambda: SimpleNamespace(api_key="database-key"),
    )
    monkeypatch.setattr(
        "app.providers.sports.football.client.request_json",
        _async_result(
            {
                "matches": [
                    {
                        "competition": {"code": "CL"},
                        "homeTeam": {"name": "Away-order team"},
                        "awayTeam": {"name": "Opponent"},
                        "utcDate": "2026-11-08T12:00:00Z",
                        "status": "TIMED",
                    },
                    {
                        "competition": {"code": "PL"},
                        "homeTeam": {"name": "Premier team"},
                        "awayTeam": {"name": "Opponent"},
                        "utcDate": "2026-11-08T10:00:00Z",
                    },
                ]
            }
        ),
    )
    saved = {}
    monkeypatch.setattr(
        "app.providers.sports.football.client.store_cached_payload",
        lambda *args: saved.update(payload=args[1]),
    )

    matches = asyncio.run(
        fetch_popular_matches(datetime(2026, 11, 7, tzinfo=timezone.utc))
    )

    assert [match["competition"] for match in matches] == [
        "Premier League",
        "UEFA Champions League",
    ]
    assert matches[0]["kickOff"] == "2026-11-08T11:00:00+01:00"
    assert matches[0]["status"] == "SCHEDULED"
    assert saved["payload"]["matches"] == matches
    assert isinstance(FootballDataClient(), FootballDataClient)


def _async_result(result):
    async def resolve(*args, **kwargs):
        return result, 200

    return resolve
