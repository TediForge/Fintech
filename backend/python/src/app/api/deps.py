"""Shared API dependencies."""

from typing import Any

from fastapi import HTTPException, Request


async def require_user(request: Request) -> dict[str, Any]:
    """Require an authenticated end-user account."""
    auth = getattr(request.state, "auth", None)
    if not isinstance(auth, dict) or auth.get("role") != "user":
        raise HTTPException(status_code=401, detail="Authentication is required")
    user_id = auth.get("user_id", auth.get("userId"))
    if not isinstance(user_id, int) or user_id < 1:
        raise HTTPException(status_code=401, detail="Authentication is required")
    return auth
