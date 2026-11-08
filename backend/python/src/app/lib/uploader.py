"""Reusable local file-upload and persisted-binary helpers."""

import asyncio
import base64
import ipaddress
import json
import os
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any, NotRequired, TypedDict

_MIME_TO_EXTENSIONS = {
    "application/pdf": ("pdf",),
    "image/jpeg": ("jpg", "jpeg"),
    "image/png": ("png",),
    "image/webp": ("webp",),
}
_DEFAULT_MAX_SIZE = 10 * 1024 * 1024
_BASE64_PATTERN = re.compile(r"^(?:data:([^;,]+);base64,)?([A-Za-z0-9+/]*={0,2})$")
_FOLDER_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


class UploadOptions(TypedDict, total=False):
    folder: str
    storage_path: str
    base_url: str
    max_size: int
    allowed_remote_hosts: list[str]
    original_name: str


class UploadResult(TypedDict):
    success: bool
    url: NotRequired[str]
    file_name: NotRequired[str]
    mime_type: NotRequired[str]
    size: NotRequired[int]
    source_type: NotRequired[str]
    binary: NotRequired[bytes]
    message: NotRequired[str]


async def upload_buffer(
    buffer: bytes | bytearray | memoryview,
    original_name: str,
    options: UploadOptions | None = None,
) -> UploadResult:
    return await asyncio.to_thread(_upload_buffer, bytes(buffer), original_name, options or {})


async def upload_local_file(
    file_path: str | os.PathLike[str],
    original_name: str,
    options: UploadOptions | None = None,
) -> UploadResult:
    try:
        data = await asyncio.to_thread(Path(file_path).read_bytes)
        _validate_size(len(data), _normalize_max_size((options or {}).get("max_size")))
        return await upload_buffer(data, original_name, options)
    except (OSError, ValueError) as error:
        return {"success": False, "message": str(error)}


async def write_binary_to_temporary_url(
    binary: bytes | bytearray | memoryview | str,
    options: UploadOptions | None = None,
) -> UploadResult:
    selected = dict(options or {})
    data = binary.encode() if isinstance(binary, str) else bytes(binary)
    return await upload_buffer(
        data,
        selected.get("original_name", "temporary-file"),
        {**selected, "folder": selected.get("folder", "temporary")},
    )


async def read_binary_from_url(
    url: str, options: UploadOptions | None = None
) -> bytes | None:
    try:
        return await asyncio.to_thread(_fetch_remote, url, options or {})
    except (OSError, ValueError, urllib.error.URLError):
        return None


async def upload_from_url(
    url: str, options: UploadOptions | None = None
) -> UploadResult:
    selected = options or {}
    try:
        data = await asyncio.to_thread(_fetch_remote, url, selected)
        name = Path(urllib.parse.urlsplit(url).path).name or "remote-file"
        return await upload_buffer(data, name, selected)
    except (OSError, ValueError, urllib.error.URLError) as error:
        return {"success": False, "message": str(error)}


async def upload_base64(
    encoded: str, options: UploadOptions | None = None
) -> UploadResult:
    selected = options or {}
    match = _BASE64_PATTERN.fullmatch(encoded.strip())
    if not match or not match.group(2):
        return {"success": False, "message": "Invalid base64 file data"}
    try:
        data = base64.b64decode(match.group(2), validate=True)
    except ValueError:
        return {"success": False, "message": "Invalid base64 file data"}
    if not data:
        return {"success": False, "message": "Uploaded file is empty"}
    mime_type = match.group(1) or _detect_mime_type(data)
    original_name = selected.get("original_name", _file_name_for_mime(mime_type))
    return await upload_buffer(data, original_name, selected)


async def upload_from_payload(
    payload: dict[str, Any], options: UploadOptions | None = None
) -> UploadResult:
    file_value = payload.get("file", payload.get("image", payload.get("attachment")))
    url = payload.get("url")
    encoded = payload.get("base64")
    if isinstance(url, str) and url.strip():
        return await upload_from_url(url, options)
    if isinstance(encoded, str) and encoded.strip():
        return await upload_base64(encoded, options)
    file_data = _upload_file_data(file_value)
    if file_data is not None:
        data, filename = file_data
        return await upload_buffer(data, filename, options)
    if isinstance(file_value, str):
        if file_value.lower().startswith("https://"):
            return await upload_from_url(file_value, options)
        if _BASE64_PATTERN.fullmatch(file_value.strip()):
            return await upload_base64(file_value, options)
    return {"success": False, "message": "No valid file input was supplied"}


async def resolve_stored_media_url(
    url: str | None = None,
    blob: bytes | str | None = None,
    options: UploadOptions | None = None,
) -> str | None:
    if not blob:
        return url.strip() or None if url else None
    result = await write_binary_to_temporary_url(blob, options)
    return result.get("url") if result["success"] else None


