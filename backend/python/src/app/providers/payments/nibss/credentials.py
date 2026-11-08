"""No NIBSS database credential lookup exists in the Node provider."""

from dataclasses import dataclass
from typing import Never

from app.providers.types import ProviderError


@dataclass(frozen=True)
class NibssCredentials:
    """No fields are known until Node implements a credential contract."""


def load_nibss_credentials() -> Never:
    raise ProviderError(
        "NIBSS has no executable credential lookup or provider contract", 501
    )
