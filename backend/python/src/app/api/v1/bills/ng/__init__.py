"""Nigeria bill API routers."""

from fastapi import APIRouter

from app.api.v1.bills.ng.airtime.routes import router as airtime_router
from app.api.v1.bills.ng.cable.routes import router as cable_router
from app.api.v1.bills.ng.data.routes import router as data_router
from app.api.v1.bills.ng.electricity.routes import router as electricity_router

router = APIRouter()
router.include_router(airtime_router, prefix="/airtime", tags=["bills"])
router.include_router(data_router, prefix="/data", tags=["bills"])
router.include_router(cable_router, prefix="/cable", tags=["bills"])
router.include_router(
    electricity_router, prefix="/electricity", tags=["bills"]
)