async def prepare_persisted_binary(
    source: Any, options: UploadOptions | None = None
) -> UploadResult:
    selected = options or {}
    source_type: str
    if isinstance(source, (bytes, bytearray, memoryview)):
        source_type = "file"
        data = bytes(source)
        name = selected.get("original_name", _file_name_for_mime(_detect_mime_type(data)))
        uploaded = await upload_buffer(data, name, selected)
    elif (file_data := _upload_file_data(source)) is not None:
        source_type = "file"
        data, name = file_data
        uploaded = await upload_buffer(data, name, selected)
    elif isinstance(source, str) and source.strip().lower().startswith("https://"):
        source_type = "url"
        uploaded = await upload_from_url(source.strip(), selected)
    elif isinstance(source, str) and source.strip():
        source_type = "base64"
        uploaded = await upload_base64(source.strip(), selected)
    else:
        return {
            "success": False,
            "message": "Unable to persist upload payload as binary",
        }

    uploaded["source_type"] = source_type
    file_name = uploaded.get("file_name")
    if not uploaded["success"] or not file_name:
        return uploaded
    root = _storage_root(selected)
    folder = _normalize_folder(selected.get("folder", "general"))
    stored_path = (root / folder / file_name).resolve()
    if not _is_within(root, stored_path):
        return {
            "success": False,
            "message": "Stored file path is invalid",
            "url": uploaded.get("url", ""),
            "source_type": source_type,
        }
    try:
        uploaded["binary"] = await asyncio.to_thread(stored_path.read_bytes)
    except OSError as error:
        return {
            "success": False,
            "message": str(error),
            "url": uploaded.get("url", ""),
            "source_type": source_type,
        }
    return uploaded


def encode_binary_for_storage(binary: Any) -> bytes | str:
    if isinstance(binary, list):
        encoded = [base64.b64encode(str(item).encode()).decode("ascii") for item in binary]
        return json.dumps(encoded)
    if isinstance(binary, bytes):
        return binary
    if isinstance(binary, (bytearray, memoryview)):
        return bytes(binary)
    return binary if isinstance(binary, str) else ""


async def fix_uploaded_files_permissions(
    storage_path: str | os.PathLike[str] | None = None,
    folders: list[str] | None = None,
    mode: int = 0o644,
) -> dict[str, Any]:
    root = _storage_root({"storage_path": str(storage_path)} if storage_path else {})
    starts = [
        (root / _normalize_folder(folder)).resolve()
        for folder in folders
    ] if folders else [root]
    result: dict[str, Any] = {"fixed": 0, "failed": 0, "errors": []}

    for start in starts:
        if not _is_within(root, start):
            result["failed"] += 1
            result["errors"].append({"file": str(start), "error": "path_outside_storage"})
            continue
        try:
            files = await asyncio.to_thread(
                lambda directory=start: [
                    path for path in directory.rglob("*") if path.is_file()
                ]
            )
        except OSError:
            result["failed"] += 1
            result["errors"].append(
                {"file": str(start), "error": "directory_unavailable"}
            )
            continue
        for file_path in files:
            try:
                await asyncio.to_thread(os.chmod, file_path, mode)
                result["fixed"] += 1
            except OSError:
                result["failed"] += 1
                result["errors"].append(
                    {"file": str(file_path), "error": "chmod_failed"}
                )
    return result


def _upload_buffer(
    data: bytes, original_name: str, options: UploadOptions
) -> UploadResult:
    try:
        max_size = _normalize_max_size(options.get("max_size"))
        _validate_size(len(data), max_size)
        mime_type = _detect_mime_type(data)
        extension = _resolve_extension(mime_type, original_name)
        folder = _normalize_folder(options.get("folder", "general"))
        root = _storage_root(options)
        target_folder = (root / folder).resolve()
        if not _is_within(root, target_folder):
            raise ValueError("Upload folder is invalid")
        target_folder.mkdir(parents=True, exist_ok=True, mode=0o750)
        file_name = f"{uuid.uuid4().hex}.{extension}"
        target = target_folder / file_name
        with target.open("xb") as file:
            file.write(data)
        os.chmod(target, 0o644)
        base_url = _normalize_base_url(
            options.get("base_url")
            or os.getenv("uploadBaseUrl")
            or os.getenv("UPLOAD_BASE_URL")
            or "https://api.paysmart.com.ng/uploads"
        )
        relative_folder = "/".join(
            urllib.parse.quote(part, safe="") for part in folder.split("/")
        )
        return {
            "success": True,
            "url": f"{base_url}/{relative_folder}/{file_name}",
            "file_name": file_name,
            "mime_type": mime_type,
            "size": len(data),
        }
    except (OSError, ValueError) as error:
        return {"success": False, "message": str(error)}


