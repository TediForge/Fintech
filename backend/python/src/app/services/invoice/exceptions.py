"""Invoice-specific exceptions."""


class InvoiceNotFoundError(Exception):
    """Raised when an invoice does not exist or does not belong to the user."""


class InvalidInvoiceTransitionError(Exception):
    """Raised when a status transition is not allowed."""
