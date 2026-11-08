"""Read-only user beneficiary lookup endpoints."""

import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import require_user
from app.lib.beneficiary import (
    get_beneficiaries,
    get_beneficiary_by_id,
    is_supported_beneficiary_service,
    normalize_beneficiary_service,
)

router = APIRouter()


@router.get("/")
async def list_beneficiaries(
    request: Request,
    auth: Annotated[dict[str, Any], Depends(require_user)],
) -> dict[str, Any]:
    service = normalize_beneficiary_service(request.query_params.get("service", ""))
    raw_id = (
        request.query_params.get("id")
        or request.query_params.get("beneficiaryId")
        or request.query_params.get("beneficiary_id")
    )
    if not is_supported_beneficiary_service(service):
        raise HTTPException(
            status_code=400,
            detail="A valid service and beneficiary id are required",
        )
    beneficiary_id: int | None = None
    if raw_id is not None:
        try:
            beneficiary_id = int(raw_id)
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail="A valid service and beneficiary id are required",
            ) from error
        if beneficiary_id < 1:
            raise HTTPException(
                status_code=400,
                detail="A valid service and beneficiary id are required",
            )

    environment = str(auth.get("environment", "LIVE")).upper()
    if environment not in {"LIVE", "TEST"}:
        raise HTTPException(status_code=401, detail="Authentication is required")
    if beneficiary_id is not None:
        beneficiary = await asyncio.to_thread(
            get_beneficiary_by_id,
            auth["user_id"],
            service,
            beneficiary_id,
            environment,
        )
        if beneficiary is None:
            raise HTTPException(status_code=404, detail="Beneficiary not found")
        return {
            "success": True,
            "message": "Beneficiary retrieved",
            "data": {**beneficiary["details"], **beneficiary},
        }
    beneficiaries = await asyncio.to_thread(
        get_beneficiaries, auth["user_id"], service, environment
    )
    return {
        "success": True,
        "message": "Beneficiaries retrieved",
        "data": {
            "service": service,
            "environment": environment,
            "beneficiaries": beneficiaries,
        },
    }
