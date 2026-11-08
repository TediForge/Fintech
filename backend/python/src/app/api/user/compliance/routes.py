"""Account compliance status derived from verified account fields."""

import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_user
from database.db_01.common import query_rows

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]


@router.get("/")
async def compliance_status(
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    rows = await asyncio.to_thread(
        query_rows,
        """
        SELECT "isEmailVerified", "pinHash", "kycLevel", "kycStatus"
        FROM "users" WHERE "userId" = :user_id LIMIT 1
        """,
        {"user_id": auth["user_id"]},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="User account not found")
    user = rows[0]
    level = str(user.get("kycLevel") or "").strip().lower()
    kyc_complete = level in {"tier1", "tier2", "tier3", "merchant"} and str(
        user.get("kycStatus") or ""
    ).lower() == "approved"
    requirements = {
        "email": bool(user.get("isEmailVerified")),
        "pinSetup": bool(user.get("pinHash")),
        "kyc": kyc_complete,
    }
    completed = [field for field, value in requirements.items() if value]
    missing = [field for field, value in requirements.items() if not value]
    return {
        "success": True,
        "complianceStatus": "failed" if missing else "passed",
        "missingFields": missing,
        "completedFields": completed,
        "allFields": completed + missing,
        "message": "Your profile is incomplete so please update the missing fields"
        if missing
        else "Compliance passed and your account is in good standing",
    }
