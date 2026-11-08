"""CSV export generation for statement-style document payloads."""

import csv
import io
from collections.abc import Sequence
from typing import Any


def _csv_safe(value: Any) -> str:
    string_value = str(value)
    return (
        f"'{string_value}"
        if string_value.startswith(("=", "+", "@", "-"))
        else string_value
    )


def generate_csv_buffer(
    rows: Sequence[Sequence[Any]],
    headers: Sequence[str] | None = None,
) -> bytes:
    """Render rows to a UTF-8 CSV byte payload."""
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    if headers is not None:
        writer.writerow([_csv_safe(value) for value in headers])
    for row in rows:
        writer.writerow([_csv_safe(value) for value in row])
    return output.getvalue().encode("utf-8")
