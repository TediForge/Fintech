"""Provider-neutral verification protocol.

All country-specific verify services implement this protocol. Provider
adapters remain under app/providers/kyc/ (D-001).
"""

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class VerificationSubject:
    """The db-02 user identity associated with a verification record."""

    user_id: int
    kyc_identifier: str


class VerifyProvider(Protocol):
    """Protocol for identity and business verification providers."""

    async def verify_nin(self, nin: str, **kwargs: Any) -> dict[str, Any]:
        """Verify a National Identification Number."""
        ...

    async def verify_bvn(self, bvn: str, **kwargs: Any) -> dict[str, Any]:
        """Verify a Bank Verification Number."""
        ...

    async def verify_address(
        self, address: dict[str, Any], **kwargs: Any
    ) -> dict[str, Any]:
        """Verify an address."""
        ...

    async def verify_business(
        self, rc_number: str, **kwargs: Any
    ) -> dict[str, Any]:
        """Verify a CAC business registration."""
        ...

    async def verify_income(
        self, account_id: str, **kwargs: Any
    ) -> dict[str, Any]:
        """Verify income from bank statement data."""
        ...
