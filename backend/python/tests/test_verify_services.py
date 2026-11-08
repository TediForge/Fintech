import asyncio
import json

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.providers.types import ProviderError
from app.services.verify.base import VerificationSubject
from app.services.verify.ng.address.service import AddressVerifyService
from app.services.verify.ng.business import service as business_module
from app.services.verify.ng.business.service import BusinessVerifyService
from app.services.verify.ng.bvn.service import BvnVerifyService
from app.services.verify.ng.income.service import IncomeVerifyService
from app.services.verify.ng.nin import service as nin_module
from app.services.verify.ng.nin.service import NinVerifyService


@pytest.fixture
def db_engine() -> Engine:
    engine = create_engine("sqlite://")
    ddl = [
        """
        CREATE TABLE "complianceFiles" (
            "fileId" INTEGER PRIMARY KEY AUTOINCREMENT,
            "userId" INTEGER NOT NULL,
            "kycIdentifier" TEXT NOT NULL,
            "recordType" TEXT NOT NULL,
            "fieldName" TEXT NOT NULL,
            "fileName" TEXT NOT NULL,
            "mimeType" TEXT NOT NULL,
            "fileSize" INTEGER NOT NULL,
            "fileData" BLOB NOT NULL,
            "sha256" TEXT NOT NULL,
            "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE "kycNin" (
            "kycNinId" INTEGER PRIMARY KEY AUTOINCREMENT,
            "userId" INTEGER NOT NULL,
            "kycIdentifier" TEXT NOT NULL,
            "nin" TEXT NOT NULL,
            "firstName" TEXT,
            "middleName" TEXT,
            "lastName" TEXT,
            "gender" TEXT,
            "dateOfBirth" TEXT,
            "phoneNumber" TEXT,
            "address" TEXT,
            "provider" TEXT,
            "status" TEXT NOT NULL,
            "verifiedAt" TEXT,
            "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "verificationProvider" TEXT,
            "verificationReference" TEXT,
            "taxId" TEXT,
            "taxResidency" TEXT,
            "officialPhotoFileId" INTEGER
        )
        """,
        """
        CREATE TABLE "kycBvn" (
            "kycBvnId" INTEGER PRIMARY KEY AUTOINCREMENT,
            "userId" INTEGER NOT NULL,
            "kycIdentifier" TEXT NOT NULL,
            "bvn" TEXT NOT NULL,
            "firstName" TEXT,
            "middleName" TEXT,
            "lastName" TEXT,
            "provider" TEXT,
            "status" TEXT NOT NULL,
            "verifiedAt" TEXT,
            "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE "kycAddress" (
            "kycAddressId" INTEGER PRIMARY KEY AUTOINCREMENT,
            "userId" INTEGER NOT NULL,
            "kycIdentifier" TEXT NOT NULL,
            "line1" TEXT,
            "lga" TEXT,
            "state" TEXT,
            "postalCode" TEXT,
            "country" TEXT,
            "status" TEXT NOT NULL,
            "verificationDocumentType" TEXT,
            "verifiedAt" TEXT,
            "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "verificationDocumentFileId" INTEGER
        )
        """,
        """
        CREATE TABLE "kycBusiness" (
            "kycBusinessId" INTEGER PRIMARY KEY AUTOINCREMENT,
            "userId" INTEGER NOT NULL,
            "kycIdentifier" TEXT NOT NULL,
            "companyName" TEXT,
            "companyNumber" TEXT,
            "status" TEXT NOT NULL,
            "verifiedAt" TEXT,
            "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "entityType" TEXT,
            "taxProfile" TEXT,
            "taxId" TEXT,
            "companyRegistrationDate" TEXT,
            "companyId" TEXT,
            "classificationName" TEXT,
            "classificationId" TEXT,
            "natureOfBusiness" TEXT,
            "providerReference" TEXT
        )
        """,
        """
        CREATE TABLE "kycBusinessDocuments" (
            "businessDocumentId" INTEGER PRIMARY KEY AUTOINCREMENT,
            "kycBusinessId" INTEGER NOT NULL,
            "documentType" TEXT NOT NULL,
            "fileId" INTEGER NOT NULL,
            "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE ("kycBusinessId","documentType")
        )
        """,
        """
        CREATE TABLE "kycBusinessKeyPersons" (
            "keyPersonId" INTEGER PRIMARY KEY AUTOINCREMENT,
            "kycBusinessId" INTEGER NOT NULL,
            "role" TEXT NOT NULL,
            "fullName" TEXT NOT NULL,
            "dateOfBirth" TEXT NOT NULL,
            "phoneNumber" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "identificationType" TEXT NOT NULL,
            "identificationFileId" INTEGER NOT NULL,
            "personData" TEXT NOT NULL,
            "migrationKey" TEXT,
            "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE "kycIncome" (
            "kycIncomeId" INTEGER PRIMARY KEY AUTOINCREMENT,
            "userId" INTEGER NOT NULL,
            "kycIdentifier" TEXT NOT NULL,
            "occupation" TEXT,
            "sourceOfFunds" TEXT,
            "incomeCurrency" TEXT,
            "incomeRange" TEXT,
            "documents" TEXT,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "verifiedAt" TEXT,
            "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ]
    with engine.begin() as connection:
        for statement in ddl:
            connection.execute(text(statement))
    yield engine
    engine.dispose()


@pytest.fixture
def subject() -> VerificationSubject:
    return VerificationSubject(user_id=7, kyc_identifier="kyc-7")


def test_nin_falls_back_to_accord_enriches_and_persists(
    db_engine: Engine,
    subject: VerificationSubject,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def supabase(_nin: str) -> dict:
        raise ProviderError("Supabase is unavailable")

    async def accord(_nin: str) -> dict:
        return {
            "success": True,
            "data": {
                "firstName": "Ada",
                "lastName": "Okafor",
                "dateOfBirth": "1990-01-02",
            },
        }

    async def tax(*_args: str) -> dict:
        return {"taxId": "TIN-7", "taxResidency": "NG"}

    monkeypatch.setattr(nin_module, "verify_nin_with_supabase", supabase)
    monkeypatch.setattr(nin_module, "verify_nin_with_accord", accord)
    monkeypatch.setattr(nin_module, "resolve_tax_id_for_nin", tax)

    result = asyncio.run(
        NinVerifyService(db_engine).verify(
            "12345678901",
            subject=subject,
        )
    )

    assert result["provider"] == "accord"
    assert result["status"] == "awaitingUser"
    assert result["identity"]["taxId"] == "TIN-7"
    assert result["recordId"] == 1
    assert NinVerifyService(db_engine).get_status(result["reference"])["status"] == "awaitingUser"


def test_bvn_is_stored_for_review_not_treated_as_verified(
    db_engine: Engine,
    subject: VerificationSubject,
) -> None:
    service = BvnVerifyService(db_engine)
    result = asyncio.run(
        service.verify("12345678901", "Ada", "Okafor", subject=subject)
    )

    assert result["status"] == "pending"
    with db_engine.connect() as connection:
        row = connection.execute(
            text('SELECT "provider","status" FROM "kycBvn" WHERE "kycBvnId"=1')
        ).one()
    assert row == ("manual", "pending")
    with pytest.raises(ProviderError, match="cannot be changed"):
        service.persist_result(subject, result)


def test_address_stores_legacy_document_submission(
    db_engine: Engine,
    subject: VerificationSubject,
) -> None:
    result = asyncio.run(
        AddressVerifyService(db_engine).verify(
            {
                "address": {
                    "line1": "1 Main Street",
                    "lga": "Ikeja",
                    "state": "Lagos",
                    "country": "Nigeria",
                },
                "addressVerification": {
                    "documentType": "utilityBill",
                    "documentFile": "data:application/pdf;base64,JVBERg==",
                    "fileName": "bill.pdf",
                },
            },
            subject=subject,
        )
    )

    assert result["status"] == "pending"
    with db_engine.connect() as connection:
        file_row = connection.execute(
            text('SELECT "fileName","fileData" FROM "complianceFiles"')
        ).one()
        address = connection.execute(
            text(
                'SELECT "verificationDocumentType","verificationDocumentFileId" '
                'FROM "kycAddress"'
            )
        ).one()
    assert file_row == ("bill.pdf", b"%PDF")
    assert address == ("utilityBill", 1)


def test_business_uses_cac_and_persists_active_company(
    db_engine: Engine,
    subject: VerificationSubject,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def cac(_rc_number: str) -> dict:
        return {
            "approvedName": "Tedi Limited",
            "rcNumber": "1234",
            "status": "ACTIVE",
            "companyId": "company-1",
            "providerReference": json.dumps(
                {"directors": [{"name": "Ada Okafor"}]}
            ),
        }

    monkeypatch.setattr(
        business_module,
        "fetch_business_details_by_registration_number",
        cac,
    )
    service = BusinessVerifyService(db_engine)
    result = asyncio.run(
        service.verify(
            "RC-1234",
            subject=subject,
            business_data={
                "entityType": "BUSINESS_NAME",
                "documents": {
                    "businessRegistrationCertificate": {
                        "file": "data:application/pdf;base64,JVBERg=="
                    },
                    "statusReport": {"file": "data:application/pdf;base64,JVBERg=="},
                },
                "keyPersons": [
                    {
                        "role": "Proprietor",
                        "identificationType": "NATIONAL_ID",
                        "fullName": "Ada Okafor",
                        "dateOfBirth": "1990-01-02",
                        "phoneNumber": "08000000000",
                        "email": "ada@example.com",
                        "identificationDocument": {
                            "file": "data:application/pdf;base64,JVBERg=="
                        },
                    }
                ],
            },
        )
    )

    assert result["recordId"] == 1
    assert result["status"] == "pending"
    assert asyncio.run(service.get_directors("1234")) == [{"name": "Ada Okafor"}]


def test_income_submission_stores_evidence_and_unavailable_provider_is_explicit(
    db_engine: Engine,
    subject: VerificationSubject,
) -> None:
    service = IncomeVerifyService(db_engine)
    record_id = service.submit_income(
        subject,
        {
            "occupation": "Engineer",
            "sourceOfFunds": "Salary",
            "incomeCurrency": "NGN",
            "incomeRange": "100000-200000",
            "documents": [
                {
                    "type": "bankStatement",
                    "data": "AQID",
                    "fileName": "statement.pdf",
                    "mimeType": "application/pdf",
                }
            ],
        },
    )

    assert record_id == 1
    with db_engine.connect() as connection:
        row = connection.execute(
            text('SELECT "status","documents" FROM "kycIncome"')
        ).one()
    assert row[0] == "pending"
    assert json.loads(row[1]) == [
        {"type": "bankStatement", "fileId": 1, "status": "pending"}
    ]
    with pytest.raises(ProviderError, match="no bank-statement provider"):
        asyncio.run(service.verify_from_statement("account-7"))
