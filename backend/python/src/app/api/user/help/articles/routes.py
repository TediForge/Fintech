"""Public help article and category endpoints."""

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from database.db_01.common import query_rows

router = APIRouter()
_ARTICLE_SELECT = """
SELECT a."id", a."slug", a."categoryId", a."title", a."summary", a."content",
       a."readTime", a."isFeatured", a."status", a."createdAt", a."updatedAt",
       c."name" AS "categoryName", c."slug" AS "categorySlug",
       c."description" AS "categoryDescription", c."icon" AS "categoryIcon"
FROM "helpArticles" a
LEFT JOIN "helpArticleCategories" c ON c."categoryId" = a."categoryId"
"""
_CATEGORY_QUERY = """
SELECT c."categoryId" AS "id", c."name", c."slug", c."description", c."icon",
       COUNT(a."id") AS "count"
FROM "helpArticleCategories" c
JOIN "helpArticles" a
  ON a."categoryId" = c."categoryId" AND a."status" = 'published'
WHERE c."status" = 'active'
GROUP BY c."categoryId"
ORDER BY c."name"
"""


@router.get("/categories")
async def list_article_categories() -> dict[str, Any]:
    categories = await asyncio.to_thread(query_rows, _CATEGORY_QUERY)
    return {
        "success": True,
        "status": 200,
        "total": len(categories),
        "categories": categories,
    }


@router.get("/")
async def list_articles() -> dict[str, Any]:
    articles, categories = await asyncio.gather(
        asyncio.to_thread(_article_rows, None),
        asyncio.to_thread(query_rows, _CATEGORY_QUERY),
    )
    return {
        "success": True,
        "status": 200,
        "total": len(articles),
        "articles": [_project_article(row) for row in articles],
        "categories": categories,
    }


@router.get("/{identifier}")
async def get_article_or_category(identifier: str) -> dict[str, Any]:
    rows = await asyncio.to_thread(_article_rows, identifier)
    if rows:
        return {"success": True, "status": 200, "article": _project_article(rows[0])}
    categories = await asyncio.to_thread(
        query_rows,
        """
        SELECT "categoryId", "name", "slug", "description", "icon"
        FROM "helpArticleCategories"
        WHERE "status" = 'active'
          AND ("categoryId"::text = :identifier OR "slug" = :identifier
               OR LOWER("name") = LOWER(:identifier))
        LIMIT 1
        """,
        {"identifier": identifier},
    )
    if not categories:
        raise HTTPException(status_code=404, detail="Article or category not found")
    category = categories[0]
    articles = await asyncio.to_thread(
        query_rows,
        _ARTICLE_SELECT
        + """
        WHERE a."status" = 'published' AND a."categoryId" = :category_id
        ORDER BY a."isFeatured" DESC, a."updatedAt" DESC
        """,
        {"category_id": category["categoryId"]},
    )
    return {
        "success": True,
        "status": 200,
        "category": {
            "id": category["categoryId"],
            "name": category["name"],
            "slug": category["slug"],
            "description": category["description"],
            "icon": category["icon"],
        },
        "total": len(articles),
        "articles": [_project_article(row) for row in articles],
    }


def _article_rows(identifier: str | None) -> list[dict[str, Any]]:
    statement = _ARTICLE_SELECT + ' WHERE a."status" = \'published\''
    parameters: dict[str, Any] = {}
    if identifier is not None:
        statement += ' AND (a."id"::text = :identifier OR a."slug" = :identifier)'
        parameters["identifier"] = identifier
    statement += ' ORDER BY a."isFeatured" DESC, a."updatedAt" DESC'
    if identifier is not None:
        statement += " LIMIT 1"
    return query_rows(statement, parameters)


def _project_article(row: dict[str, Any]) -> dict[str, Any]:
    category_id = row["categoryId"]
    return {
        "id": row["id"],
        "slug": row["slug"],
        "categoryId": category_id,
        "category": (
            {
                "id": category_id,
                "name": row["categoryName"],
                "slug": row["categorySlug"],
                "description": row["categoryDescription"],
                "icon": row["categoryIcon"],
            }
            if category_id
            else None
        ),
        "title": row["title"],
        "summary": row["summary"],
        "content": row["content"],
        "readTime": row["readTime"],
        "isFeatured": bool(row["isFeatured"]),
        "status": row["status"],
        "createdAt": row["createdAt"],
        "updatedAt": row["updatedAt"],
    }
