"""Face++ face-comparison operations."""

import asyncio
import base64
import binascii
import json
import math
import re
import secrets
from dataclasses import dataclass
from functools import lru_cache
from typing import TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from app.providers.biometrics.facepp.credentials import (
    FacePPCredentials,
    load_facepp_credentials,
)
from app.providers.types import ProviderError

_BASE_URL = "https://api-us.faceplusplus.com/facepp/v3/compare"
_TIMEOUT_SECONDS = 60
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_DATA_URI_PATTERN = re.compile(r"^data:image/[a-z0-9.+-]+;base64,", re.IGNORECASE)


class FaceComparisonInput(TypedDict, total=False):
    referenceImageUrl: str
    liveImageUrl: str
    referenceImageBase64: str
    liveImageBase64: str
    threshold: float


class FaceComparisonResult(TypedDict):
    match: bool
    confidence: float
    threshold: float
    providerResponse: dict[str, object]


@dataclass(frozen=True)
class _ImageFile:
    name: str
    content: bytes


class FacePPClient:
    """Face++ client with credentials supplied by its owning provider module."""

    def __init__(self, credentials: FacePPCredentials | None = None) -> None:
        self._credentials = credentials

    async def compare_faces(
        self, input: FaceComparisonInput
    ) -> FaceComparisonResult:
        reference_url = _input_string(input, "referenceImageUrl")
        live_url = _input_string(input, "liveImageUrl")
        reference_base64 = _input_string(input, "referenceImageBase64")
        live_base64 = _input_string(input, "liveImageBase64")
        urls_provided = bool(reference_url and live_url)
        images_provided = bool(reference_base64 and live_base64)
        if not urls_provided and not images_provided:
            raise ProviderError("Both face images are required", 400)
        if urls_provided:
            _assert_https_url(reference_url)
            _assert_https_url(live_url)

        threshold_value = input.get("threshold")
        threshold = 75.0 if threshold_value is None else threshold_value
        if (
            isinstance(threshold, bool)
            or not isinstance(threshold, (int, float))
            or not math.isfinite(threshold)
            or threshold < 0
            or threshold > 100
        ):
            raise ProviderError("threshold must be between 0 and 100", 400)
        threshold = float(threshold)

        credentials = self._credentials or load_facepp_credentials()
        fields = {
            "api_key": credentials.api_key,
            "api_secret": credentials.secret_key,
        }
        files: dict[str, _ImageFile] = {}
        if urls_provided:
            fields["image_url1"] = reference_url
            fields["image_url2"] = live_url
        else:
            files["image_file1"] = _ImageFile(
                "reference.jpg", _decode_image(reference_base64)
            )
            files["image_file2"] = _ImageFile("live.jpg", _decode_image(live_base64))

        result = await asyncio.to_thread(_post_multipart, fields, files)
        if not isinstance(result, dict):
            raise ProviderError("Face verification provider returned an invalid response", 502)
        if isinstance(result.get("error_message"), str):
            raise ProviderError("Face verification provider failed", 502)
        try:
            confidence = float(result.get("confidence") or 0)
        except (TypeError, ValueError) as error:
            raise ProviderError("Face verification provider returned an invalid response", 502) from error
        if not math.isfinite(confidence):
            raise ProviderError("Face verification provider returned an invalid response", 502)
        return {
            "match": confidence >= threshold,
            "confidence": confidence,
            "threshold": threshold,
            "providerResponse": result,
        }


@lru_cache(maxsize=1)
def get_facepp_client() -> FacePPClient:
    """Return the shared Face++ adapter."""
    return FacePPClient()


async def compare_faces(input: FaceComparisonInput) -> FaceComparisonResult:
    return await get_facepp_client().compare_faces(input)


def _input_string(input: FaceComparisonInput, field: str) -> str:
    value = input.get(field)
    return value.strip() if isinstance(value, str) else ""


def _assert_https_url(value: str) -> None:
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ProviderError("Face image URLs must use HTTPS", 400)


def _decode_image(value: str) -> bytes:
    encoded = _DATA_URI_PATTERN.sub("", value)
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ProviderError(
            "Face image data must be valid and no larger than 10 MiB", 400
        ) from error
    if not decoded or len(decoded) > _MAX_IMAGE_BYTES:
        raise ProviderError(
            "Face image data must be valid and no larger than 10 MiB", 400
        )
    return decoded


def _post_multipart(
    fields: dict[str, str], files: dict[str, _ImageFile]
) -> dict[str, object]:
    boundary = f"----facepp-{secrets.token_hex(16)}"
    body = bytearray()
    for name, value in fields.items():
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
        )
        body.extend(value.encode())
        body.extend(b"\r\n")
    for name, image in files.items():
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(
            (
                f'Content-Disposition: form-data; name="{name}"; '
                f'filename="{image.name}"\r\n'
                "Content-Type: image/jpeg\r\n\r\n"
            ).encode()
        )
        body.extend(image.content)
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode())
    request = Request(
        _BASE_URL,
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            response_body = response.read()
            status = response.status
    except HTTPError as error:
        raise ProviderError("Face verification provider failed", 502) from error
    except (TimeoutError, URLError, OSError) as error:
        raise ProviderError("Face verification provider is unavailable", 502) from error
    if not 200 <= status < 300:
        raise ProviderError("Face verification provider failed", 502)
    try:
        result = json.loads(response_body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ProviderError(
            "Face verification provider returned an invalid response", 502
        ) from error
    if not isinstance(result, dict):
        raise ProviderError(
            "Face verification provider returned an invalid response", 502
        )
    return result
