"""Shared provider errors and response contracts."""

from typing import Any, Literal, NotRequired, TypedDict


class ProviderError(Exception):
    """Error returned by a provider adapter."""

    def __init__(self, message: str, status: int = 502) -> None:
        super().__init__(message)
        self.status = status


ProviderStatus = Literal["success", "pending", "failed", "reversed"]


class DataPurchaseInput(TypedDict):
    network: str
    phone: str
    providerPlanId: str
    amount: float
    ported: bool
    mode: Literal["live", "test"]


class NormalizedDataPlan(TypedDict):
    providerPlanId: str
    network: str
    plan_type: str
    plan_name: str
    plan_size: str
    provider_price: float
    selling_price: float
    profit: float
    validity: str
    duration_category: str
    platformName: str
    validity_days: int


class ProviderResponse(TypedDict):
    status: ProviderStatus
    provider_raw: dict[str, Any]
    bridge_logic: str
    environment: Literal["live", "test"]
    message: NotRequired[str]
