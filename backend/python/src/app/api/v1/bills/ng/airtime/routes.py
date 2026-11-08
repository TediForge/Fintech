"""Nigerian airtime catalog and purchase endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import require_user
from app.api.v1.bills.ng._purchase import purchase_bill
from app.providers.bills.ng.fafotech import purchase_airtime

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]


class AirtimeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    network: str = Field(min_length=1, max_length=30)
    phoneNumber: str = Field(pattern=r"^\+?[0-9]{10,15}$")
    amount: float = Field(gt=0, le=10_000_000)
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


@router.post("/")
async def buy_airtime(
    payload: AirtimeRequest, request: Request, auth: AuthenticatedUser
) -> dict[str, Any]:
    mode = "test" if auth["environment"] == "TEST" else "live"
    network = payload.network.strip().upper()
    if network not in {"MTN", "GLO", "AIRTEL", "9MOBILE"}:
        raise HTTPException(status_code=400, detail="Unsupported mobile network")
    phone = payload.phoneNumber.strip()
    metadata = {"phoneNumber": phone, "network": network}
    service_name = f"{network} Airtime"
    return await purchase_bill(
        request=request,
        auth=auth,
        bill_type="Airtime",
        amount=round(payload.amount, 2),
        service_name=service_name,
        narration=f"Airtime purchase to {phone}",
        metadata=metadata,
        purchase=lambda reference: purchase_airtime(
            network.lower(), round(payload.amount, 2), phone, mode
        ),
    )
