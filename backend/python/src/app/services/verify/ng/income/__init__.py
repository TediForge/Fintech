"""Income verification service."""

from app.services.verify.ng.income.service import (
    IncomeStatementProvider,
    IncomeVerifyService,
)

__all__ = ["IncomeStatementProvider", "IncomeVerifyService"]
