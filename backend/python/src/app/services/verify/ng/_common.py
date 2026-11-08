"""Shared persistence and input validation for Nigerian verification workflows."""

import base64
import binascii
import hashlib
import re
from collections.abc import Mapping
from typing import Any

from sqlalchemy import Engine, text
from sqlalchemy.engine import Connection

from app.providers.types import ProviderError
from app.services.verify.base import VerificationSubject
from database.db_02.connection import get_db_02_engine

_MAX_FILE_BYTES = 10 * 1024 * 1024
_DATA_URI_PATTERN = re.compile(r"^data:[^;,]+;base64,", re.IGNORECASE)
_DATA_URI_MIME_PATTERN = re.compile(r"^data:([^;,]+);base64,", re.IGNORECASE)


def require_subject(value: Any) -> VerificationSubject:
    """Validate the database identity required to persist a verification."""
    if isinstance(value, VerificationSubject):
        return value
    if isinstance(value, Mapping):
        user_id = value.get("user_id")
        identifier = value.get("kyc_identifier")
    else:
        user_id = getattr(value, "user_id", None)
        identifier = getattr(value, "kyc_identifier", None)
    if (
        isinstance(user_id, bool)
        or not isinstance(user_id, int)
        or user_id < 1
        or not isinstance(identifier, str)
        or not identifier.strip()
        or len(identifier.strip()) > 50
    ):
        raise ProviderError(
            "A positive user_id and kyc_identifier are required to persist results",
            400,
        )
    return VerificationSubject(user_id=user_id, kyc_identifier=identifier.strip())


def get_engine(engine: Engine | None) -> Engine:
    """Return an injected engine or the configured db-02 engine."""
    return engine if engine is not None else get_db_02_engine()


def store_file(
    connection: Connection,
    subject: VerificationSubject,
    record_type: str,
    field_name: str,
    document: Any,
) -> int:
    """Store validated document bytes in the legacy complianceFiles table."""
    if isinstance(document, Mapping) and document.get("fileId") is not None:
        file_id = document["fileId"]
        if isinstance(file_id, bool) or not isinstance(file_id, int) or file_id < 1:
            raise ProviderError("fileId must be a positive integer", 400)
        owned_file = connection.execute(
            text(
                'SELECT "fileId" FROM "complianceFiles" WHERE "fileId"=:file_id '
                'AND "userId"=:user_id AND "kycIdentifier"=:identifier '
                'AND "recordType"=:record_type'
            ),
            {
                "file_id": file_id,
                "user_id": subject.user_id,
                "identifier": subject.kyc_identifier,
                "record_type": record_type,
            },
        ).scalar_one_or_none()
        if owned_file is None:
            raise ProviderError("Uploaded file does not belong to this KYC record", 403)
        return file_id

    if isinstance(document, bytes):
        content = document
        file_name = f"{field_name}.bin"
        mime_type = "application/octet-stream"
    elif isinstance(document, Mapping):
        encoded = document.get(
            "data",
            document.get("base64", document.get("file")),
        )
        if not isinstance(encoded, (str, bytes)):
            raise ProviderError("Document data must be base64 text or bytes", 400)
        file_name = _file_name(document.get("fileName"), field_name)
        mime_type = document.get("mimeType")
        if not mime_type and isinstance(encoded, str):
            mime_match = _DATA_URI_MIME_PATTERN.match(encoded.strip())
            mime_type = mime_match.group(1) if mime_match else None
        mime_type = mime_type or "application/octet-stream"
        if not isinstance(mime_type, str) or not mime_type.strip() or len(mime_type) > 100:
            raise ProviderError("Document mimeType is invalid", 400)
        if isinstance(encoded, bytes):
            try:
                encoded = encoded.decode("ascii")
            except UnicodeDecodeError as error:
                raise ProviderError("Document data must be base64 encoded", 400) from error
        encoded = _DATA_URI_PATTERN.sub("", encoded.strip())
        try:
            content = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ProviderError("Document data must be valid base64", 400) from error
    else:
        raise ProviderError("A document is required", 400)

    if not content or len(content) > _MAX_FILE_BYTES:
        raise ProviderError("Document must be between 1 byte and 10 MiB", 400)
    digest = hashlib.sha256(content).hexdigest()
    result = connection.execute(
        text(
            'INSERT INTO "complianceFiles" '
            '("userId","kycIdentifier","recordType","fieldName","fileName",'
            '"mimeType","fileSize","fileData","sha256") '
            "VALUES (:user_id,:identifier,:record_type,:field_name,:file_name,"
            ":mime_type,:file_size,:file_data,:sha256) RETURNING \"fileId\""
        ),
        {
            "user_id": subject.user_id,
            "identifier": subject.kyc_identifier,
            "record_type": record_type,
            "field_name": field_name,
            "file_name": file_name,
            "mime_type": mime_type.strip(),
            "file_size": len(content),
            "file_data": content,
            "sha256": digest,
        },
    )
    return int(result.scalar_one())


def _file_name(value: Any, default: str) -> str:
    if not isinstance(value, str) or not value.strip():
        return default
    file_name = value.strip().replace("\\", "/").rsplit("/", 1)[-1]
    if not file_name or len(file_name) > 255:
        raise ProviderError("Document fileName is invalid", 400)
    return file_name


def optional_text(value: Any) -> str | None:
    """Return a trimmed non-empty string or None."""
    return value.strip() if isinstance(value, str) and value.strip() else None


def required_text(value: Any, field: str, limit: int = 255) -> str:
    """Validate and normalize a required text field."""
    normalized = optional_text(value)
    if normalized is None or len(normalized) > limit:
        raise ProviderError(f"{field} is required and must be at most {limit} characters", 400)
    return normalized
