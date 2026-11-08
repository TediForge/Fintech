import asyncio
import urllib.parse

import pytest

from app.lib.uploader import (
    _validate_remote_url,
    encode_binary_for_storage,
    upload_buffer,
)


def test_upload_buffer_persists_supported_file_and_returns_public_url(tmp_path) -> None:
    result = asyncio.run(
        upload_buffer(
            b"%PDF-1.7\nexample",
            "statement.pdf",
            {
                "storage_path": str(tmp_path),
                "base_url": "https://files.example.test/v1",
                "folder": "statements/2026",
            },
        )
    )

    assert result["success"] is True
    assert result["mime_type"] == "application/pdf"
    assert result["url"].startswith("https://files.example.test/uploads/statements/2026/")
    assert (tmp_path / "statements" / "2026" / result["file_name"]).read_bytes() == b"%PDF-1.7\nexample"


def test_upload_buffer_rejects_mismatched_extension(tmp_path) -> None:
    result = asyncio.run(
        upload_buffer(
            b"%PDF-1.7\nexample",
            "statement.png",
            {"storage_path": str(tmp_path)},
        )
    )

    assert result == {"success": False, "message": "Invalid file extension"}


def test_encode_binary_for_storage_preserves_bytes_and_array_shape() -> None:
    assert encode_binary_for_storage(b"\x00\xff") == b"\x00\xff"
    assert encode_binary_for_storage([1, 2]) == '["MQ==", "Mg=="]'


def test_remote_upload_requires_an_allowlisted_public_host() -> None:
    url = urllib.parse.urlsplit("https://127.0.0.1/image.png")

    with pytest.raises(ValueError, match="allowlisted"):
        _validate_remote_url(url, set())

