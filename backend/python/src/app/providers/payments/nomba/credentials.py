"""No Nomba database credential lookup exists in the Node provider."""

from dataclasses import dataclass
from typing import Never

from app.providers.types import ProviderError


@dataclass(frozen=True)
class NombaCredentials:
    """No fields are known until Node implements a credential contract."""


def load_nomba_credentials() -> Never:
    raise ProviderError(
        "Nomba has no executable credential lookup or provider contract", 501
    )
