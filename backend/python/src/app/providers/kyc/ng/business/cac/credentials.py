"""CAC public lookup has no credential lookup in the legacy handler."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CacCredentials:
    """CAC public endpoints currently require no credentials."""


def load_cac_credentials() -> CacCredentials:
    return CacCredentials()
