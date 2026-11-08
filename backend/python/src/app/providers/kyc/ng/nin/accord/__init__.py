"""Public Accord NIN-verification adapter."""

from app.providers.kyc.ng.nin.accord.client import (
    AccordNinClient,
    verify_nin_with_accord,
)

__all__ = ["AccordNinClient", "verify_nin_with_accord"]
