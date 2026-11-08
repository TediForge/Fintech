"""JRB tax resolver has no credential lookup in the legacy handler."""

from dataclasses import dataclass


@dataclass(frozen=True)
class JrbTaxCredentials:
    """JRB currently requires no credentials."""


def load_jrb_tax_credentials() -> JrbTaxCredentials:
    return JrbTaxCredentials()
