"""CAC business verification orchestration for Nigeria."""

import json
import re
from collections.abc import Mapping
from datetime import date
from functools import lru_cache
from importlib.resources import files
from typing import Any

from sqlalchemy import Engine, text

from app.providers.kyc.ng.business.cac.client import (
    fetch_business_details_by_registration_number,
)
from app.providers.types import ProviderError
from app.services.verify.base import VerificationSubject
from app.services.verify.ng._common import (
    get_engine,
    optional_text,
    require_subject,
    required_text,
    store_file,
)


class BusinessVerifyService:
    """Look up CAC details and queue active registrations for manual review."""

    def __init__(self, engine: Engine | None = None) -> None:
        self._engine = engine

    async def verify(
        self,
        rc_number: str,
        company_name: str | None = None,
        *,
        subject: VerificationSubject | None = None,
        business_data: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Fetch CAC details and optionally persist an active business record."""
        supplied_name = optional_text(company_name)
        details = await fetch_business_details_by_registration_number(rc_number)
        status = optional_text(details.get("status"))
        if status is None or status.casefold() != "active":
            raise ProviderError("The CAC registration must be active", 422)
        approved_name = optional_text(details.get("approvedName"))
        resolved_name = approved_name or supplied_name
        if resolved_name is None:
            raise ProviderError(
                "Registered company name is missing from CAC and request data", 422
            )
        result: dict[str, Any] = {
            "companyName": resolved_name,
            "companyNumber": required_text(details.get("rcNumber"), "rcNumber", 255),
            "status": "pending",
            "entityType": optional_text(details.get("entityType")),
            "taxId": optional_text(details.get("taxId")),
            "companyRegistrationDate": optional_text(
                details.get("companyRegistrationDate")
            ),
            "companyId": optional_text(details.get("companyId")),
            "classificationName": optional_text(details.get("classificationName")),
            "classificationId": optional_text(details.get("classificationId")),
            "natureOfBusiness": optional_text(details.get("natureOfBusiness")),
            "providerReference": details.get("providerReference"),
        }
        if supplied_name and approved_name:
            result["companyNameMatches"] = (
                supplied_name.casefold() == approved_name.casefold()
            )
        if business_data is not None:
            result.update(_validate_business_submission(details, business_data))
        if subject is not None:
            if business_data is None:
                raise ProviderError(
                    "Business documents and at least one key person are required",
                    400,
                )
            result["recordId"] = self.persist_result(subject, result)
        return {
            key: value
            for key, value in result.items()
            if key not in {"_documents", "_keyPersons"}
        }

    async def get_directors(self, rc_number: str) -> list[dict[str, Any]]:
        """Return director details only when included in the CAC provider result."""
        details = await fetch_business_details_by_registration_number(rc_number)
        reference = details.get("providerReference")
        if isinstance(reference, str):
            try:
                reference = json.loads(reference)
            except json.JSONDecodeError as error:
                raise ProviderError(
                    "CAC provider returned invalid business reference data", 502
                ) from error
        if not isinstance(reference, Mapping):
            raise ProviderError("CAC provider did not return director details", 404)
        directors = next(
            (
                reference[key]
                for key in ("directors", "directorDetails", "keyPersons", "officers")
                if isinstance(reference.get(key), list)
            ),
            None,
        )
        if directors is None:
            raise ProviderError(
                "The CAC public lookup does not provide director details", 404
            )
        return [dict(person) for person in directors if isinstance(person, Mapping)]

    def persist_result(
        self,
        subject: VerificationSubject,
        result: Mapping[str, Any],
    ) -> int:
        """Insert or update a pending business record with the CAC response."""
        subject = require_subject(subject)
        provider_reference = result.get("providerReference")
        if isinstance(provider_reference, Mapping):
            provider_reference = json.dumps(
                provider_reference, ensure_ascii=False, separators=(",", ":")
            )
        values = {
            "user_id": subject.user_id,
            "identifier": subject.kyc_identifier,
            "company_name": optional_text(result.get("companyName")),
            "company_number": required_text(
                result.get("companyNumber"), "companyNumber", 255
            ),
            "entity_type": optional_text(result.get("entityType")),
            "tax_profile": optional_text(result.get("taxProfile")),
            "tax_id": optional_text(result.get("taxId")),
            "registration_date": optional_text(
                result.get("companyRegistrationDate")
            ),
            "company_id": optional_text(result.get("companyId")),
            "classification_name": optional_text(
                result.get("classificationName")
            ),
            "classification_id": optional_text(result.get("classificationId")),
            "nature": optional_text(result.get("natureOfBusiness")),
            "provider_reference": (
                provider_reference
                if isinstance(provider_reference, str)
                else None
            ),
        }
        documents = result.get("_documents")
        people = result.get("_keyPersons")
        if not isinstance(documents, list) or not isinstance(people, list):
            raise ProviderError(
                "Business documents and key-person information are required", 400
            )
        with get_engine(self._engine).begin() as connection:
            existing = connection.execute(
                text(
                    'SELECT "kycBusinessId","status" FROM "kycBusiness" '
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
                    "Business verification cannot be changed while approved or under review",
                    409,
                )
            if existing is None:
                record_id = connection.execute(
                    text(
                        'INSERT INTO "kycBusiness" ("userId","kycIdentifier",'
                        '"companyName","companyNumber","status","entityType",'
                        '"taxProfile","taxId","companyRegistrationDate","companyId",'
                        '"classificationName","classificationId","natureOfBusiness",'
                        '"providerReference") VALUES (:user_id,:identifier,'
                        ':company_name,:company_number,\'pending\',:entity_type,'
                        ':tax_profile,:tax_id,:registration_date,:company_id,'
                        ':classification_name,:classification_id,:nature,'
                        ':provider_reference) RETURNING "kycBusinessId"'
                    ),
                    values,
                ).scalar_one()
            else:
                record_id = existing["kycBusinessId"]
                connection.execute(
                    text(
                        'UPDATE "kycBusiness" SET "companyName"=:company_name,'
                        '"companyNumber"=:company_number,"status"=\'pending\','
                        '"verifiedAt"=NULL,"entityType"=:entity_type,'
                        '"taxProfile"=:tax_profile,"taxId"=:tax_id,'
                        '"companyRegistrationDate"=:registration_date,'
                        '"companyId"=:company_id,'
                        '"classificationName"=:classification_name,'
                        '"classificationId"=:classification_id,'
                        '"natureOfBusiness"=:nature,'
                        '"providerReference"=:provider_reference,'
                        '"updatedAt"=CURRENT_TIMESTAMP WHERE "kycBusinessId"=:record_id'
                    ),
                    {**values, "record_id": record_id},
                )
                connection.execute(
                    text(
                        'DELETE FROM "kycBusinessDocuments" '
                        'WHERE "kycBusinessId"=:record_id'
                    ),
                    {"record_id": record_id},
                )
                connection.execute(
                    text(
                        'DELETE FROM "kycBusinessKeyPersons" '
                        'WHERE "kycBusinessId"=:record_id'
                    ),
                    {"record_id": record_id},
                )
            for document in documents:
                file_id = store_file(
                    connection,
                    subject,
                    "business",
                    document["document_type"],
                    document["document"],
                )
                connection.execute(
                    text(
                        'INSERT INTO "kycBusinessDocuments" '
                        '("kycBusinessId","documentType","fileId") '
                        "VALUES (:record_id,:document_type,:file_id)"
                    ),
                    {
                        "record_id": record_id,
                        "document_type": document["document_type"],
                        "file_id": file_id,
                    },
                )
            for index, person in enumerate(people, start=1):
                file_id = store_file(
                    connection,
                    subject,
                    "business",
                    f"keyPerson-{index}",
                    person["identification_document"],
                )
                json_expression = (
                    "CAST(:person_data AS jsonb)"
                    if connection.dialect.name == "postgresql"
                    else ":person_data"
                )
                connection.execute(
                    text(
                        'INSERT INTO "kycBusinessKeyPersons" '
                        '("kycBusinessId","role","fullName","dateOfBirth",'
                        '"phoneNumber","email","identificationType",'
                        '"identificationFileId","personData") VALUES '
                        "(:record_id,:role,:full_name,:date_of_birth,:phone,:email,"
                        f":identification_type,:file_id,{json_expression})"
                    ),
                    {
                        "record_id": record_id,
                        "role": person["role"],
                        "full_name": person["full_name"],
                        "date_of_birth": person["date_of_birth"],
                        "phone": person["phone"],
                        "email": person["email"],
                        "identification_type": person["identification_type"],
                        "file_id": file_id,
                        "person_data": json.dumps(
                            person["person_data"],
                            ensure_ascii=False,
                            separators=(",", ":"),
                        ),
                    },
                )
        return int(record_id)


@lru_cache(maxsize=1)
def _business_rules() -> dict[str, Any]:
    try:
        rules = json.loads(
            files("app.data")
            .joinpath("verify_business_ng.json")
            .read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError) as error:
        raise ProviderError("Nigerian business verification rules are unavailable", 500) from error
    if not isinstance(rules, dict) or not isinstance(rules.get("entityTypes"), dict):
        raise ProviderError("Nigerian business verification rules are invalid", 500)
    return rules


def _validate_business_submission(
    details: Mapping[str, Any],
    business_data: Mapping[str, Any],
) -> dict[str, Any]:
    rules = _business_rules()
    entity_profiles = rules["entityTypes"]
    entity_type = optional_text(business_data.get("entityType"))
    if entity_type is None:
        candidates = [
            value
            for value in (
                details.get("classificationName"),
                details.get("approvedName"),
                details.get("natureOfBusiness"),
                details.get("entityType"),
            )
            if isinstance(value, str)
        ]
        reference = details.get("providerReference")
        if isinstance(reference, str):
            try:
                reference = json.loads(reference)
            except json.JSONDecodeError:
                reference = None
        candidates.extend(_collect_strings(reference))
        normalized_candidates = [
            f" {_normalize_match_text(candidate)} "
            for candidate in candidates
            if _normalize_match_text(candidate)
        ]
        matches: list[tuple[int, str]] = []
        for key, profile in entity_profiles.items():
            if not isinstance(profile, Mapping):
                continue
            terms = profile.get("matchTerms")
            if not isinstance(terms, list):
                continue
            normalized_terms = [
                _normalize_match_text(term)
                for term in terms
                if isinstance(term, str) and _normalize_match_text(term)
            ]
            matching_lengths = [
                len(term)
                for term in normalized_terms
                if any(f" {term} " in candidate for candidate in normalized_candidates)
            ]
            if matching_lengths:
                matches.append((max(matching_lengths), key))
        entity_type = max(matches)[1] if matches else None
    entity_type = entity_type.upper() if entity_type else None
    profile = entity_profiles.get(entity_type) if entity_type else None
    if not isinstance(profile, Mapping):
        raise ProviderError("Select a supported CAC entity type", 400)

    supplied_documents = business_data.get("documents")
    if not isinstance(supplied_documents, Mapping):
        raise ProviderError("Business documents must be an object", 400)
    documents: list[dict[str, Any]] = []
    definitions = profile.get("documents")
    if not isinstance(definitions, list):
        raise ProviderError("Business document requirements are invalid", 500)
    for definition in definitions:
        if not isinstance(definition, Mapping) or definition.get("required") is False:
            continue
        document_type = required_text(definition.get("name"), "documentType", 80)
        supplied = supplied_documents.get(document_type)
        if supplied is None:
            raise ProviderError(f"Upload {document_type}", 400)
        document = supplied if isinstance(supplied, Mapping) else {"file": supplied}
        documents.append({"document_type": document_type, "document": document})

    supplied_people = business_data.get("keyPersons")
    if not isinstance(supplied_people, list) or not supplied_people:
        raise ProviderError("Add at least one key person", 400)
    allowed_roles = profile.get("roles")
    identification_types = {
        item.get("value", "").upper()
        for item in rules.get("identificationTypes", [])
        if isinstance(item, Mapping) and isinstance(item.get("value"), str)
    }
    if not isinstance(allowed_roles, list):
        raise ProviderError("Business role requirements are invalid", 500)
    people: list[dict[str, Any]] = []
    for index, item in enumerate(supplied_people, start=1):
        if not isinstance(item, Mapping):
            raise ProviderError("Each key person must be an object", 400)
        role = required_text(item.get("role"), f"keyPersons[{index}].role", 80)
        identification_type = required_text(
            item.get("identificationType"),
            f"keyPersons[{index}].identificationType",
            80,
        ).upper()
        if role not in allowed_roles or identification_type not in identification_types:
            raise ProviderError(
                "Each key person requires a supported role and identification type",
                400,
            )
        full_name = required_text(item.get("fullName"), f"keyPersons[{index}].fullName")
        dob = required_text(item.get("dateOfBirth"), f"keyPersons[{index}].dateOfBirth", 50)
        try:
            normalized_dob = date.fromisoformat(dob).isoformat()
        except ValueError as error:
            raise ProviderError("A valid ISO date of birth is required", 400) from error
        phone = required_text(item.get("phoneNumber"), f"keyPersons[{index}].phoneNumber", 50)
        email = required_text(item.get("email"), f"keyPersons[{index}].email", 255)
        if re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) is None:
            raise ProviderError("Each key person requires a valid email", 400)
        identification_document = item.get(
            "identificationDocument",
            item.get("document"),
        )
        if identification_document is None:
            raise ProviderError(
                f"Upload identification for key person {index}", 400
            )
        safe_person_data = {
            key: value
            for key, value in item.items()
            if key not in {"identificationDocument", "document"}
        }
        people.append(
            {
                "role": role,
                "identification_type": identification_type,
                "full_name": full_name,
                "date_of_birth": normalized_dob,
                "phone": phone,
                "email": email,
                "identification_document": identification_document,
                "person_data": safe_person_data,
            }
        )
    return {
        "entityType": entity_type,
        "taxProfile": optional_text(profile.get("taxProfile")),
        "_documents": documents,
        "_keyPersons": people,
    }


def _normalize_match_text(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def _collect_strings(value: Any) -> list[str]:
    if isinstance(value, str | int | float):
        return [str(value)]
    if isinstance(value, list):
        return [item for nested in value for item in _collect_strings(nested)]
    if isinstance(value, Mapping):
        return [item for nested in value.values() for item in _collect_strings(nested)]
    return []
