"""User-facing account tier limits."""

import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api.deps import require_user
from database.db_01.common import query_rows

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]


@router.get("/")
async def get_account_tiers(
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    def fetch() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        user = query_rows(
            'SELECT "kycLevel", "kycStatus" FROM "users" WHERE "userId" = :user_id LIMIT 1',
            {"user_id": auth["user_id"]},
        )
        tiers = query_rows(
            """
            SELECT "tier", "dailyDeposit", "dailyWithdraw", "weeklyDeposit",
                   "weeklyWithdraw", "monthlyDeposit", "monthlyWithdraw",
                   "yearlyDeposit", "yearlyWithdraw", "updatedAt"
            FROM "tierLimits" ORDER BY "dailyDeposit" ASC
            """
        )
        return user, tiers

    users, rows = await asyncio.to_thread(fetch)
    user = users[0] if users else {}
    return {
        "success": True,
        "message": "Account tiers retrieved successfully",
        "data": {
            "currentLevel": user.get("kycLevel"),
            "kycStatus": user.get("kycStatus"),
            "tiers": [
                {
                    "tierName": row["tier"],
                    "dailyDepositLimit": float(row["dailyDeposit"]),
                    "dailyWithdrawalLimit": float(row["dailyWithdraw"]),
                    "weeklyDepositLimit": float(row["weeklyDeposit"]),
                    "weeklyWithdrawalLimit": float(row["weeklyWithdraw"]),
                    "monthlyDepositLimit": float(row["monthlyDeposit"]),
                    "monthlyWithdrawalLimit": float(row["monthlyWithdraw"]),
                    "yearlyDepositLimit": float(row["yearlyDeposit"]),
                    "yearlyWithdrawalLimit": float(row["yearlyWithdraw"]),
                    "updatedAt": row["updatedAt"],
                }
                for row in rows
            ],
        },
    }
