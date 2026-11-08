"""Football provider adapter for upcoming popular matches."""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Literal, TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from app.lib.cache import get_cached_payload, store_cached_payload
from app.providers.sports.football.credentials import (
    FootballCredentials,
    load_football_credentials,
)
from app.providers.types import ProviderError


class PopularMatch(TypedDict):
    homeTeam: str
    awayTeam: str
    competition: str
    kickOff: str
    status: Literal["SCHEDULED", "TIMED", "POSTPONED"]


_LAGOS = ZoneInfo("Africa/Lagos")
_COMPETITIONS: dict[str, tuple[str, int]] = {
    "PL": ("Premier League", 1),
    "CL": ("UEFA Champions League", 2),
    "PD": ("Primera Division", 3),
    "SA": ("Serie A", 4),
    "BL1": ("Bundesliga", 5),
    "FL1": ("Ligue 1", 6),
    "DED": ("Eredivisie", 7),
    "PPL": ("Primeira Liga", 8),
    "BSA": ("Campeonato Brasileiro Serie A", 9),
    "ELC": ("Championship", 10),
    "WC": ("FIFA World Cup", 11),
    "EC": ("European Championship", 12),
}
_CACHE_KEY = "provider.sports.popularMatches"
_BASE_URL = "https://api.football-data.org/v4"
_TIMEOUT_SECONDS = 10
_CACHE_SECONDS = 3600


async def request_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout_seconds: float = 60,
) -> tuple[Any, int]:
    return await asyncio.to_thread(
        _request_json_sync, url, headers or {}, timeout_seconds
    )


def _request_json_sync(
    url: str, headers: dict[str, str], timeout_seconds: float
) -> tuple[Any, int]:
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            response_body = response.read()
            status = response.status
    except HTTPError as error:
        raise ProviderError(
            f"Football-data.org request failed with status {error.code}",
            error.code if 400 <= error.code < 500 else 502,
        ) from error
    except (TimeoutError, URLError, OSError) as error:
        raise ProviderError("Unable to connect to Football-data.org") from error
    try:
        return json.loads(response_body), status
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError("Football-data.org returned invalid JSON", 502) from error


class FootballDataClient:
    """Football-data.org operations using fixed endpoint and timeout values."""

    def __init__(self, credentials: FootballCredentials | None = None) -> None:
        self._credentials = credentials

    async def fetch_popular_matches(
        self, now: datetime | None = None
    ) -> list[PopularMatch]:
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)
        date_from = current_time.astimezone(_LAGOS).date().isoformat()
        date_to = (current_time + timedelta(days=3)).astimezone(_LAGOS).date().isoformat()

        cached = get_cached_payload(_CACHE_KEY, "LIVE")
        if isinstance(cached, dict) and isinstance(cached.get("matches"), list):
            return [
                match
                for item in cached["matches"]
                if (match := _to_match(item)) is not None
            ]

        credentials = self._credentials or load_football_credentials()
        query = urlencode({"dateFrom": date_from, "dateTo": date_to})
        payload, _ = await request_json(
            f"{_BASE_URL}/matches?{query}",
            headers={
                "X-Auth-Token": credentials.api_key,
                "accept": "application/json",
            },
            timeout_seconds=_TIMEOUT_SECONDS,
        )
        if not isinstance(payload, dict):
            raise ProviderError("Football-data.org returned an invalid matches response")

        raw_matches = payload.get("matches")
        matches_with_priority: list[tuple[int, PopularMatch]] = []
        if isinstance(raw_matches, list):
            for item in raw_matches:
                match = _normalize_match(item)
                if match is not None:
                    competition = _COMPETITIONS[_competition_code(item)]
                    matches_with_priority.append((competition[1], match))
        matches_with_priority.sort(key=lambda entry: (entry[0], entry[1]["kickOff"]))
        matches = [match for _, match in matches_with_priority]
        store_cached_payload(
            _CACHE_KEY,
            {"matches": matches, "from": date_from, "to": date_to},
            _CACHE_SECONDS,
            "LIVE",
        )
        return matches


@lru_cache(maxsize=1)
def get_football_data_client() -> FootballDataClient:
    """Return the shared football-data.org client."""
    return FootballDataClient()


async def fetch_popular_matches(
    now: datetime | None = None,
) -> list[PopularMatch]:
    return await get_football_data_client().fetch_popular_matches(now)


def _normalize_match(value: Any) -> PopularMatch | None:
    if not isinstance(value, dict):
        return None
    competition = _COMPETITIONS.get(_competition_code(value))
    status = value.get("status", "SCHEDULED")
    home = _team_name(value.get("homeTeam"))
    away = _team_name(value.get("awayTeam"))
    kickoff = value.get("utcDate")
    if (
        competition is None
        or not isinstance(status, str)
        or status not in {"SCHEDULED", "TIMED", "POSTPONED"}
        or not home
        or not away
        or not isinstance(kickoff, str)
    ):
        return None
    try:
        parsed_kickoff = datetime.fromisoformat(kickoff.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed_kickoff.tzinfo is None:
        return None
    return {
        "homeTeam": home,
        "awayTeam": away,
        "competition": competition[0],
        "kickOff": parsed_kickoff.astimezone(_LAGOS).isoformat(timespec="seconds"),
        "status": status,
    }


def _to_match(value: Any) -> PopularMatch | None:
    if not isinstance(value, dict):
        return None
    status = value.get("status")
    if (
        not isinstance(value.get("homeTeam"), str)
        or not isinstance(value.get("awayTeam"), str)
        or not isinstance(value.get("competition"), str)
        or not isinstance(value.get("kickOff"), str)
        or not isinstance(status, str)
        or status not in {"SCHEDULED", "TIMED", "POSTPONED"}
    ):
        return None
    return {
        "homeTeam": value["homeTeam"],
        "awayTeam": value["awayTeam"],
        "competition": value["competition"],
        "kickOff": value["kickOff"],
        "status": status,
    }


def _competition_code(value: dict[str, Any]) -> str:
    competition = value.get("competition")
    return str(competition.get("code", "")) if isinstance(competition, dict) else ""


def _team_name(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    name = value.get("name")
    return name.strip() if isinstance(name, str) else ""
