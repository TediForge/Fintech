"""Income submission (NG)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api.user.verify.deps import require_country_user

router = APIRouter(prefix="/user/verify/ng/income", tags=["verify"])
NgUser = Annotated[dict[str, Any], Depends(require_country_user("NG"))]


@router.post("/")
async def submit_income(
    auth: NgUser,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Submit income evidence for verification."""
    raise NotImplementedError
