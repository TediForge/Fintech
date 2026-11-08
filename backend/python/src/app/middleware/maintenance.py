"""Application-wide maintenance-mode middleware."""

import asyncio
import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from database.db_01.connection import get_database_engine

_LOGGER = logging.getLogger(__name__)
_EXEMPT_PATHS = {
    "/admin/system/settings",
    "/admin/auth/login",
}


class MaintenanceMiddleware(BaseHTTPMiddleware):
    """Reject application requests while system maintenance is enabled."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path.rstrip("/") or "/"
        if path in _EXEMPT_PATHS:
            return await call_next(request)
        try:
            maintenance_enabled = await asyncio.to_thread(_maintenance_enabled)
        except Exception:
            _LOGGER.exception("Unable to read maintenance settings")
            return JSONResponse(
                {"success": False, "message": "Service availability is unknown"},
                status_code=503,
            )
        if maintenance_enabled:
            return JSONResponse(
                {
                    "success": False,
                    "message": "Tediwave is temporarily unavailable for maintenance",
                },
                status_code=503,
            )
        return await call_next(request)


def _maintenance_enabled() -> bool:
    with get_database_engine().connect() as connection:
        value = connection.execute(
            text('SELECT "maintenanceEnabled" FROM "systemSettings" LIMIT 1')
        ).scalar_one_or_none()
    return bool(value)
