"""NIN verification orchestration for Nigeria."""

import uuid
from collections.abc import Mapping
from typing import Any

from sqlalchemy import Engine, text

from app.providers.kyc.ng.nin.accord.client import verify_nin_with_accord
from app.providers.kyc.ng.nin.supabase.client import verify_nin_with_supabase
from app.providers.kyc.ng.tax.jrb.client import resolve_tax_id_for_nin
from app.providers.types import ProviderError
from app.services.verify.base import VerificationSubject
from app.services.verify.ng._common import (
    get_engine,
    optional_text,
    require_subject,
    store_file,
)


class NinVerifyService:
    """Verify NIN using Supabase then Accord, optionally persisting to db-02."""

    def __init__(self, engine: Engine | None = None) -> None:
        self._engine = engine

    async def verify(
        self,
        nin: str,
        first_name: str | None = None,
        last_name: str | None = None,
        dob: str | None = None,
        *,
        subject: VerificationSubject | None = None,
    ) -> dict[str, Any]:
        """Verify NIN, enrich identity with JRB tax data, and optionally persist."""
        if not isinstance(nin, str) or len(nin) != 11 or not nin.isascii() or not nin.isdigit():
            raise ProviderError("Enter a valid 11-digit NIN", 400)

        failures: list[str] = []
        payload: dict[str, Any] | None = None
        provider: str | None = None
        for provider_name, operation in (
            ("supabase", verify_nin_with_supabase),
            ("accord", verify_nin_with_accord),
        ):
            try:
                payload = await operation(nin)
                provider = provider_name
                break
            except ProviderError as error:
                failures.append(f"{provider_name}: {error}")
        if payload is None or provider is None:
            raise ProviderError(
                f"NIN verification unavailable ({'; '.join(failures)})", 502
            )

        identity = _normalize_identity(payload, nin)
        verified_identity = dict(identity)
        identity["firstName"] = identity["firstName"] or optional_text(first_name)
        identity["lastName"] = identity["lastName"] or optional_text(last_name)
        identity["dateOfBirth"] = identity["dateOfBirth"] or optional_text(dob)

        warnings: list[str] = []
        if (
            verified_identity["firstName"]
            and verified_identity["lastName"]
            and verified_identity["dateOfBirth"]
        ):
            try:
                tax = await resolve_tax_id_for_nin(
                    nin,
                    verified_identity["firstName"],
                    verified_identity["lastName"],
                    verified_identity["dateOfBirth"],
                )
                identity["taxId"] = optional_text(tax.get("taxId"))
                identity["taxResidency"] = optional_text(tax.get("taxResidency"))
            except ProviderError:
                warnings.append("tax_id_resolution_unavailable")

        result: dict[str, Any] = {
            "reference": str(uuid.uuid4()),
            "provider": provider,
            "status": "awaitingUser",
            "identity": identity,
            "warnings": warnings,
        }
        photo = _extract_photo(payload)
        if subject is not None:
            persisted_result = dict(result)
            if photo is not None:
                persisted_result["officialPhoto"] = photo
            result["recordId"] = self.persist_result(
                subject, nin, persisted_result
            )
        result["officialPhotoAvailable"] = photo is not None
        return result

    def get_status(self, reference: str) -> dict[str, Any]:
        """Fetch the stored NIN record by its verification reference."""
        if not isinstance(reference, str) or not reference.strip():
            raise ProviderError("A verification reference is required", 400)
        with get_engine(self._engine).connect() as connection:
            row = connection.execute(
                text(
                    'SELECT "kycNinId","userId","kycIdentifier","status",'
                    '"verificationProvider","verifiedAt","verificationReference" '
                    'FROM "kycNin" WHERE "verificationReference"=:reference'
                ),
                {"reference": reference.strip()},
            ).mappings().first()
        if row is None:
            raise ProviderError("NIN verification reference was not found", 404)
        return dict(row)

    def persist_result(
        self,
        subject: VerificationSubject,
        nin: str,
        result: Mapping[str, Any],
    ) -> int:
        """Insert or update the subject's NIN record without approving it."""
        subject = require_subject(subject)
        identity = result.get("identity")
        if not isinstance(identity, Mapping):
            raise ProviderError("NIN result is missing identity details", 400)
        reference = result.get("reference")
        provider = result.get("provider")
        if not isinstance(reference, str) or not isinstance(provider, str):
            raise ProviderError("NIN result is missing provider metadata", 400)
        photo = result.get("officialPhoto")
        with get_engine(self._engine).begin() as connection:
            photo_id = (
                store_file(connection, subject, "nin", "officialPhoto", photo)
                if photo is not None
                else None
            )
            existing = connection.execute(
                text(
                    'SELECT "kycNinId","status" FROM "kycNin" WHERE "userId"=:user_id '
                    'AND "kycIdentifier"=:identifier ORDER BY "createdAt" DESC '
                    "LIMIT 1"
                ),
                {"user_id": subject.user_id, "identifier": subject.kyc_identifier},
            ).mappings().first()
            if existing is not None and existing["status"] in {
                "approved",
                "pending",
                "submitted",
            }:
                raise ProviderError(
                    "NIN cannot be changed while approved or under review", 409
                )
            values = {
                "user_id": subject.user_id,
                "identifier": subject.kyc_identifier,
                "nin": nin,
                "first_name": optional_text(identity.get("firstName")),
                "middle_name": optional_text(identity.get("middleName")),
                "last_name": optional_text(identity.get("lastName")),
                "gender": optional_text(identity.get("gender")),
                "dob": optional_text(identity.get("dateOfBirth")),
                "phone": optional_text(identity.get("phoneNumber")),
                "address": optional_text(identity.get("address")),
                "provider": provider,
                "reference": reference,
                "tax_id": optional_text(identity.get("taxId")),
                "tax_residency": optional_text(identity.get("taxResidency")),
                "photo_id": photo_id,
            }
            if existing is None:
                record_id = connection.execute(
                    text(
                        'INSERT INTO "kycNin" ("userId","kycIdentifier","nin",'
                        '"firstName","middleName","lastName","gender","dateOfBirth",'
                        '"phoneNumber","address","provider","status",'
                        '"verificationProvider","verificationReference","taxId",'
                        '"taxResidency","officialPhotoFileId") VALUES '
                        '(:user_id,:identifier,:nin,:first_name,:middle_name,'
                        ':last_name,:gender,:dob,:phone,:address,:provider,'
                        "'awaitingUser',:provider,:reference,:tax_id,:tax_residency,"
                        ':photo_id) RETURNING "kycNinId"'
                    ),
                    values,
                ).scalar_one()
            else:
                record_id = existing["kycNinId"]
                connection.execute(
                    text(
                        'UPDATE "kycNin" SET "nin"=:nin,"firstName"=:first_name,'
                        '"middleName"=:middle_name,"lastName"=:last_name,'
                        '"gender"=:gender,"dateOfBirth"=:dob,"phoneNumber"=:phone,'
                        '"address"=:address,"provider"=:provider,"status"='
                        "'awaitingUser',\"verifiedAt\"=NULL,"
                        '"verificationProvider"=:provider,'
                        '"verificationReference"=:reference,"taxId"=:tax_id,'
                        '"taxResidency"=:tax_residency,'
                        '"officialPhotoFileId"=COALESCE(:photo_id,"officialPhotoFileId"),'
                        '"updatedAt"=CURRENT_TIMESTAMP WHERE "kycNinId"=:record_id'
                    ),
                    {**values, "record_id": record_id},
                )
            return int(record_id)


