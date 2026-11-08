"""User webhook delivery service and HMAC signature handling."""

import hashlib
import hmac
import ipaddress
import json
import socket
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, TypedDict

from sqlalchemy import text

from database.db_01.connection import get_database_engine


class WebhookDeliveryResult(TypedDict):
    sent: bool
    statusCode: int
    message: str


class WebhookSender:
    async def send(self, input: Mapping[str, Any]) -> WebhookDeliveryResult:
        return await send_user_webhook(
            input.get("userId"),
            input.get("environment"),
            input.get("event"),
            input.get("payload"),
        )


async def send_user_webhook(
    user_id: Any,
    environment: Any,
    event: Any,
    payload: Any,
) -> WebhookDeliveryResult:
    import asyncio

    return await asyncio.to_thread(
        _send_user_webhook, user_id, environment, event, payload
    )


def _send_user_webhook(
    user_id: Any,
    environment: Any,
    event: Any,
    payload: Any,
) -> WebhookDeliveryResult:
    if (
        isinstance(user_id, bool)
        or not isinstance(user_id, int)
        or user_id < 1
        or not isinstance(event, str)
        or not event.strip()
        or not isinstance(payload, Mapping)
        or environment not in {"LIVE", "TEST"}
    ):
        return {"sent": False, "statusCode": 0, "message": "Invalid webhook delivery input"}

    with get_database_engine().connect() as connection:
        row = connection.execute(
            text(
                """
                SELECT "id", "url", "secret"
                FROM "userWebhooks"
                WHERE "userId" = :user_id AND "environment" = :environment
                  AND "isActive" = TRUE
                LIMIT 1
                """
            ),
            {"user_id": user_id, "environment": environment},
        ).mappings().first()
    if row is None:
        return {"sent": False, "statusCode": 0, "message": "No active webhook configured"}

    body = json.dumps(
        {
            "event": event,
            "environment": environment,
            "occurredAt": datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "payload": dict(payload),
        },
        separators=(",", ":"),
        ensure_ascii=False,
    )
    signature = hmac.new(
        str(row["secret"]).encode(), body.encode(), hashlib.sha256
    ).hexdigest()
    status_code = 0
    try:
        url = validate_public_https_url(str(row["url"]))
        request = urllib.request.Request(
            url,
            data=body.encode(),
            method="POST",
            headers={
                "content-type": "application/json",
                "accept": "application/json",
                "x-paysmart-event": event,
                "x-paysmart-environment": environment,
                "x-paysmart-signature": f"sha256={signature}",
            },
        )
        opener = urllib.request.build_opener(_NoRedirect())
        with opener.open(request, timeout=10) as response:
            status_code = response.status
            if not 200 <= response.status < 300:
                raise urllib.error.HTTPError(
                    url, response.status, "Webhook returned non-success status", response.headers, None
                )
        with get_database_engine().begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE "userWebhooks"
                    SET "lastSuccessAt" = CURRENT_TIMESTAMP, "failureCount" = 0
                    WHERE "id" = :webhook_id
                    """
                ),
                {"webhook_id": row["id"]},
            )
        return {"sent": True, "statusCode": status_code, "message": "Webhook delivered successfully"}
    except (OSError, ValueError, urllib.error.URLError) as error:
        if isinstance(error, urllib.error.HTTPError):
            status_code = error.code
        with get_database_engine().begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE "userWebhooks"
                    SET "lastFailureAt" = CURRENT_TIMESTAMP,
                        "failureCount" = "failureCount" + 1
                    WHERE "id" = :webhook_id
                    """
                ),
                {"webhook_id": row["id"]},
            )
        return {
            "sent": False,
            "statusCode": status_code,
            "message": "Webhook delivery failed",
        }


def validate_public_https_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value.strip())
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("A valid public HTTPS URL is required")
    hostname = parsed.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith((".localhost", ".local")):
        raise ValueError("Webhook URL must resolve to a public address")
    try:
        addresses = [ipaddress.ip_address(hostname)]
    except ValueError:
        try:
            addresses = [
                ipaddress.ip_address(result[4][0])
                for result in socket.getaddrinfo(
                    hostname, parsed.port or 443, type=socket.SOCK_STREAM
                )
            ]
        except (OSError, ValueError) as error:
            raise ValueError("Webhook URL host could not be resolved") from error
    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Webhook URL must resolve only to public addresses")
    return value.strip()


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None
