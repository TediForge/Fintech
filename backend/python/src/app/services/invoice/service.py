"""Invoice creation and payment-state transitions."""

import asyncio
import re
import secrets
from collections.abc import Sequence

from app.services.invoice.exceptions import (
    InvalidInvoiceTransitionError,
    InvoiceNotFoundError,
)
from app.services.invoice.models import Invoice, InvoiceLine, InvoiceStatus
from app.services.invoice.repository import InvoiceRepository

_CURRENCY_PATTERN = re.compile(r"^[A-Z]{3}$")


class InvoiceService:
    """Orchestrates invoice operations against db-01."""

    def __init__(self, repository: InvoiceRepository | None = None) -> None:
        self._repository = repository or InvoiceRepository()

    async def create(
        self,
        user_id: int,
        lines: Sequence[InvoiceLine],
        currency: str = "NGN",
        environment: str = "LIVE",
    ) -> Invoice:
        """Create a fixed-amount payment-link invoice with persisted line items."""
        _positive_user_id(user_id)
        if not lines or len(lines) > 100:
            raise ValueError("An invoice must contain between 1 and 100 lines")
        for line in lines:
            if (
                not line.description.strip()
                or len(line.description.strip()) > 255
                or isinstance(line.quantity, bool)
                or line.quantity < 1
                or isinstance(line.unit_amount_minor, bool)
                or line.unit_amount_minor < 1
            ):
                raise ValueError("Invoice lines require valid descriptions and amounts")
        currency = currency.strip().upper()
        if not _CURRENCY_PATTERN.fullmatch(currency):
            raise ValueError("currency must be a three-letter ISO code")
        environment = environment.strip().upper()
        if environment not in {"LIVE", "TEST"}:
            raise ValueError("environment must be LIVE or TEST")
        total_minor = sum(line.quantity * line.unit_amount_minor for line in lines)
        if total_minor > 99_999_999_999_999_999:
            raise ValueError("Invoice total exceeds the supported amount")
        invoice_number = f"INV-{secrets.token_hex(16).upper()}"
        return await asyncio.to_thread(
            self._repository.insert,
            invoice_number=invoice_number,
            user_id=user_id,
            environment=environment,
            amount_minor=total_minor,
            currency=currency,
            lines=lines,
        )

    async def get(
        self, invoice_id: str, user_id: int, environment: str = "LIVE"
    ) -> Invoice | None:
        """Retrieve an invoice scoped to its owner and environment."""
        _positive_user_id(user_id)
        return await asyncio.to_thread(
            self._repository.get_by_id,
            _invoice_id(invoice_id),
            user_id,
            _environment(environment),
        )

    async def list_for_user(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        environment: str = "LIVE",
    ) -> list[Invoice]:
        """Return the user's invoices, newest first."""
        _positive_user_id(user_id)
        if isinstance(limit, bool) or not 1 <= limit <= 100:
            raise ValueError("limit must be between 1 and 100")
        if isinstance(offset, bool) or offset < 0:
            raise ValueError("offset must not be negative")
        return await asyncio.to_thread(
            self._repository.list_by_user,
            user_id,
            _environment(environment),
            limit,
            offset,
        )

    async def mark_paid(
        self,
        invoice_id: str,
        provider_reference: str,
        user_id: int,
        environment: str = "LIVE",
    ) -> Invoice:
        """Mark an invoice paid, idempotently for the same provider reference."""
        invoice_id = _invoice_id(invoice_id)
        provider_reference = provider_reference.strip()
        if not provider_reference or len(provider_reference) > 100:
            raise ValueError("provider_reference must contain 1 to 100 characters")
        _positive_user_id(user_id)
        environment = _environment(environment)
        updated = await asyncio.to_thread(
            self._repository.mark_paid,
            invoice_id,
            user_id,
            environment,
            provider_reference,
        )
        if updated is not None:
            return updated
        current = await self.get(invoice_id, user_id, environment)
        if current is None:
            raise InvoiceNotFoundError("Invoice was not found")
        if (
            current.status is InvoiceStatus.PAID
            and current.provider_reference == provider_reference
        ):
            return current
        raise InvalidInvoiceTransitionError(
            f"Cannot mark invoice with status {current.status.value} as paid"
        )

    async def cancel(
        self, invoice_id: str, user_id: int, environment: str = "LIVE"
    ) -> Invoice:
        """Cancel an unpaid invoice."""
        invoice_id = _invoice_id(invoice_id)
        _positive_user_id(user_id)
        environment = _environment(environment)
        updated = await asyncio.to_thread(
            self._repository.cancel, invoice_id, user_id, environment
        )
        if updated is not None:
            return updated
        current = await self.get(invoice_id, user_id, environment)
        if current is None:
            raise InvoiceNotFoundError("Invoice was not found")
        raise InvalidInvoiceTransitionError(
            f"Cannot cancel invoice with status {current.status.value}"
        )


def _positive_user_id(user_id: int) -> None:
    if isinstance(user_id, bool) or not isinstance(user_id, int) or user_id < 1:
        raise ValueError("user_id must be a positive integer")


def _invoice_id(invoice_id: str) -> str:
    value = invoice_id.strip()
    if not value or len(value) > 40:
        raise ValueError("invoice_id must contain 1 to 40 characters")
    return value


def _environment(environment: str) -> str:
    value = environment.strip().upper()
    if value not in {"LIVE", "TEST"}:
        raise ValueError("environment must be LIVE or TEST")
    return value
