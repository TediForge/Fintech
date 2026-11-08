"""Contracts shared by provider adapters."""

from typing import Any, Protocol


class PaymentProvider(Protocol):
    """Common transport surface for database-configured payment providers."""

    async def request(
        self,
        method: str,
        endpoint: str,
        payload: dict[str, Any] | None = None,
    ) -> Any: ...
