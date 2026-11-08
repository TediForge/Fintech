"""Public app feedback submission and store-rating redirect."""

import asyncio
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from database.db_01.common import execute_statement

router = APIRouter()


class SuggestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    message: str = Field(min_length=10, max_length=1000)
    category: str = "other"
    email: str | None = Field(default=None, max_length=254)
    platform: str | None = None
    appVersion: str | None = Field(default=None, max_length=50)


@router.post("/suggest", status_code=201)
async def submit_suggestion(payload: SuggestionRequest, request: Request) -> dict[str, Any]:
    if payload.category not in {"feature", "improvement", "bugidea", "other"}:
        raise HTTPException(status_code=400, detail="Suggestion fields are invalid")
    if payload.platform is not None and payload.platform not in {"ios", "android", "web"}:
        raise HTTPException(status_code=400, detail="Suggestion fields are invalid")
    if payload.email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", payload.email):
        raise HTTPException(status_code=400, detail="Suggestion fields are invalid")
    auth = getattr(request.state, "auth", {})
    user_id = auth.get("user_id") if isinstance(auth, dict) else None
    environment = auth.get("environment", "LIVE") if isinstance(auth, dict) else "LIVE"
    email = payload.email or (auth.get("email") if isinstance(auth, dict) else None)
    await asyncio.to_thread(
        execute_statement,
        """
        INSERT INTO "featureSuggestions"
            ("userId", "environment", "category", "message", "email",
             "platform", "appVersion", "status")
        VALUES (:user_id, :environment, :category, :message, :email,
                :platform, :app_version, 'new')
        """,
        {
            "user_id": user_id,
            "environment": environment,
            "category": payload.category,
            "message": payload.message,
            "email": email,
            "platform": payload.platform,
            "app_version": payload.appVersion,
        },
    )
    return {"status": 201, "success": True, "message": "Suggestion received thank you"}


@router.get("/rate")
async def rate_app(request: Request) -> Any:
    user_agent = request.headers.get("user-agent", "").lower()
    if "android" in user_agent:
        destination = "https://play.google.com/store/search?q=PaySmart&c=apps"
    elif any(token in user_agent for token in ("iphone", "ipad", "ipod")):
        destination = "https://apps.apple.com/us/search?term=PaySmart"
    else:
        destination = "https://paysmart.com.ng/download"
    from fastapi.responses import RedirectResponse

    return RedirectResponse(destination, status_code=302)
