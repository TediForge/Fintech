"""Authenticated user profile retrieval and editable profile fields."""

import asyncio
import base64
import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from starlette.datastructures import UploadFile

from app.api.deps import require_user
from database.db_01.connection import get_database_engine
from app.lib.uploader import prepare_persisted_binary

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]
_MAX_AVATAR_SIZE = 5 * 1024 * 1024
_KYC_MANAGED_FIELDS = {
    "firstName",
    "middleName",
    "lastName",
    "fullName",
    "dateOfBirth",
    "gender",
    "countryCode",
    "kycLevel",
    "kycStatus",
    "nin",
    "bvn",
    "address",
    "income",
    "business",
    "isEmailVerified",
    "isPhoneVerified",
}


@router.get("/profile")
async def get_profile(auth: AuthenticatedUser) -> dict[str, Any]:
    profile = await asyncio.to_thread(_load_profile, auth["user_id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="User account not found")
    return {
        "success": True,
        "status": 200,
        "message": "Profile retrieved successfully",
        "data": {"profile": _present_profile(profile)},
    }


@router.patch("/profile")
async def update_profile(
    request: Request,
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    if request.headers.get("content-type", "").startswith("multipart/form-data"):
        form = await request.form(
            max_files=1, max_fields=5, max_part_size=_MAX_AVATAR_SIZE + 1
        )
    elif request.headers.get("content-type", "").startswith("application/json"):
        try:
            form = await request.json()
        except ValueError as error:
            raise HTTPException(
                status_code=400, detail="Profile update payload is invalid"
            ) from error
        if not isinstance(form, dict):
            raise HTTPException(
                status_code=400, detail="Profile update payload is invalid"
            )
    else:
        raise HTTPException(status_code=400, detail="Profile update payload is invalid")
    field = form.get("field")
    if not isinstance(field, str):
        raise HTTPException(status_code=400, detail="Profile update payload is invalid")
    if field in _KYC_MANAGED_FIELDS:
        raise HTTPException(
            status_code=403,
            detail="This field is managed by KYC and cannot be updated here",
        )
    allowed_fields = {
        "email": {"field", "email"},
        "phone": {"field", "phoneNumber"},
        "username": {"field", "username"},
        "avatar": {"field", "avatarUri"},
    }
    if field not in allowed_fields or set(form.keys()) - allowed_fields[field]:
        raise HTTPException(status_code=400, detail="Profile update payload is invalid")
    user_id = auth["user_id"]
    if field == "avatar":
        avatar = form.get("avatarUri")
        if not isinstance(avatar, UploadFile):
            raise HTTPException(status_code=400, detail="Avatar file is required")
        content = await avatar.read(_MAX_AVATAR_SIZE + 1)
        if len(content) > _MAX_AVATAR_SIZE:
            raise HTTPException(
                status_code=400, detail="Avatar image must not exceed 5 MB"
            )
        mime_type = _detect_avatar_mime(content)
        if mime_type is None:
            raise HTTPException(
                status_code=400,
                detail="A valid PNG, JPEG, or WebP image is required",
            )
        stored = await prepare_persisted_binary(
            content,
            {
                "folder": "profile_photos",
                "max_size": _MAX_AVATAR_SIZE,
                "original_name": f"avatar.{mime_type.split('/')[-1]}",
            },
        )
        binary = stored.get("binary")
        if not stored.get("success") or not isinstance(binary, bytes):
            raise HTTPException(status_code=500, detail="Image upload failed")
        await asyncio.to_thread(_save_avatar, user_id, binary)
        return {
            "success": True,
            "status": 200,
            "message": "Profile updated successfully",
            "data": {
                "field": field,
                "profile": {"avatarUrl": _avatar_data_url(binary)},
            },
        }

    if field == "email":
        email = _text_value(form.get("email"))
        if not email or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise HTTPException(
                status_code=400, detail="Profile update payload is invalid"
            )
        value = email.lower()
        statement = (
            'UPDATE "users" SET "email" = :value, "isEmailVerified" = FALSE '
            'WHERE "userId" = :user_id'
        )
        duplicate_query = (
            'SELECT 1 FROM "users" WHERE LOWER("email") = LOWER(:value) '
            'AND "userId" <> :user_id LIMIT 1'
        )
    elif field == "phone":
        phone_number = _text_value(form.get("phoneNumber"))
        if not phone_number or not re.fullmatch(r"\+?[0-9]{10,15}", phone_number):
            raise HTTPException(
                status_code=400, detail="Profile update payload is invalid"
            )
        value = phone_number
        statement = (
            'UPDATE "users" SET "phoneNumber" = :value, "isPhoneVerified" = FALSE '
            'WHERE "userId" = :user_id'
        )
        duplicate_query = """SELECT 1 FROM "users"
               WHERE REGEXP_REPLACE("phoneNumber", '[^0-9+]', '', 'g') = :value
                 AND "userId" <> :user_id LIMIT 1"""
    elif field == "username":
        username = _text_value(form.get("username"))
        if not username or not re.fullmatch(r"@?[A-Za-z0-9_]{3,30}", username):
            raise HTTPException(
                status_code=400, detail="Profile update payload is invalid"
            )
        value = username.removeprefix("@").lower()
        statement = 'UPDATE "users" SET "username" = :value WHERE "userId" = :user_id'
        duplicate_query = (
            'SELECT 1 FROM "users" WHERE LOWER("username") = LOWER(:value) '
            'AND "userId" <> :user_id LIMIT 1'
        )
    else:
        raise HTTPException(status_code=400, detail="Profile update payload is invalid")

    try:
        await asyncio.to_thread(
            _update_profile_field, duplicate_query, statement, value, user_id
        )
    except ProfileConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    profile = await asyncio.to_thread(_load_profile, user_id)
    return {
        "success": True,
        "status": 200,
        "message": "Profile updated successfully",
        "data": {
            "field": field,
            "profile": _present_profile(profile) if profile is not None else None,
        },
    }


class ProfileConflict(Exception):
    """Raised when a profile value is already owned by another user."""


def _load_profile(user_id: int) -> dict[str, Any] | None:
    with get_database_engine().connect() as connection:
        row = (
            connection.execute(
                text(
                    """
                SELECT "userId", "firstName", "middleName", "lastName", "fullName",
                       "username", "phoneNumber", "email", "isEmailVerified",
                       "isPhoneVerified", "dateOfBirth", "gender", "countryCode",
                       "yesterdaysEarnings", "todaysEarnings", "status", "createdAt",
                       "twoFactorAuth", "kycLevel", "avatarBlob"
                FROM "users" WHERE "userId" = :user_id LIMIT 1
                """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .first()
        )
        return dict(row) if row is not None else None


def _update_profile_field(
    duplicate_query: str, statement: str, value: str, user_id: int
) -> None:
    parameters = {"value": value, "user_id": user_id}
    try:
        with get_database_engine().begin() as connection:
            duplicate = connection.execute(text(duplicate_query), parameters).first()
            if duplicate:
                raise ProfileConflict(_conflict_message(duplicate_query))
            connection.execute(text(statement), parameters)
    except IntegrityError as error:
        raise ProfileConflict(_conflict_message(duplicate_query)) from error


def _conflict_message(duplicate_query: str) -> str:
    if '"email"' in duplicate_query:
        return "Email address is already in use"
    if '"phoneNumber"' in duplicate_query:
        return "Phone number is already in use"
    return "Username is already in use"


def _save_avatar(user_id: int, binary: bytes) -> None:
    with get_database_engine().begin() as connection:
        connection.execute(
            text('UPDATE "users" SET "avatarBlob" = :binary WHERE "userId" = :user_id'),
            {"binary": binary, "user_id": user_id},
        )


def _present_profile(profile: dict[str, Any]) -> dict[str, Any]:
    fields = {key: value for key, value in profile.items() if key != "avatarBlob"}
    fields["avatarUrl"] = _avatar_data_url(profile.get("avatarBlob"))
    return fields


def _avatar_data_url(value: Any) -> str | None:
    if not isinstance(value, (bytes, bytearray, memoryview)):
        return None
    binary = bytes(value)
    mime_type = _detect_avatar_mime(binary)
    if mime_type is None:
        return None
    encoded = base64.b64encode(binary).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _detect_avatar_mime(content: bytes) -> str | None:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def _text_value(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None
