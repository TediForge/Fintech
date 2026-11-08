"""Invoice service-layer domain models."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class InvoiceStatus(StrEnum):
    """Persisted invoice statuses."""

    PENDING = "pending"
    PROCESSING = "processing"
    PARTIALLY_PAID = "partiallyPaid"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


@dataclass(frozen=True)
class InvoiceLine:
    """A positive-quantity invoice line with a minor-unit price."""

    description: str
    quantity: int
    unit_amount_minor: int


@dataclass(frozen=True)
class Invoice:
    """Invoice projection backed by db-01's existing payment-link schema."""

    id: str
    user_id: int
    environment: str
    status: InvoiceStatus
    lines: tuple[InvoiceLine, ...]
    total_minor: int | None
    amount_paid_minor: int
    currency: str
    created_at: datetime
    paid_at: datetime | None = None
    provider_reference: str | None = None
    checkout_url: str | None = None
