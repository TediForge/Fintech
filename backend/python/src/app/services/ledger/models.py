"""Types used by the ledger domain service."""

from typing import Literal, NotRequired, TypedDict

LedgerDirection = Literal["credit", "debit"]
LedgerEnvironment = Literal["LIVE", "TEST"]
RefundStatus = Literal["refunded", "reversed", "cancelled"]


class LedgerEntryInput(TypedDict):
    user_id: int
    amount: float
    type: str
    service_name: str
    environment: LedgerEnvironment
    wallet_type: NotRequired[str]
    currency: NotRequired[str]
    fee: NotRequired[float]
    revenue: NotRequired[float]
    status: NotRequired[str]
    narration: NotRequired[str | None]
    session_reference: NotRequired[str | None]
    metadata: NotRequired[dict[str, object]]


class LedgerRecordInput(LedgerEntryInput):
    direction: LedgerDirection


class LedgerEntry(TypedDict):
    id: int
    reference: str
    user_id: int
    amount: float
    direction: LedgerDirection
    type: str
    service_name: str
    currency: str
    wallet_type: str
    environment: LedgerEnvironment
    balance_before: float | None
    balance_after: float | None
    status: str


class LedgerTransferParty(TypedDict):
    user_id: int
    service_name: str
    wallet_type: NotRequired[str]
    narration: NotRequired[str | None]
    metadata: NotRequired[dict[str, object]]


class LedgerTransferInput(TypedDict):
    from_party: LedgerTransferParty
    to_party: LedgerTransferParty
    amount: float
    environment: LedgerEnvironment
    type: NotRequired[str]
    currency: NotRequired[str]
    session_reference: NotRequired[str]


class LedgerRefundInput(TypedDict):
    environment: LedgerEnvironment
    reference: NotRequired[str]
    transaction_id: NotRequired[int]
    user_id: NotRequired[int]
    target_status: NotRequired[RefundStatus]
    expected_statuses: NotRequired[list[str]]
    reason: NotRequired[str]


class LedgerRefundResult(TypedDict):
    transaction_ids: list[int]
    status: RefundStatus
    linked_count: int


class LedgerSettleInput(TypedDict):
    environment: LedgerEnvironment
    reference: NotRequired[str]
    transaction_id: NotRequired[int]
    user_id: NotRequired[int]
    expected_statuses: NotRequired[list[str]]
    amount: NotRequired[float]
    fee: NotRequired[float]
    revenue: NotRequired[float]
    session_reference: NotRequired[str | None]
    apply_wallet: NotRequired[bool]
    metadata: NotRequired[dict[str, object]]


class LedgerUpdateInput(TypedDict):
    environment: LedgerEnvironment
    reference: NotRequired[str]
    transaction_id: NotRequired[int]
    user_id: NotRequired[int]
    expected_statuses: NotRequired[list[str]]
    status: NotRequired[Literal["pending", "processing", "failed"]]
    session_reference: NotRequired[str | None]
    metadata: NotRequired[dict[str, object]]
    narration: NotRequired[str]


class LedgerUpdateResult(TypedDict):
    transaction_id: int
    status: str
