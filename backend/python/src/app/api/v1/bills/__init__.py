"""Country-scoped bills API package."""

from fastapi import APIRouter

from app.api.v1.bills.ng import router as nigeria_router

router = APIRouter()
router.include_router(nigeria_router, prefix="/ng")
