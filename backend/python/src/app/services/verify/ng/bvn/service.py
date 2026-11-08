"""BVN submission and Face++ comparison orchestration for Nigeria."""

import re
from collections.abc import Mapping
from typing import Any

from sqlalchemy import Engine, text

from app.providers.biometrics.facepp.client import compare_faces
from app.providers.types import ProviderError
from app.services.verify.base import VerificationSubject
from app.services.verify.ng._common import get_engine, optional_text, require_subject


class BvnVerifyService:
    """Persist user-submitted BVN data and optionally compare face images."""

    def __init__(self, engine: Engine | None = None) -> None:
        self._engine = engine

    async def verify(
        self,
        bvn: str,
        first_name: str | None = None,
        last_name: str | None = None,
        phone: str | None = None,
        *,
        subject: VerificationSubject | None = None,
    ) -> dict[str, Any]:
        """Validate BVN identity data; legacy submissions remain pending review."""
        if not isinstance(bvn, str) or re.fullmatch(r"[0-9]{11}", bvn) is None:
            raise ProviderError("Enter a valid 11-digit BVN", 400)
        result: dict[str, Any] = {
            "bvn": bvn,
            "firstName": optional_text(first_name),
            "lastName": optional_text(last_name),
            "phoneNumber": optional_text(phone),
            "provider": "manual",
            "status": "pending",
        }
        if subject is not None:
            result["recordId"] = self.persist_result(subject, result)
        return result

    async def face_match(
        self,
        bvn: str,
        selfie: str,
        reference_image: str | None = None,
        threshold: float = 75.0,
    ) -> dict[str, Any]:
        """Compare a supplied BVN reference image and selfie through Face++."""
        if not isinstance(bvn, str) or re.fullmatch(r"[0-9]{11}", bvn) is None:
            raise ProviderError("Enter a valid 11-digit BVN", 400)
        if not isinstance(reference_image, str) or not reference_image.strip():
            raise ProviderError(
                "A verified BVN reference image is required; the legacy BVN record "
                "does not contain one",
                400,
            )
        comparison = await compare_faces(
            {
                "referenceImageBase64": reference_image,
                "liveImageBase64": selfie,
                "threshold": threshold,
            }
        )
        return {
            "bvn": bvn,
            "match": comparison["match"],
            "confidence": comparison["confidence"],
            "threshold": comparison["threshold"],
        }

    def persist_result(
        self,
        subject: VerificationSubject,
        result: Mapping[str, Any],
    ) -> int:
        """Insert or update the subject's pending manual BVN submission."""
        subject = require_subject(subject)
        bvn = result.get("bvn")
        if not isinstance(bvn, str) or re.fullmatch(r"[0-9]{11}", bvn) is None:
            raise ProviderError("Enter a valid 11-digit BVN", 400)
        values = {
            "user_id": subject.user_id,
            "identifier": subject.kyc_identifier,
            "bvn": bvn,
            "first_name": optional_text(result.get("firstName")),
            "middle_name": optional_text(result.get("middleName")),
            "last_name": optional_text(result.get("lastName")),
        }
        with get_engine(self._engine).begin() as connection:
            existing = connection.execute(
                text(
                    'SELECT "kycBvnId","status" FROM "kycBvn" WHERE "userId"=:user_id '
                    'AND "kycIdentifier"=:identifier ORDER BY "createdAt" DESC LIMIT 1'
                ),
                values,
            ).mappings().first()
            if existing is not None and existing["status"] in {
                "approved",
                "pending",
                "submitted",
            }:
                raise ProviderError("BVN cannot be changed while approved or under review", 409)
            if existing is None:
                record_id = connection.execute(
                    text(
                        'INSERT INTO "kycBvn" ("userId","kycIdentifier","bvn",'
                        '"firstName","middleName","lastName","provider","status") '
                        "VALUES (:user_id,:identifier,:bvn,:first_name,:middle_name,"
                        ":last_name,'manual','pending') RETURNING \"kycBvnId\""
                    ),
                    values,
                ).scalar_one()
            else:
                record_id = existing["kycBvnId"]
                connection.execute(
                    text(
                        'UPDATE "kycBvn" SET "bvn"=:bvn,"firstName"=:first_name,'
                        '"middleName"=:middle_name,"lastName"=:last_name,'
                        '"provider"=\'manual\',"status"=\'pending\',"verifiedAt"=NULL,'
                        '"updatedAt"=CURRENT_TIMESTAMP WHERE "kycBvnId"=:record_id'
                    ),
                    {**values, "record_id": record_id},
                )
        return int(record_id)
