"""Nigerian electricity routes; Fafotech DISCO mappings are not configured."""

from typing import Annotated, Any, Literal, NoReturn

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import require_user

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]


class ElectricityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    serviceCode: str = Field(min_length=1, max_length=255)
    meterNumber: str = Field(pattern=r"^\d{5,30}$")
    meterType: Literal["prepaid", "postpaid"] = "prepaid"
    amount: float = Field(gt=0, le=10_000_000)


def _service_unavailable() -> NoReturn:
    raise HTTPException(
        status_code=503,
        detail=(
            "Fafotech electricity DISCO mappings are not configured; "
            "electricity transactions are unavailable"
        ),
    )


@router.get("/providers")
async def list_electricity_providers() -> dict[str, Any]:
    _service_unavailable()


@router.get("/validate")
async def validate_meter(
    serviceCode: str,
    meterNumber: str,
    meterType: Literal["prepaid", "postpaid"],
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    _service_unavailable()


@router.post("/")
async def buy_electricity(
    payload: ElectricityRequest, request: Request, auth: AuthenticatedUser
) -> dict[str, Any]:
    _service_unavailable()
