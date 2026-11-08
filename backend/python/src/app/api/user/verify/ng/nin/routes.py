"""NIN submission (NG)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api.user.verify.deps import require_country_user

router = APIRouter(prefix="/user/verify/ng/nin", tags=["verify"])
NgUser = Annotated[dict[str, Any], Depends(require_country_user("NG"))]


@router.post("/")
async def submit_nin(
    auth: NgUser,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Submit NIN for verification."""
    raise NotImplementedError
