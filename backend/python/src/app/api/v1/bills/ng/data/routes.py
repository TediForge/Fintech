"""Nigerian data-plan catalog and purchase endpoints."""

import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from app.api.deps import require_user
from app.api.v1.bills.ng._purchase import purchase_bill
from app.providers.bills.ng.fafotech import get_fafotech_client
from app.providers.types import DataPurchaseInput
from database.db_01.connection import get_database_engine

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]


class DataRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    network: str = Field(min_length=1, max_length=30)
    phoneNumber: str = Field(pattern=r"^\+?[0-9]{10,15}$")
    planId: int = Field(gt=0)
    beneficiaryName: str | None = Field(default=None, max_length=150)


@router.get("/providers")
async def list_networks() -> dict[str, Any]:
    return {
        "status": "success",
        "data": [
            {"name": name, "id": index}
            for index, name in enumerate(("MTN", "GLO", "AIRTEL", "9MOBILE"), 1)
        ],
    }


@router.get("/plans")
async def list_plans(network: str | None = None) -> dict[str, Any]:
    plans = await asyncio.to_thread(_list_plans, network)
    return {"status": "success", "data": plans}


@router.post("/")
async def buy_data(
    payload: DataRequest, request: Request, auth: AuthenticatedUser
) -> dict[str, Any]:
    plan = await asyncio.to_thread(_load_plan, payload.planId)
    if plan is None:
        raise HTTPException(status_code=404, detail="Data plan was not found")
    network = payload.network.strip().upper()
    if str(plan["provider"]).lower() != "fafotech":
        raise HTTPException(status_code=503, detail="Data plan provider is not configured")
    if str(plan["network"] or "").upper() != network:
        raise HTTPException(status_code=400, detail="Data plan does not match the network")
    if plan["sellingPrice"] is None or float(plan["sellingPrice"]) <= 0:
        raise HTTPException(status_code=503, detail="Data plan price is unavailable")
    phone = payload.phoneNumber.strip()
    amount = float(plan["sellingPrice"])
    metadata = {
        "phoneNumber": phone,
        "network": network,
        "planName": str(plan["planName"] or ""),
        "planId": str(plan["providerPlanId"]),
    }
    mode = "test" if auth["environment"] == "TEST" else "live"

    async def call_provider(reference: str) -> dict[str, Any]:
        provider_input: DataPurchaseInput = {
            "network": network,
            "phone": phone,
            "providerPlanId": str(plan["providerPlanId"]),
            "amount": amount,
            "ported": True,
            "mode": mode,
        }
        return await get_fafotech_client().purchase_data(provider_input)

    return await purchase_bill(
        request=request,
        auth=auth,
        bill_type="Data",
        amount=amount,
        service_name=f"{network} Data Purchase",
        narration=f"Data purchase: {plan['planName'] or 'mobile data'}",
        metadata=metadata,
        purchase=call_provider,
        fixed_revenue=float(plan["profit"] or 0),
    )


def _load_plan(plan_id: int) -> dict[str, Any] | None:
    with get_database_engine().connect() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT "id", "provider", "providerPlanId", "network",
                           "planName", "sellingPrice", "profit"
                    FROM "dataPlans" WHERE "id" = :plan_id LIMIT 1
                    """
                ),
                {"plan_id": plan_id},
            )
            .mappings()
            .first()
        )
    return dict(row) if row is not None else None


def _list_plans(network: str | None) -> list[dict[str, Any]]:
    statement = """
        SELECT "id", "provider", "providerPlanId", "network", "planType",
               "planName", "planSize", "sellingPrice", "profit", "validity",
               "durationCategory", "platformName", "validityDays"
        FROM "dataPlans"
    """
    parameters: dict[str, Any] = {}
    if network and network.strip():
        statement += ' WHERE UPPER("network") = :network'
        parameters["network"] = network.strip().upper()
    statement += ' ORDER BY "network" ASC, "sellingPrice" ASC'
    with get_database_engine().connect() as connection:
        rows = connection.execute(text(statement), parameters).mappings().all()
    return [dict(row) for row in rows]
