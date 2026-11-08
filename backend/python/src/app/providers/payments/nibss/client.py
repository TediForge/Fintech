"""NIBSS provider code contains no executable operation to port."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Literal, Never

from app.providers.payments.nibss.credentials import (
    NibssCredentials,
)
from app.providers.types import ProviderError

NibssIntegrationStatus = Literal["unimplemented"]


@dataclass(frozen=True)
class NibssClient:
    credentials: NibssCredentials | None = None

    def request(self) -> Never:
        raise ProviderError(
            "NIBSS has no executable provider operations to port yet", 501
        )


@lru_cache(maxsize=1)
def get_nibss_client() -> NibssClient:
    return NibssClient()


def request_nibss() -> Never:
    return get_nibss_client().request()


nibss_integration_status: NibssIntegrationStatus = "unimplemented"
