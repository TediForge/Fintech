"""Persistence for the db-01 invoices table."""

import json
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import Engine, text

from app.services.invoice.models import Invoice, InvoiceLine, InvoiceStatus
from database.db_01.connection import get_database_engine


class InvoiceRepository:
    """Reads and writes invoice payment links in db-01."""

    def __init__(self, engine: Engine | None = None) -> None:
        self._engine = engine or get_database_engine()

    def insert(
        self,
        *,
        invoice_number: str,
        user_id: int,
        environment: str,
        amount_minor: int,
        currency: str,
        lines: Sequence[InvoiceLine],
    ) -> Invoice:
        document = {
            "items": [
                {
                    "description": line.description,
                    "quantity": line.quantity,
                    "unitAmountMinor": line.unit_amount_minor,
                }
                for line in lines
            ]
        }
        with self._engine.begin() as connection:
            row = connection.execute(
                text(
                    """
                    INSERT INTO "invoices"
                        ("invoiceNumber", "userId", "environment", "type",
                         "amount", "amountPaid", "isAmountFixed", "currency",
                         "purpose", "status", "document")
                    VALUES
                        (:number, :user_id, :environment, 'paymentLink',
                         :amount, 0, TRUE, :currency, 'walletDeposit',
                         'pending', CAST(:document AS jsonb))
                    RETURNING *
                    """
                ),
                {
                    "number": invoice_number,
                    "user_id": user_id,
                    "environment": environment,
                    "amount": amount_minor / 100,
                    "currency": currency,
                    "document": json.dumps(document),
                },
            ).mappings().one()
        return _invoice(row)

    def get_by_id(
        self, invoice_id: str, user_id: int, environment: str
    ) -> Invoice | None:
        with self._engine.connect() as connection:
            row = (
                connection.execute(
                    text(
                        """
                        SELECT * FROM "invoices"
                        WHERE "invoiceNumber" = :invoice_id
                          AND "userId" = :user_id AND "environment" = :environment
                        LIMIT 1
                        """
                    ),
                    {
                        "invoice_id": invoice_id,
                        "user_id": user_id,
                        "environment": environment,
                    },
                )
                .mappings()
                .first()
            )
        return _invoice(row) if row is not None else None

    def list_by_user(
        self, user_id: int, environment: str, limit: int, offset: int
    ) -> list[Invoice]:
        with self._engine.connect() as connection:
            rows = (
                connection.execute(
                    text(
                        """
                        SELECT * FROM "invoices"
                        WHERE "userId" = :user_id AND "environment" = :environment
                        ORDER BY "createdAt" DESC, "id" DESC
                        LIMIT :limit OFFSET :offset
                        """
                    ),
                    {
                        "user_id": user_id,
                        "environment": environment,
                        "limit": limit,
                        "offset": offset,
                    },
                )
                .mappings()
                .all()
            )
        return [_invoice(row) for row in rows]

    def mark_paid(
        self,
        invoice_id: str,
        user_id: int,
        environment: str,
        provider_reference: str,
    ) -> Invoice | None:
        with self._engine.begin() as connection:
            row = (
                connection.execute(
                    text(
                        """
                        UPDATE "invoices"
                        SET "status" = 'paid', "amountPaid" = COALESCE("amount", 0),
                            "providerReference" = :provider_reference,
                            "paidAt" = CURRENT_TIMESTAMP,
                            "updatedAt" = CURRENT_TIMESTAMP
                        WHERE "invoiceNumber" = :invoice_id AND "userId" = :user_id
                          AND "environment" = :environment
                          AND "status" IN ('pending', 'processing', 'partiallyPaid')
                        RETURNING *
                        """
                    ),
                    {
                        "invoice_id": invoice_id,
                        "user_id": user_id,
                        "environment": environment,
                        "provider_reference": provider_reference,
                    },
                )
                .mappings()
                .first()
            )
        return _invoice(row) if row is not None else None

    def cancel(
        self, invoice_id: str, user_id: int, environment: str
    ) -> Invoice | None:
        with self._engine.begin() as connection:
            row = (
                connection.execute(
                    text(
                        """
                        UPDATE "invoices"
                        SET "status" = 'cancelled', "endedAt" = CURRENT_TIMESTAMP,
                            "updatedAt" = CURRENT_TIMESTAMP
                        WHERE "invoiceNumber" = :invoice_id AND "userId" = :user_id
                          AND "environment" = :environment
                          AND "status" IN ('pending', 'processing')
                        RETURNING *
                        """
                    ),
                    {
                        "invoice_id": invoice_id,
                        "user_id": user_id,
                        "environment": environment,
                    },
                )
                .mappings()
                .first()
            )
        return _invoice(row) if row is not None else None


def _invoice(row: Mapping[str, Any]) -> Invoice:
    document = row["document"]
    if isinstance(document, str):
        document = json.loads(document)
    if not isinstance(document, Mapping):
        document = {}
    raw_lines = document.get("items", [])
    lines: list[InvoiceLine] = []
    if isinstance(raw_lines, list):
        for item in raw_lines:
            if not isinstance(item, Mapping):
                continue
            lines.append(
                InvoiceLine(
                    description=str(item.get("description", "")),
                    quantity=int(item.get("quantity", 0)),
                    unit_amount_minor=int(item.get("unitAmountMinor", 0)),
                )
            )
    amount = row["amount"]
    paid = row["amountPaid"] or 0
    return Invoice(
        id=str(row["invoiceNumber"]),
        user_id=int(row["userId"]),
        environment=str(row["environment"]),
        status=InvoiceStatus(row["status"]),
        lines=tuple(lines),
        total_minor=round(float(amount) * 100) if amount is not None else None,
        amount_paid_minor=round(float(paid) * 100),
        currency=str(row["currency"]),
        created_at=row["createdAt"],
        paid_at=row["paidAt"],
        provider_reference=row["providerReference"],
        checkout_url=row["checkoutUrl"],
    )
