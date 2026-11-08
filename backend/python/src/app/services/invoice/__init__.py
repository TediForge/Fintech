"""Invoice service package.

Owns the invoice lifecycle: creation, status transitions, and
retrieval. Provider calls (Remita, etc.) are delegated to
adapters under app/providers/payments/ per D-001.

Database: invoices and related records live in db-01 (fintech).

Legacy source: node/src/routes/v1/invoices/**
See M-001 §E.9 for the gap analysis.
"""

from app.services.invoice.service import InvoiceService

__all__ = ["InvoiceService"]
