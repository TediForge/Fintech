"""Document-generation services."""

from typing import Literal

from app.services.document.csv import generate_csv_buffer
from app.services.document.pdf import generate_pdf_buffer
from app.services.document.xlsx import generate_xlsx_buffer

DocumentFormat = Literal["pdf", "csv", "xlsx"]
SUPPORTED_DOCUMENT_FORMATS: tuple[DocumentFormat, ...] = ("pdf", "csv", "xlsx")

__all__ = [
    "DocumentFormat",
    "SUPPORTED_DOCUMENT_FORMATS",
    "generate_csv_buffer",
    "generate_pdf_buffer",
    "generate_xlsx_buffer",
]
