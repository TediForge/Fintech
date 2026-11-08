"""JWT authentication middleware shared by HTTP and WebSocket entry points."""

import asyncio
import logging
from typing import Any

import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.config import get_settings
from database.db_01.connection import get_database_engine

_LOGGER = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """Raised when an access token is validly decoded but cannot be authorized."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """Validate supplied bearer tokens and expose claims on request.state.auth."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        authorization = request.headers.get("authorization", "")
        if not authorization:
            return await call_next(request)
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            return JSONResponse(
                {"success": False, "message": "A bearer token is required"},
                status_code=401,
            )
        try:
            request.state.auth = await authenticate_access_token(token.strip())
        except AuthenticationError as error:
            return JSONResponse(
                {"success": False, "message": str(error)},
                status_code=error.status_code,
            )
        except Exception:
            _LOGGER.exception("Unable to validate access token")
            return JSONResponse(
                {"success": False, "message": "Authentication service is unavailable"},
                status_code=503,
            )
        return await call_next(request)


async def authenticate_access_token(token: str) -> dict[str, Any]:
    """Validate a signed JWT against the current account, device, and session."""
    secret = get_settings().jwt_secret
    if secret is None or not secret.get_secret_value().strip():
        raise AuthenticationError(503, "Authentication service is unavailable")
    try:
        claims = jwt.decode(
            token,
            secret.get_secret_value(),
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as error:
        raise AuthenticationError(401, "Bearer token is invalid or expired") from error

    user_id = _positive_integer(
        claims.get("sub", claims.get("userId", claims.get("user_id")))
    )
    environment = str(claims.get("mode", claims.get("environment", "LIVE"))).upper()
    role = claims.get("role")
    fingerprint = claims.get("deviceFingerprint")
    if (
        user_id is None
        or environment not in {"LIVE", "TEST"}
        or role not in {"user", "admin"}
        or not isinstance(fingerprint, str)
        or not fingerprint.strip()
    ):
        raise AuthenticationError(401, "Bearer token claims are invalid")

    return await asyncio.to_thread(
        _load_account,
        user_id,
        environment,
        str(role),
        fingerprint.strip(),
        token,
    )


def _load_account(
    user_id: int, environment: str, role: str, fingerprint: str, token: str
) -> dict[str, Any]:
    with get_database_engine().connect() as connection:
        if role == "admin":
            account = (
                connection.execute(
                    text(
                        """
                    SELECT "adminId", "status", "email", "adminPermissions"
                    FROM "admins" WHERE "adminId" = :user_id LIMIT 1
                    """
                    ),
                    {"user_id": user_id},
                )
                .mappings()
                .first()
            )
            if account is None:
                raise AuthenticationError(401, "Bearer token is invalid")
            if account["status"] != "active":
                raise AuthenticationError(403, "Account cannot perform this action")
            device = (
                connection.execute(
                    text(
                        """
                    SELECT "status" FROM "adminKnownDevices"
                    WHERE "adminId" = :user_id AND "fingerprint" = :fingerprint
                    LIMIT 1
                    """
                    ),
                    {"user_id": user_id, "fingerprint": fingerprint},
                )
                .mappings()
                .first()
            )
            account_id = account["adminId"]
            email = account["email"]
            phone_number = None
        else:
            account = (
                connection.execute(
                    text(
                        """
                    SELECT "userId", "status", "isPnd", "email", "phoneNumber"
                    FROM "users" WHERE "userId" = :user_id LIMIT 1
                    """
                    ),
                    {"user_id": user_id},
                )
                .mappings()
                .first()
            )
            if account is None:
                raise AuthenticationError(401, "Bearer token is invalid")
            if account["status"] != "active" or account["isPnd"]:
                raise AuthenticationError(403, "Account cannot perform this action")
            device = (
                connection.execute(
                    text(
                        """
                    SELECT "status" FROM "knownDevices"
                    WHERE "userId" = :user_id AND "fingerprint" = :fingerprint
                    LIMIT 1
                    """
                    ),
                    {"user_id": user_id, "fingerprint": fingerprint},
                )
                .mappings()
                .first()
            )
            account_id = account["userId"]
            email = account["email"]
            phone_number = account["phoneNumber"]

        if device is not None and device["status"] != "active":
            raise AuthenticationError(401, "This account device is revoked")
        session = connection.execute(
            text(
                """
                SELECT 1 FROM "authRefreshTokens"
                WHERE "accountType" = :role AND "accountId" = :user_id
                  AND "environment" = :environment
                  AND "fingerprint" = :fingerprint
                  AND "revokedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP
                LIMIT 1
                """
            ),
            {
                "role": role,
                "user_id": user_id,
                "environment": environment,
                "fingerprint": fingerprint,
            },
        ).first()
        if session is None:
            raise AuthenticationError(401, "Account session has been revoked")

    return {
        "user_id": int(account_id),
        "userId": int(account_id),
        "environment": environment,
        "role": role,
        "email": email,
        "phone_number": phone_number,
        "token": token,
        "device_fingerprint": fingerprint,
    }


def _positive_integer(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None
