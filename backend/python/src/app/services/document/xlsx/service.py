"""XLSX export generation for spreadsheet-style document payloads."""

import re
from collections.abc import Sequence
from io import BytesIO
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Font

_NUMERIC_VALUE = re.compile(r"^-?\d+(?:\.\d+)?$")


def _spreadsheet_safe(value: Any) -> str:
    string_value = str(value)
    if string_value.startswith(("=", "+", "-", "@")):
        return f"'{string_value}"
    return string_value


def _excel_cell_value(value: Any) -> Any:
    if isinstance(value, str):
        safe = _spreadsheet_safe(value)
        if _NUMERIC_VALUE.fullmatch(value.strip()):
            try:
                return float(value)
            except ValueError:
                return safe
        return safe
    return value


def generate_xlsx_buffer(
    rows: Sequence[Sequence[Any]],
    headers: Sequence[str] | None = None,
) -> bytes:
    """Render rows to a spreadsheet workbook byte payload."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Statement"
    if headers is not None:
        sheet.append([str(value) for value in headers])
        for cell in sheet[1]:
            cell.font = Font(bold=True)
    for row in rows:
        sheet.append([_excel_cell_value(value) for value in row])
    for column_index, width in enumerate(
        [24, 28, 30, 16, 12, 14, 16],
        start=1,
    ):
        if column_index <= sheet.max_column:
            sheet.column_dimensions[chr(64 + column_index)].width = width
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()
