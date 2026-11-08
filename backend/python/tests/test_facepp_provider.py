import asyncio

import pytest

from app.providers.biometrics.facepp import FacePPClient, compare_faces
from app.providers.biometrics.facepp.credentials import (
    FacePPCredentials,
    load_facepp_credentials,
)
from app.providers.types import ProviderError


def test_compare_faces_uses_https_urls_and_threshold(monkeypatch) -> None:
    submitted = {}

    def fake_post(fields, files):
        submitted.update(fields=fields, files=files)
        return {"confidence": 81.5}

    monkeypatch.setattr(
        "app.providers.biometrics.facepp.client._post_multipart", fake_post
    )
    client = FacePPClient(FacePPCredentials("api-key", "secret-key"))

    result = asyncio.run(
        client.compare_faces(
            {
                "referenceImageUrl": "https://images.example/reference.jpg",
                "liveImageUrl": "https://images.example/live.jpg",
                "threshold": 80,
            }
        )
    )

    assert result == {
        "match": True,
        "confidence": 81.5,
        "threshold": 80.0,
        "providerResponse": {"confidence": 81.5},
    }
    assert submitted["fields"] == {
        "api_key": "api-key",
        "api_secret": "secret-key",
        "image_url1": "https://images.example/reference.jpg",
        "image_url2": "https://images.example/live.jpg",
    }
    assert submitted["files"] == {}


def test_compare_faces_sends_decoded_images(monkeypatch) -> None:
    submitted = {}
    monkeypatch.setattr(
        "app.providers.biometrics.facepp.client.load_facepp_credentials",
        lambda: FacePPCredentials("api-key", "secret-key"),
    )
    monkeypatch.setattr(
        "app.providers.biometrics.facepp.client._post_multipart",
        lambda fields, files: submitted.update(fields=fields, files=files)
        or {"confidence": 74},
    )

    result = asyncio.run(
        compare_faces(
            {
                "referenceImageBase64": "data:image/jpeg;base64,aGVsbG8=",
                "liveImageBase64": "d29ybGQ=",
            }
        )
    )

    assert result["match"] is False
    assert result["threshold"] == 75
    assert submitted["files"]["image_file1"].content == b"hello"
    assert submitted["files"]["image_file2"].content == b"world"


def test_compare_faces_rejects_non_https_urls_before_loading_credentials() -> None:
    client = FacePPClient(FacePPCredentials("api-key", "secret-key"))

    with pytest.raises(ProviderError, match="must use HTTPS") as error:
        asyncio.run(
            client.compare_faces(
                {
                    "referenceImageUrl": "http://images.example/reference.jpg",
                    "liveImageUrl": "https://images.example/live.jpg",
                }
            )
        )

    assert error.value.status == 400


def test_facepp_credentials_use_provider_owned_production_first_query(monkeypatch) -> None:
    statements = []

    class Result:
        def mappings(self):
            return self

        def first(self):
            return {"apiKey": "database-key", "secretKey": "database-secret"}

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def execute(self, statement):
            statements.append(str(statement))
            return Result()

    class Engine:
        def connect(self):
            return Connection()

    monkeypatch.setattr(
        "app.providers.biometrics.facepp.credentials.get_database_engine",
        lambda: Engine(),
    )

    credentials = load_facepp_credentials()

    assert credentials == FacePPCredentials("database-key", "database-secret")
    query = statements[0]
    assert '"service" = \'facepp\'' in query
    assert '"isActive" = TRUE' in query
    assert '"apiKey" <> \'\'' in query
    assert '"secretKey" <> \'\'' in query
    assert 'CASE WHEN "environment" = \'production\' THEN 0 ELSE 1 END' in query