def _fetch_remote(source: str, options: UploadOptions) -> bytes:
    allowed_hosts = options.get("allowed_remote_hosts")
    if allowed_hosts is None:
        allowed_hosts = [
            item.strip()
            for item in (
                os.getenv("uploadRemoteAllowedHosts")
                or os.getenv("UPLOAD_REMOTE_ALLOWED_HOSTS")
                or ""
            ).split(",")
            if item.strip()
        ]
    allowed = {host.lower() for host in allowed_hosts}
    url = urllib.parse.urlsplit(source)
    for redirect_count in range(4):
        _validate_remote_url(url, allowed)
        request = urllib.request.Request(
            urllib.parse.urlunsplit(url),
            headers={"User-Agent": "TediwaveUploader/1.0"},
        )
        opener = urllib.request.build_opener(_NoRedirect())
        try:
            response = opener.open(request, timeout=20)
        except urllib.error.HTTPError as error:
            if error.code not in {301, 302, 303, 307, 308}:
                raise ValueError("Unable to fetch the remote file") from error
            location = error.headers.get("Location")
            if not location or redirect_count == 3:
                raise ValueError("Remote file redirect limit exceeded") from error
            url = urllib.parse.urlsplit(
                urllib.parse.urljoin(urllib.parse.urlunsplit(url), location)
            )
            continue
        with response:
            if response.status < 200 or response.status >= 300:
                raise ValueError("Unable to fetch the remote file")
            max_size = _normalize_max_size(options.get("max_size"))
            chunks: list[bytes] = []
            total = 0
            while chunk := response.read(min(64 * 1024, max_size + 1 - total)):
                total += len(chunk)
                if total > max_size:
                    raise ValueError("File size exceeds the maximum allowed limit")
                chunks.append(chunk)
            _validate_size(total, max_size)
            return b"".join(chunks)
    raise ValueError("Unable to fetch the remote file")


def _validate_remote_url(
    url: urllib.parse.SplitResult, allowed_hosts: set[str]
) -> None:
    if (
        url.scheme.lower() != "https"
        or not url.hostname
        or url.username
        or url.password
    ):
        raise ValueError("Remote upload URL must be a safe HTTPS URL")
    hostname = url.hostname.rstrip(".").lower()
    if not allowed_hosts or hostname not in allowed_hosts:
        raise ValueError("Remote upload host is not allowlisted")
    try:
        addresses = [ipaddress.ip_address(hostname)]
    except ValueError:
        try:
            addresses = [
                ipaddress.ip_address(item[4][0])
                for item in socket.getaddrinfo(
                    hostname, url.port or 443, type=socket.SOCK_STREAM
                )
            ]
        except (OSError, ValueError) as error:
            raise ValueError("Remote upload host could not be resolved") from error
    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Remote upload host resolves to a restricted address")


def _detect_mime_type(data: bytes) -> str:
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise ValueError("Invalid file type")


def _resolve_extension(mime_type: str, original_name: str) -> str:
    allowed = _MIME_TO_EXTENSIONS.get(mime_type)
    if allowed is None:
        raise ValueError("Invalid file type")
    supplied = Path(original_name).suffix.removeprefix(".").lower()
    if supplied and supplied not in allowed:
        raise ValueError("Invalid file extension")
    return supplied or allowed[0]


def _normalize_folder(folder: str) -> str:
    pieces = [piece for piece in folder.strip().replace("\\", "/").split("/") if piece]
    if not pieces or any(
        piece in {".", ".."} or not _FOLDER_PATTERN.fullmatch(piece)
        for piece in pieces
    ):
        raise ValueError("Upload folder is invalid")
    return "/".join(pieces)


def _normalize_base_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value.strip())
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Upload base URL is invalid")
    path = re.sub(r"/v1(?=/uploads(?:/|$)|$)", "", parsed.path, flags=re.IGNORECASE)
    path = path.rstrip("/")
    if not path.endswith("/uploads"):
        path += "/uploads"
    return urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, path, "", "")
    ).rstrip("/")


def _normalize_max_size(value: int | None) -> int:
    max_size = _DEFAULT_MAX_SIZE if value is None else value
    if isinstance(max_size, bool) or not isinstance(max_size, int) or max_size < 1:
        raise ValueError("max_size must be a positive integer")
    return max_size


def _validate_size(size: int, max_size: int) -> None:
    if size <= 0:
        raise ValueError("Uploaded file is empty")
    if size > max_size:
        raise ValueError("File size exceeds the maximum allowed limit")


def _storage_root(options: UploadOptions) -> Path:
    path = (
        options.get("storage_path")
        or os.getenv("uploadStoragePath")
        or os.getenv("UPLOAD_STORAGE_PATH")
        or str(Path.cwd() / "uploads")
    )
    return Path(path).resolve()


def _is_within(root: Path, target: Path) -> bool:
    try:
        target.relative_to(root)
        return True
    except ValueError:
        return False


def _file_name_for_mime(mime_type: str) -> str:
    extensions = _MIME_TO_EXTENSIONS.get(mime_type, ())
    return f"upload.{extensions[0] if extensions else 'bin'}"


def _upload_file_data(value: Any) -> tuple[bytes, str] | None:
    if isinstance(value, dict):
        data = value.get("buffer")
        name = value.get("originalname", value.get("name", "upload"))
    else:
        data = getattr(value, "buffer", None)
        name = getattr(value, "filename", getattr(value, "name", "upload"))
        if data is None and hasattr(value, "file"):
            file_obj = value.file
            if hasattr(file_obj, "read"):
                data = file_obj.read()
                value.file.seek(0)
    if isinstance(data, (bytes, bytearray, memoryview)):
        return bytes(data), str(name or "upload")
    return None


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None
