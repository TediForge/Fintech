"""Public social links."""

import asyncio
import json
from typing import Any

from fastapi import APIRouter

from database.db_01.common import query_rows

router = APIRouter()


@router.get("/")
async def get_social_links() -> dict[str, Any]:
    rows = await asyncio.to_thread(
        query_rows,
        'SELECT "links" FROM "helpSocialSettings" WHERE "id" = \'primary\' LIMIT 1',
    )
    return {
        "status": 200,
        "success": True,
        "message": "Social links fetched successfully",
        "data": _json_value(rows[0]["links"]) if rows else {},
    }


def _json_value(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None
