"""Contracts shared by notification channels."""

from collections.abc import Mapping
from typing import Any, Protocol


class NotificationChannel(Protocol):
    """Common async sending interface for app-owned notification channels."""

    async def send(self, input: Mapping[str, Any]) -> Any: ...

