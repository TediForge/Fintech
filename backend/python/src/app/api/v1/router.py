"""Version 1 API router assembly."""

from fastapi import APIRouter

from app.api.client.countries.routes import router as countries_router
from app.api.v1.bills import router as bills_router
from app.api.v1.flights.routes import router as flights_router
from app.api.v1.stats.routes import router as stats_router
from app.api.v1.transactions.routes import router as transactions_router

router = APIRouter()
router.include_router(countries_router)
router.include_router(bills_router, prefix="/bills")
router.include_router(
    transactions_router, prefix="/transactions", tags=["transactions"]
)
router.include_router(stats_router, prefix="/stats", tags=["stats"])
router.include_router(flights_router, prefix="/flights", tags=["flights"])
