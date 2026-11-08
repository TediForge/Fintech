"""Ledger domain errors."""


class LedgerError(Exception):
    """A ledger operation failed with an HTTP-compatible status."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
