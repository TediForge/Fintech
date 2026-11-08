"""Calendarific public holiday adapter."""

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from app.providers.calendar.calendarific.credentials import (
    CalendarificCredentials,
    load_calendarific_credentials,
)
from app.providers.types import ProviderError

_BASE_URL = "https://calendarific.com/api/v2/holidays"
_TIMEOUT_SECONDS = 8
_DEFAULT_COUNTRY = "NG"
_LAGOS = ZoneInfo("Africa/Lagos")


@dataclass(frozen=True)
class CalendarificClient:
    """Client constructed with credentials loaded by the provider credential module."""

    credentials: CalendarificCredentials

    async def fetch_holiday(
        self, now: datetime, country: str = _DEFAULT_COUNTRY
    ) -> str | None:
        return await asyncio.to_thread(self._fetch_holiday, now, country)

    def _fetch_holiday(self, now: datetime, country: str) -> str | None:
        if now.tzinfo is None:
            now = now.replace(tzinfo=ZoneInfo("UTC"))
        local_date = now.astimezone(_LAGOS).date()
        query = urlencode(
            {
                "api_key": self.credentials.api_key,
                "country": country,
                "year": str(local_date.year),
            }
        )
        request = Request(
            f"{_BASE_URL}?{query}",
            headers={"accept": "application/json"},
        )
        try:
            with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
                body = response.read()
                status = response.status
        except HTTPError as error:
            raise ProviderError(
                f"Calendarific request failed with status {error.code}",
                error.code if 400 <= error.code < 500 else 502,
            ) from error
        except (TimeoutError, URLError, OSError) as error:
            raise ProviderError("Unable to connect to Calendarific") from error
        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ProviderError("Calendarific returned invalid JSON") from error
        if status < 200 or status >= 300:
            raise ProviderError("Calendarific rejected the holiday request", 502)
        if not isinstance(payload, dict):
            raise ProviderError("Calendarific returned an invalid response")
        response_data = payload.get("response")
        holidays = response_data.get("holidays") if isinstance(response_data, dict) else None
        if not isinstance(holidays, list):
            raise ProviderError("Calendarific returned an invalid holidays list")
        for holiday in holidays:
            if not isinstance(holiday, dict):
                continue
            holiday_date = holiday.get("date")
            name = holiday.get("name")
            if (
                isinstance(holiday_date, dict)
                and holiday_date.get("iso") == local_date.isoformat()
                and isinstance(name, str)
            ):
                return name[:100]
        return None


@lru_cache(maxsize=1)
def get_calendarific_client() -> CalendarificClient:
    """Return a reused client with the active provider credential."""
    return CalendarificClient(load_calendarific_credentials())


async def fetch_nigerian_holiday(now: datetime) -> str | None:
    """Return the Nigerian public holiday occurring on the supplied Lagos date."""
    return await get_calendarific_client().fetch_holiday(now)
