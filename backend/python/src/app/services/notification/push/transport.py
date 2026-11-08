"""Firebase Cloud Messaging transport using deployment credentials."""

import asyncio
import json
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, messaging

from app.config import get_settings


class FcmTransport:
    """Send an FCM push message to a registered device token."""

    async def send(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Mapping[str, Any] | None = None,
    ) -> str:
        if not device_token.strip():
            raise ValueError("FCM device token is required")
        if not title.strip() or not body.strip():
            raise ValueError("FCM title and body are required")
        app = _firebase_app()
        message = messaging.Message(
            token=device_token,
            notification=messaging.Notification(title=title, body=body),
            data={
                key: value if isinstance(value, str) else json.dumps(value)
                for key, value in (data or {}).items()
            },
        )
        return await asyncio.to_thread(messaging.send, message, app=app)

    async def __call__(
        self, target: Mapping[str, Any], title: str, body: str
    ) -> bool:
        token = target.get("token")
        if not isinstance(token, str):
            raise TypeError("Push target has no device token")
        await self.send(token, title, body)
        return True


@lru_cache(maxsize=1)
def _firebase_app() -> firebase_admin.App:
    settings = get_settings()
    account = settings.fcm_service_account_json
    if account is None or not settings.fcm_project_id:
        raise RuntimeError(
            "FCM_SERVICE_ACCOUNT_JSON and FCM_PROJECT_ID must be configured"
        )
    credential_value = account.get_secret_value().strip()
    if not credential_value:
        raise RuntimeError("FCM service account credential is empty")
    if credential_value.startswith("{"):
        credential_data = json.loads(credential_value)
        credential = credentials.Certificate(credential_data)
    else:
        credential_path = Path(credential_value)
        if not credential_path.is_file():
            raise FileNotFoundError(
                f"FCM service account file does not exist: {credential_path}"
            )
        credential = credentials.Certificate(str(credential_path))
    try:
        return firebase_admin.get_app("tediforge-fcm")
    except ValueError:
        return firebase_admin.initialize_app(
            credential,
            {"projectId": settings.fcm_project_id},
            name="tediforge-fcm",
        )
