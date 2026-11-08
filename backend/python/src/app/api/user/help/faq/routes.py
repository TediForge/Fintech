"""Public frequently asked questions."""

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from database.db_01.common import query_rows

router = APIRouter()
_FAQ_QUERY = """
SELECT "id", "slug", "question", "answer", "category", "isFeatured",
       "status", "createdAt", "updatedAt"
FROM "helpFaqs"
"""


@router.get("/")
async def list_faqs() -> dict[str, Any]:
    rows = await asyncio.to_thread(
        query_rows,
        _FAQ_QUERY
        + """
        WHERE "status" = 'published'
        ORDER BY "isFeatured" DESC, "updatedAt" DESC
        """,
    )
    for row in rows:
        row["isFeatured"] = bool(row["isFeatured"])
    return {"success": True, "status": 200, "total": len(rows), "faqs": rows}


@router.get("/{identifier}")
async def get_faq(identifier: str) -> dict[str, Any]:
    rows = await asyncio.to_thread(
        query_rows,
        _FAQ_QUERY
        + """
        WHERE "status" = 'published'
          AND ("id"::text = :identifier OR "slug" = :identifier)
        LIMIT 1
        """,
        {"identifier": identifier},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="FAQ not found")
    rows[0]["isFeatured"] = bool(rows[0]["isFeatured"])
    return {"success": True, "status": 200, "faq": rows[0]}
