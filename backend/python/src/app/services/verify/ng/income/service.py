"""Income verification submission and provider orchestration for Nigeria."""

import json
import re
import uuid
from collections.abc import Mapping
from typing import Any, Protocol

from sqlalchemy import Engine, text

from app.providers.types import ProviderError
from app.services.verify.base import VerificationSubject
from app.services.verify.ng._common import (
    get_engine,
    optional_text,
    require_subject,
    required_text,
    store_file,
)


class IncomeStatementProvider(Protocol):
    """Optional adapter contract for bank-statement income analysis."""

    async def verify_income(
        self, account_id: str, **kwargs: Any
    ) -> dict[str, Any]:
        """Analyze a bank account's statement data."""
        ...


class IncomeVerifyService:
    """Collect income evidence; use a configured provider for statement analysis."""

    def __init__(
        self,
        engine: Engine | None = None,
        provider: IncomeStatementProvider | None = None,
    ) -> None:
        self._engine = engine
        self._provider = provider

    async def verify_from_statement(
        self,
        account_id: str,
        months: int = 6,
        *,
        subject: VerificationSubject | None = None,
    ) -> dict[str, Any]:
        """Run statement analysis when a real income provider is configured."""
        if not isinstance(account_id, str) or not account_id.strip():
            raise ProviderError("account_id is required", 400)
        if isinstance(months, bool) or not isinstance(months, int) or not 1 <= months <= 24:
            raise ProviderError("months must be an integer between 1 and 24", 400)
        if self._provider is None:
            raise ProviderError(
                "Automated income verification is unavailable: no bank-statement "
                "provider has been migrated. Submit income documents for manual review.",
                501,
            )
        result = await self._provider.verify_income(
            account_id.strip(),
            months=months,
        )
        if not isinstance(result, Mapping):
            raise ProviderError("Income provider returned an invalid response", 502)
        normalized = dict(result)
        normalized.setdefault("reference", str(uuid.uuid4()))
        normalized.setdefault("status", "pending")
        if subject is not None:
            normalized["recordId"] = self.submit_income(subject, normalized)
        return normalized

    def submit_income(
        self,
        subject: VerificationSubject,
        income_data: Mapping[str, Any],
    ) -> int:
        """Store user-reported income and supporting documents for review."""
        subject = require_subject(subject)
        occupation = required_text(income_data.get("occupation"), "occupation", 100)
        source = required_text(
            income_data.get("sourceOfFunds"), "sourceOfFunds", 100
        )
        currency = required_text(
            income_data.get("incomeCurrency"), "incomeCurrency", 3
        ).upper()
        if re.fullmatch(r"[A-Z]{3}", currency) is None:
            raise ProviderError("incomeCurrency must be a three-letter ISO code", 400)
        income_range = required_text(income_data.get("incomeRange"), "incomeRange", 50)
        match = re.fullmatch(r"([0-9]+)-([0-9]+)", income_range)
        if match is None or int(match.group(1)) > int(match.group(2)):
            raise ProviderError("incomeRange must be a valid minimum-maximum range", 400)
        documents = income_data.get("documents")
        if not isinstance(documents, list) or not documents:
            raise ProviderError("At least one income document is required", 400)

        with get_engine(self._engine).begin() as connection:
            stored_documents = []
            for index, document in enumerate(documents, start=1):
                if not isinstance(document, Mapping):
                    raise ProviderError("Each income document must be an object", 400)
                document_type = required_text(
                    document.get("type"), f"documents[{index - 1}].type", 80
                )
                file_id = store_file(
                    connection,
                    subject,
                    "income",
                    f"document-{index}",
                    document,
                )
                stored_documents.append(
                    {"type": document_type, "fileId": file_id, "status": "pending"}
                )

            values = {
                "user_id": subject.user_id,
                "identifier": subject.kyc_identifier,
                "occupation": occupation,
                "source": source,
                "currency": currency,
                "income_range": income_range,
                "documents": json.dumps(stored_documents, separators=(",", ":")),
            }
            documents_expression = (
                "CAST(:documents AS jsonb)"
                if connection.dialect.name == "postgresql"
                else ":documents"
            )
            existing = connection.execute(
                text(
                    'SELECT "kycIncomeId","status" FROM "kycIncome" '
                    'WHERE "userId"=:user_id AND "kycIdentifier"=:identifier '
                    'ORDER BY "createdAt" DESC LIMIT 1'
                ),
                values,
            ).mappings().first()
            if existing is not None and existing["status"] in {
                "approved",
                "pending",
                "submitted",
            }:
                raise ProviderError(
                    "Income verification cannot be changed while approved or under review",
                    409,
                )
            if existing is None:
                record_id = connection.execute(
                    text(
                        'INSERT INTO "kycIncome" ("userId","kycIdentifier",'
                        '"occupation","sourceOfFunds","incomeCurrency","incomeRange",'
                        '"documents","status") VALUES (:user_id,:identifier,'
                        ':occupation,:source,:currency,:income_range,'
                        f"{documents_expression},'pending') "
                        'RETURNING "kycIncomeId"'
                    ),
                    values,
                ).scalar_one()
            else:
                record_id = existing["kycIncomeId"]
                connection.execute(
                    text(
                        'UPDATE "kycIncome" SET "occupation"=:occupation,'
                        '"sourceOfFunds"=:source,"incomeCurrency"=:currency,'
                        f'"incomeRange"=:income_range,"documents"={documents_expression},'
                        '"status"=\'pending\',"verifiedAt"=NULL,'
                        '"updatedAt"=CURRENT_TIMESTAMP WHERE "kycIncomeId"=:record_id'
                    ),
                    {**values, "record_id": record_id},
                )
        return int(record_id)

    def persist_result(
        self,
        subject: VerificationSubject,
        result: Mapping[str, Any],
    ) -> int:
        """Persist provider-produced income results using the supported data model."""
        if not all(
            optional_text(result.get(key))
            for key in ("occupation", "sourceOfFunds", "incomeCurrency", "incomeRange")
        ):
            raise ProviderError(
                "Income provider results must include occupation, sourceOfFunds, "
                "incomeCurrency, and incomeRange",
                400,
            )
        return self.submit_income(subject, result)
