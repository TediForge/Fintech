"""Public support location lookup."""

import asyncio
import json
from typing import Any

from fastapi import APIRouter

from database.db_01.common import query_rows

router = APIRouter()


@router.get("/")
async def get_support_locations() -> dict[str, Any]:
    rows = await asyncio.to_thread(
        query_rows,
        """
        SELECT "id", "locationType", "branch", "address", "hours", "image",
               "map", "sortOrder"
        FROM "helpLocations" WHERE "status" = 'active'
        ORDER BY "locationType", "sortOrder", "branch"
        """,
    )
    offices = [_project_location(row) for row in rows if row["locationType"] == "office"]
    agents = [_project_location(row) for row in rows if row["locationType"] == "agent"]
    payload: dict[str, Any] = {"status": "success", "office": offices, "agents": agents}
    if not offices and not agents:
        payload["message"] = "no locations found"
    return payload


def _project_location(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "branch": row["branch"],
        "address": row["address"],
        "hours": row["hours"],
        "image": row["image"],
        "map": _json_value(row["map"]),
    }


def _json_value(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None
