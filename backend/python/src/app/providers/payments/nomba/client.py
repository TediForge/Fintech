"""Nomba's provider code contains no executable operation to port."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Literal, Never

from app.providers.payments.nomba.credentials import (
    NombaCredentials,
)
from app.providers.types import ProviderError

NombaIntegrationStatus = Literal["unimplemented"]


@dataclass(frozen=True)
class NombaClient:
    credentials: NombaCredentials | None = None

    def check_balance(self) -> Never:
        raise ProviderError(
            "The PHP Nomba balance endpoint is empty and defines no provider contract",
            501,
        )


@lru_cache(maxsize=1)
def get_nomba_client() -> NombaClient:
    return NombaClient()


def check_nomba_balance() -> Never:
    return get_nomba_client().check_balance()


nomba_integration_status: NombaIntegrationStatus = "unimplemented"
