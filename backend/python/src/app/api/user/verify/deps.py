"""Country enforcement for verification submission routes."""

import asyncio
from typing import Annotated, Any

from fastapi import Depends, HTTPException

from app.api.deps import require_user
from database.db_01.common import query_rows


class _CountryUserDependency:
    def __init__(self, expected_country: str) -> None:
        self.expected_country = expected_country.strip().upper()
        if not self.expected_country:
            raise ValueError("expected country code is required")

    async def __call__(
        self,
        auth: Annotated[dict[str, Any], Depends(require_user)],
    ) -> dict[str, Any]:
        rows = await asyncio.to_thread(
            query_rows,
            """
            SELECT "countryCode" FROM "users"
            WHERE "userId" = :user_id LIMIT 1
            """,
            {"user_id": auth["user_id"]},
        )
        if not rows:
            raise HTTPException(status_code=404, detail="User account not found")
        user_country = str(rows[0].get("countryCode") or "").strip().upper()
        if user_country != self.expected_country:
            raise HTTPException(
                status_code=403,
                detail="Verification is not available for this account",
            )
        return auth


def require_country_user(expected: str) -> _CountryUserDependency:
    """Return a dependency that requires the authenticated user's country."""
    return _CountryUserDependency(expected)
