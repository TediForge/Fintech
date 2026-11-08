"""Fail-closed flight route placeholder until a flight service exists."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()
_FLIGHT_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


@router.api_route("/", methods=_FLIGHT_METHODS, include_in_schema=False)
async def flights_root_not_implemented() -> JSONResponse:
    return _not_implemented()


@router.api_route(
    "/{path:path}",
    methods=_FLIGHT_METHODS,
    name="flight_path_not_implemented",
    operation_id="flight_path_not_implemented",
    include_in_schema=False,
)
async def flights_path_not_implemented(path: str) -> JSONResponse:
    del path
    return _not_implemented()


def _not_implemented() -> JSONResponse:
    return JSONResponse(
        {
            "success": False,
            "status": 501,
            "message": "Flight services are not implemented",
        },
        status_code=501,
    )
