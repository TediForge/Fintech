"""Service transaction statistics endpoint."""

import asyncio
from typing import Any

from fastapi import APIRouter, Query

from app.lib.stats import get_service_stats

router = APIRouter()


@router.get("/")
async def service_statistics(
    service_name: str | None = Query(default=None, alias="serviceName"),
    service_name_alias: str | None = Query(default=None, alias="service_name"),
) -> dict[str, Any]:
    selected = service_name or service_name_alias
    normalized = selected.strip() if selected and selected.strip() else None
    return {
        "status": "success",
        "data": await asyncio.to_thread(get_service_stats, normalized),
    }
