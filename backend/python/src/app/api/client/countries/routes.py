"""Public countries metadata endpoint matching the legacy Node response."""

import json
from importlib.resources import files

from fastapi import APIRouter

router = APIRouter(prefix="/client/countries", tags=["client"])

_COUNTRIES = json.loads(
    files("app.data").joinpath("countries.json").read_text(encoding="utf-8")
)


@router.get("/")
async def list_countries() -> dict[str, dict[str, str]]:
    """Return the supported country map with dial codes."""
    return _COUNTRIES
