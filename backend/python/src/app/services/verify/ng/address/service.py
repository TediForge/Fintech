"""Manual address verification submission for Nigeria."""

import uuid
from collections.abc import Mapping
from typing import Any

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


class AddressVerifyService:
    """Collect address evidence and persist it for manual review."""

    def __init__(self, engine: Engine | None = None) -> None:
        self._engine = engine

    async def verify(
        self,
        address_data: dict[str, Any],
        *,
        subject: VerificationSubject | None = None,
    ) -> dict[str, Any]:
        """Validate address details and document, then queue them for review."""
        if not isinstance(address_data, Mapping):
            raise ProviderError("Address data must be an object", 400)
        address = address_data.get("address", address_data)
        if not isinstance(address, Mapping):
            raise ProviderError("address must be an object", 400)
        address_verification = address_data.get("addressVerification")
        if not isinstance(address_verification, Mapping):
            address_verification = {}
        document = address_data.get(
            "verificationDocument",
            address_data.get(
                "document",
                address_verification.get("documentFile"),
            ),
        )
        document_type = required_text(
            address_data.get("verificationDocumentType")
            or address_data.get("documentType")
            or address_verification.get("documentType"),
            "verificationDocumentType",
            100,
        )
        if document_type not in {
            "utilityBill",
            "wasteBill",
            "bankStatement",
            "tenancyAgreement",
        }:
            raise ProviderError("Unsupported address verification document type", 400)
        if document is None:
            raise ProviderError("An address verification document is required", 400)
        result: dict[str, Any] = {
            "reference": str(uuid.uuid4()),
            "line1": required_text(address.get("line1"), "line1"),
            "lga": required_text(address.get("lga"), "lga"),
            "state": required_text(address.get("state"), "state"),
            "postalCode": optional_text(address.get("postalCode")),
            "country": required_text(address.get("country"), "country", 100),
            "verificationDocumentType": document_type,
            "status": "pending",
        }
        if isinstance(document, str):
            document = {
                "data": document,
                "fileName": address_verification.get("fileName"),
                "mimeType": address_verification.get("mimeType"),
            }
        elif isinstance(document, Mapping):
            document = dict(document)
        if isinstance(document, Mapping):
            mime_type = document.get("mimeType")
            encoded = document.get(
                "data",
                document.get("base64", document.get("file")),
            )
            if not mime_type and isinstance(encoded, str) and encoded.startswith("data:"):
                mime_type = encoded[5:].split(";", 1)[0].split(",", 1)[0]
            if mime_type and mime_type not in {
                "application/pdf",
                "image/jpeg",
                "image/png",
            }:
                raise ProviderError(
                    "Address evidence must be a PDF, JPEG, or PNG file", 400
                )
        if subject is not None:
            result["recordId"] = self.persist_result(subject, result, document)
        return result

    def persist_result(
        self,
        subject: VerificationSubject,
        result: Mapping[str, Any],
        document: Any,
    ) -> int:
        """Store address evidence and create or update its pending record."""
        subject = require_subject(subject)
        document_type = required_text(
            result.get("verificationDocumentType"),
            "verificationDocumentType",
            100,
        )
        values = {
            "user_id": subject.user_id,
            "identifier": subject.kyc_identifier,
            "line1": required_text(result.get("line1"), "line1"),
            "lga": required_text(result.get("lga"), "lga"),
            "state": required_text(result.get("state"), "state"),
            "postal_code": optional_text(result.get("postalCode")),
            "country": required_text(result.get("country"), "country", 100),
            "document_type": document_type,
        }
        with get_engine(self._engine).begin() as connection:
            file_id = store_file(
                connection, subject, "address", "verificationDocument", document
            )
            existing = connection.execute(
                text(
                    'SELECT "kycAddressId","status" FROM "kycAddress" '
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
                    "Address cannot be changed while approved or under review", 409
                )
            if existing is None:
                record_id = connection.execute(
                    text(
                        'INSERT INTO "kycAddress" ("userId","kycIdentifier","line1",'
                        '"lga","state","postalCode","country","status",'
                        '"verificationDocumentType","verificationDocumentFileId") '
                        "VALUES (:user_id,:identifier,:line1,:lga,:state,:postal_code,"
                        ":country,'pending',:document_type,:file_id) "
                        'RETURNING "kycAddressId"'
                    ),
                    {**values, "file_id": file_id},
                ).scalar_one()
            else:
                record_id = existing["kycAddressId"]
                connection.execute(
                    text(
                        'UPDATE "kycAddress" SET "line1"=:line1,"lga"=:lga,'
                        '"state"=:state,"postalCode"=:postal_code,"country"=:country,'
                        '"status"=\'pending\',"verificationDocumentType"=:document_type,'
                        '"verificationDocumentFileId"=:file_id,"verifiedAt"=NULL,'
                        '"updatedAt"=CURRENT_TIMESTAMP WHERE "kycAddressId"=:record_id'
                    ),
                    {**values, "file_id": file_id, "record_id": record_id},
                )
        return int(record_id)
