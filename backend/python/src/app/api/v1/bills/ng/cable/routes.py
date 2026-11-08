"""Nigerian cable routes; Fafotech plan pricing is not configured."""

from typing import Annotated, Any, NoReturn

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import require_user

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]


class CableRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    serviceCode: str = Field(min_length=1, max_length=255)
    smartCard: str = Field(pattern=r"^\d{5,30}$")
    variationCode: str = Field(min_length=1, max_length=255)


def _catalog_unavailable() -> NoReturn:
    raise HTTPException(
        status_code=503,
        detail=(
            "Fafotech cable catalog and plan pricing are not configured; "
            "cable transactions are unavailable"
        ),
    )


@router.get("/providers")
async def list_cable_providers() -> dict[str, Any]:
    _catalog_unavailable()


@router.get("/plans")
async def list_cable_plans(serviceCode: str | None = None) -> dict[str, Any]:
    _catalog_unavailable()


@router.get("/validate")
async def validate_cable(
    serviceCode: str,
    smartCard: str,
    variationCode: str,
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    _catalog_unavailable()


@router.post("/")
async def buy_cable(
    payload: CableRequest, request: Request, auth: AuthenticatedUser
) -> dict[str, Any]:
    _catalog_unavailable()
