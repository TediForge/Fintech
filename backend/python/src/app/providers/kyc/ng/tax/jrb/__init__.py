"""Public JRB tax-identity resolver."""

from app.providers.kyc.ng.tax.jrb.client import (
    JrbTaxClient,
    resolve_tax_id_for_nin,
)

__all__ = ["JrbTaxClient", "resolve_tax_id_for_nin"]
