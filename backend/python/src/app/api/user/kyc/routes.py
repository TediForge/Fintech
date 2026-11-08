"""Customer KYC status view."""

import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_user
from database.db_01.common import query_rows

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]


@router.get("/")
async def get_kyc_status(
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    rows = await asyncio.to_thread(
        query_rows,
        """
        SELECT "kycIdentifier", "countryCode", "kycLevel", "kycStatus"
        FROM "users" WHERE "userId" = :user_id LIMIT 1
        """,
        {"user_id": auth["user_id"]},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="User account not found")
    data = {
        **rows[0],
        "records": {},
        "nin": None,
        "address": None,
        "merchant": None,
        "bvn": None,
        "income": None,
    }
    return {"success": True, "status": "success", "message": "Local KYC status loaded", "data": data}
