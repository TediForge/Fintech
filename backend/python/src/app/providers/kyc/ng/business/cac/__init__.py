"""Corporate Affairs Commission public-search adapter."""

from app.providers.kyc.ng.business.cac.client import (
    CacClient,
    fetch_business_details_by_registration_number,
)

__all__ = ["CacClient", "fetch_business_details_by_registration_number"]