def _normalize_identity(payload: Mapping[str, Any], nin: str) -> dict[str, Any]:
    data = payload.get("data")
    source = data if isinstance(data, Mapping) else payload
    nested = source.get("identity")
    if isinstance(nested, Mapping):
        source = nested
    aliases = {
        "firstName": ("firstName", "firstname", "first_name", "first"),
        "middleName": ("middleName", "middlename", "middle_name", "middle"),
        "lastName": ("lastName", "surname", "last_name", "lastname", "last"),
        "dateOfBirth": ("dateOfBirth", "birthDate", "date_of_birth", "birth_date", "dob"),
        "phoneNumber": ("phoneNumber", "phone", "phone_number", "mobile", "mobileNumber"),
        "gender": ("gender", "sex"),
        "address": ("address", "residentAddress", "residentialAddress", "addressLine"),
    }
    identity = {
        field: next(
            (
                text_value
                for alias in candidates
                if (text_value := optional_text(source.get(alias))) is not None
            ),
            None,
        )
        for field, candidates in aliases.items()
    }
    identity["nin"] = nin
    return identity


def _extract_photo(payload: Mapping[str, Any]) -> dict[str, str] | None:
    data = payload.get("data")
    source = data if isinstance(data, Mapping) else payload
    identity = source.get("identity")
    if isinstance(identity, Mapping):
        source = identity
    photo = next(
        (
            value.strip()
            for key in ("photo", "photoBase64", "image", "photo_base64")
            if isinstance((value := source.get(key)), str) and value.strip()
        ),
        None,
    )
    if photo is None or photo.startswith(("https://", "http://")):
        return None
    mime_type = "image/jpeg"
    if photo.startswith("data:"):
        header = photo.partition(",")[0]
        mime_type = header[5:].split(";", 1)[0] or mime_type
    return {"data": photo, "fileName": "official-nin-photo", "mimeType": mime_type}
