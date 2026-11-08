from datetime import UTC, datetime
from io import BytesIO

import pytest
from fastapi import HTTPException
from openpyxl import load_workbook

from app.api.v1.transactions.routes import (
    _build_monthly_analysis,
    _generate_statement_export,
    _parse_query_date,
    statement_file_name,
    statement_mime_type,
)


def test_monthly_analysis_classifies_transactions_and_preserves_totals() -> None:
    analysis = _build_monthly_analysis(
        [
            {
                "type": "Airtime",
                "serviceName": "Mobile",
                "narration": None,
                "amount": 100,
                "direction": "debit",
            },
            {
                "type": "Reward",
                "serviceName": "Cashback reward",
                "narration": None,
                "amount": 25,
                "direction": "credit",
            },
            {
                "type": "Uncategorized",
                "serviceName": "Other",
                "narration": None,
                "amount": 20,
                "direction": "debit",
            },
        ],
        "TEST",
    )

    data = analysis["data"]
    assert data["wallet"] == {"type": "MAIN", "environment": "TEST"}
    assert data["expenses"]["totalAmount"] == 120
    assert data["expenses"]["bills"]["items"]["airtime"]["transactionCount"] == 1
    assert data["income"]["rewards"]["totalAmount"] == 25
    assert data["summary"] == {
        "transactionCount": 3,
        "classifiedExpenseCount": 1,
        "classifiedIncomeCount": 1,
    }


def test_statement_exports_csv_xlsx_and_pdf() -> None:
    transactions = [
        {
            "createdAt": datetime(2026, 1, 2, tzinfo=UTC),
            "reference": "=HYPERLINK('https://invalid')",
            "serviceName": "Airtime",
            "amount": 12.5,
            "currency": "NGN",
            "direction": "debit",
            "status": "successful",
        }
    ]

    csv_content = _generate_statement_export(
        "Ada", "2026-01-01", "2026-01-31", transactions, "csv"
    )
    assert b"'=HYPERLINK" in csv_content

    xlsx_content = _generate_statement_export(
        "Ada", "2026-01-01", "2026-01-31", transactions, "xlsx"
    )
    workbook = load_workbook(BytesIO(xlsx_content), data_only=False)
    sheet = workbook["Statement"]
    assert sheet["B2"].value.startswith("'=")
    assert sheet["D2"].value == 12.5

    pdf_content = _generate_statement_export(
        "Ada", "2026-01-01", "2026-01-31", transactions, "pdf"
    )
    assert pdf_content.startswith(b"%PDF")


def test_statement_metadata_and_query_date_validation() -> None:
    assert statement_file_name("2026-01-01", "2026-01-31", "csv") == (
        "Account_Statement_2026-01-01_2026-01-31.csv"
    )
    assert statement_mime_type("xlsx").startswith(
        "application/vnd.openxmlformats-officedocument"
    )
    assert _parse_query_date("2026-02-28").isoformat() == "2026-02-28"
    with pytest.raises(HTTPException) as error:
        _parse_query_date("2026-02-30", "weekStart")
    assert error.value.status_code == 400
