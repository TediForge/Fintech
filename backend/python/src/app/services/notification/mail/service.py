"""Email rendering and notification service."""

import asyncio
import html
import json
import logging
import re
from collections.abc import Mapping
from datetime import datetime
from importlib.resources import files
from string import Template
from typing import Any, Protocol

from sqlalchemy import Engine, text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.elements import TextClause

from database.db_01.connection import get_database_engine
from app.services.notification.shared import find_notification_user

_MAXIMUM_BLOCKS = 30
_PRECEDENCE = {"bulk", "list", "auto_reply", "auto", "first", "joke"}
_LOGGER = logging.getLogger(__name__)
_EMAIL_TEMPLATE = Template(
    files("app.services.notification.mail")
    .joinpath("templates", "base.html")
    .read_text(encoding="utf-8")
)


class EmailNotificationError(Exception):
    """Email input or dispatch error with an API-compatible status and code."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code


class MailTransport(Protocol):
    async def send_mail(self, message: Mapping[str, Any]) -> Mapping[str, Any]: ...

    async def verify(self) -> bool: ...


class MailSender:
    """Notification channel with an injectable transport.

    SMTP is configured from deployment environment variables under D-009.
    """

    def __init__(self, transport: MailTransport | None = None) -> None:
        self._transport = transport

    async def send(self, input: Mapping[str, Any]) -> dict[str, Any]:
        return await send_email_notification(input, transport=self._transport)


async def send_email_notification(
    payload: Any, *, transport: MailTransport | None = None
) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        raise EmailNotificationError(400, "invalidPayload", "Email request must be an object")

    supplied_email = _first_value(
        payload.get("email"), payload.get("recipientEmail"), payload.get("toEmail")
    )
    phone = _optional_string(payload.get("phone"))
    email, first_name = await asyncio.to_thread(
        _resolve_recipient, supplied_email, phone
    )
    if not email or not _is_valid_email(email):
        raise EmailNotificationError(400, "invalidEmail", "A valid recipient email address is required")

    subject = _optional_string(payload.get("subject")) or "Message from Tediwave"
    message = payload.get("message")
    html_body: str | None = None
    text_body: str | None = None
    if isinstance(message, Mapping):
        try:
            html_body, text_body = render_structured_message(
                message, first_name=first_name, brand_name="Tediwave"
            )
        except (TypeError, ValueError) as error:
            raise EmailNotificationError(
                400, "invalidEmailMessage", "Email message format is invalid"
            ) from error
    elif isinstance(message, str) and message.strip():
        if _parse_boolean(payload.get("isHTML"), True):
            html_body = message
            text_body = re.sub(r"<[^>]*>", "", re.sub(r"<br\s*/?\s*>", "\n", message, flags=re.I))
        else:
            text_body = message
    else:
        raise EmailNotificationError(400, "invalidEmailMessage", "Email body is required")

    if transport is None:
        try:
            from app.services.notification.mail.smtp_transport import SmtpTransport

            transport = SmtpTransport()
        except (ValueError, RuntimeError) as error:
            raise EmailNotificationError(
                503,
                "emailProviderUnavailable",
                "SMTP is unavailable; configure SMTP_HOST and SMTP_FROM_EMAIL.",
            ) from error
    precedence = _optional_string(payload.get("precedence"))
    headers = (
        {"Precedence": precedence.lower()}
        if precedence and precedence.lower() in _PRECEDENCE
        else {}
    )
    outgoing: dict[str, Any] = {
        "from_name": "Tediwave Team",
        "to_name": first_name,
        "to_email": email,
        "subject": subject,
        "headers": headers,
        "attachments": _parse_attachment(payload),
    }
    if html_body:
        outgoing["html"] = html_body
    if text_body:
        outgoing["text"] = text_body
    try:
        result = await transport.send_mail(outgoing)
    except Exception as error:
        raise EmailNotificationError(
            502, "emailSendFailed", "Failed to send email"
        ) from error
    return {
        "success": True,
        "messageId": result.get("messageId", ""),
        "accepted": result.get("accepted", []),
    }


async def verify_email_transport(
    *, transport: MailTransport | None = None
) -> bool:
    if transport is None:
        try:
            from app.services.notification.mail.smtp_transport import SmtpTransport

            transport = SmtpTransport()
        except (ValueError, RuntimeError) as error:
            raise EmailNotificationError(
                503,
                "emailProviderUnavailable",
                "SMTP is unavailable; configure SMTP_HOST and SMTP_FROM_EMAIL.",
            ) from error
    try:
        return await transport.verify()
    except Exception as error:
        raise EmailNotificationError(
            502, "emailSendFailed", "Unable to verify the email service"
        ) from error


async def enqueue_email_notification(
    payload: Mapping[str, Any],
    executor: Engine | Connection | None = None,
) -> int:
    email = payload.get("email")
    if not isinstance(email, str) or not email.strip():
        raise ValueError("A recipient email is required for queued email")
    selected = executor if executor is not None else get_database_engine()
    statement = text(
        """
        INSERT INTO "emailOutbox" ("recipientEmail", "payload", "status", "availableAt")
        VALUES (:email, CAST(:payload AS JSONB), 'pending', CURRENT_TIMESTAMP)
        RETURNING "id"
        """
    )
    parameters = {"email": email.strip(), "payload": json.dumps(dict(payload))}
    if isinstance(selected, Connection):
        return int(selected.execute(statement, parameters).scalar_one())
    return await asyncio.to_thread(
        _enqueue_email_with_engine, selected, statement, parameters
    )


async def process_next_email(
    transport: MailTransport | None = None, *, max_attempts: int = 5
) -> bool:
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least one")
    job = await asyncio.to_thread(_claim_email_job)
    if job is None:
        return False
    try:
        payload = job["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        if not isinstance(payload, Mapping):
            raise TypeError("Queued email payload is invalid")
        await send_email_notification(payload, transport=transport)
    except Exception as error:
        attempts = job["attempts"]
        final_attempt = attempts >= max_attempts
        error_code = (
            error.code
            if isinstance(error, EmailNotificationError)
            else "deliveryFailed"
        )
        try:
            await asyncio.to_thread(
                _record_email_failure,
                job["id"],
                final_attempt,
                min(3600, 30 * 2 ** min(attempts, 7)),
                error_code[:100],
            )
        except SQLAlchemyError:
            _LOGGER.exception("Unable to record email outbox delivery failure")
            raise
        _LOGGER.warning(
            "Email outbox delivery failed for job %s (attempt %s/%s)",
            job["id"],
            attempts,
            max_attempts,
            exc_info=error,
        )
        return True
    await asyncio.to_thread(_record_email_success, job["id"])
    return True


def start_email_outbox_worker(
    transport: MailTransport | None = None,
    interval_seconds: float = 5,
) -> asyncio.Task[None]:
    if interval_seconds <= 0:
        raise ValueError("interval_seconds must be greater than zero")

    async def run() -> None:
        while True:
            try:
                await process_next_email(transport)
            except asyncio.CancelledError:
                raise
            except SQLAlchemyError:
                _LOGGER.exception("Unable to process email outbox")
            await asyncio.sleep(interval_seconds)

    return asyncio.create_task(run(), name="email-outbox-worker")


def stop_email_outbox_worker(task: asyncio.Task[None]) -> None:
    task.cancel()


def _claim_email_job() -> dict[str, Any] | None:
    with get_database_engine().begin() as connection:
        job = connection.execute(
            text(
                """
                SELECT "id", "payload", "attempts"
                FROM "emailOutbox"
                WHERE ("status" = 'pending' AND "availableAt" <= CURRENT_TIMESTAMP)
                   OR ("status" = 'processing'
                       AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
                ORDER BY "id"
                LIMIT 1
                FOR UPDATE SKIP LOCKED
                """
            )
        ).mappings().first()
        if job is None:
            return None
        attempts = int(job["attempts"]) + 1
        connection.execute(
            text(
                """
                UPDATE "emailOutbox"
                SET "status" = 'processing', "lockedAt" = CURRENT_TIMESTAMP,
                    "attempts" = :attempts
                WHERE "id" = :id
                """
            ),
            {"id": job["id"], "attempts": attempts},
        )
    return {"id": int(job["id"]), "payload": job["payload"], "attempts": attempts}


def _enqueue_email_with_engine(
    engine: Engine, statement: TextClause, parameters: Mapping[str, str]
) -> int:
    with engine.begin() as connection:
        return int(connection.execute(statement, parameters).scalar_one())


def _record_email_success(job_id: int) -> None:
    with get_database_engine().begin() as connection:
        connection.execute(
            text(
                """
                UPDATE "emailOutbox"
                SET "status" = 'sent', "payload" = NULL, "recipientEmail" = NULL,
                    "sentAt" = CURRENT_TIMESTAMP, "lockedAt" = NULL, "lastErrorCode" = NULL
                WHERE "id" = :id
                """
            ),
            {"id": job_id},
        )


def _record_email_failure(
    job_id: int, final_attempt: bool, delay_seconds: int, error_code: str
) -> None:
    with get_database_engine().begin() as connection:
        connection.execute(
            text(
                """
                UPDATE "emailOutbox"
                SET "status" = :status,
                    "payload" = CASE WHEN :final THEN NULL ELSE "payload" END,
                    "recipientEmail" = CASE WHEN :final THEN NULL ELSE "recipientEmail" END,
                    "availableAt" = CURRENT_TIMESTAMP + (:delay * INTERVAL '1 second'),
                    "lockedAt" = NULL, "lastErrorCode" = :error_code
                WHERE "id" = :id
                """
            ),
            {
                "status": "failed" if final_attempt else "pending",
                "final": final_attempt,
                "delay": delay_seconds,
                "error_code": error_code,
                "id": job_id,
            },
        )


def render_structured_message(
    message: Mapping[str, Any],
    *,
    first_name: str = "User",
    brand_name: str = "Tediwave",
) -> tuple[str, str]:
    title = message.get("title")
    blocks = message.get("blocks")
    if not isinstance(title, str) or not title.strip():
        raise TypeError("Structured email title is required")
    if not isinstance(blocks, list) or len(blocks) > _MAXIMUM_BLOCKS:
        raise TypeError("Structured email blocks are invalid")

    rendered: list[str] = []
    plain: list[str] = []
    button_count = 0
    for block in blocks:
        if not isinstance(block, Mapping) or not isinstance(block.get("type"), str):
            raise TypeError("Structured email block is invalid")
        kind = block["type"]
        if kind in {"paragraph", "note"}:
            text = _required_string(block, "text")
            safe = _escape(text).replace("\r\n", "\n").replace("\n", "<br>")
            style = (
                "padding:12px 14px;background:#f7f9fc;border-left:3px solid "
                "#0d7a6b;color:#526273;"
                if kind == "note"
                else "color:#3d4d60;"
            )
            rendered.append(f'<p style="margin:0 0 18px;{style}">{safe}</p>')
            plain.append(text)
        elif kind == "heading":
            text = _required_string(block, "text")
            level = block.get("level", 2)
            if level not in (2, 3):
                raise TypeError("Email heading level must be 2 or 3")
            rendered.append(f'<h{level} style="color:#123b5d">{_escape(text)}</h{level}>')
            plain.append(text)
        elif kind == "list":
            items = block.get("items")
            style = block.get("style", "bullet")
            if not isinstance(items, list) or not items or style not in {"bullet", "number"}:
                raise TypeError("Email list is invalid")
            tag = "ol" if style == "number" else "ul"
            rendered.append(f"<{tag}>{''.join(f'<li>{_escape(_required_value(item))}</li>' for item in items)}</{tag}>")
            plain.extend(
                f"{index + 1}. {_required_value(item)}"
                if style == "number"
                else f"- {_required_value(item)}"
                for index, item in enumerate(items)
            )
        elif kind == "table":
            columns = block.get("columns")
            rows = block.get("rows", [])
            if (
                not isinstance(columns, list)
                or not columns
                or any(not isinstance(item, str) or not item.strip() for item in columns)
                or not isinstance(rows, list)
                or len(rows) > 40
            ):
                raise TypeError("Email table is invalid")
            caption = block.get("caption", "")
            if not isinstance(caption, str):
                raise TypeError("Email table caption is invalid")
            rendered_rows = []
            for row in rows:
                if not isinstance(row, list) or len(row) != len(columns):
                    raise TypeError("Email table row is invalid")
                rendered_rows.append(
                    "<tr>"
                    + "".join(
                        f'<td style="padding:8px;border-bottom:1px solid #e7edf4">{_escape(_required_value(cell))}</td>'
                        for cell in row
                    )
                    + "</tr>"
                )
            rendered.append(
                '<table role="presentation" width="100%" style="border-collapse:collapse">'
                f"<caption>{_escape(caption)}</caption><thead><tr>"
                + "".join(
                    f'<th align="left" style="padding:8px;background:#eef3f8">{_escape(column)}</th>'
                    for column in columns
                )
                + f"</tr></thead><tbody>{''.join(rendered_rows)}</tbody></table>"
            )
            plain.extend(
                [caption, " | ".join(columns)]
                + [
                    " | ".join(_required_value(cell) for cell in row)
                    for row in rows
                ]
            )
        elif kind == "keyValue":
            section = _required_string(block, "sectionHeader")
            items = block.get("items")
            if not isinstance(items, list) or not items:
                raise TypeError("Email key/value items are invalid")
            rows = []
            for item in items:
                if not isinstance(item, Mapping) or not isinstance(item.get("label"), str):
                    raise TypeError("Email key/value item is invalid")
                value = _required_value(item.get("value"))
                rows.append(
                    "<tr>"
                    f'<td style="padding:8px;color:#666">{_escape(item["label"])}</td>'
                    f'<td align="right" style="padding:8px;color:#243247">{_escape(value)}</td>'
                    "</tr>"
                )
                plain.append(f'{item["label"]}: {value}')
            rendered.append(
                f'<h3 style="color:#123b5d">{_escape(section)}</h3>'
                '<table role="presentation" width="100%" style="border-collapse:collapse">'
                + "".join(rows)
                + "</table>"
            )
            plain.insert(len(plain) - len(items), section)
        elif kind == "image":
            url = _require_https_url(block.get("src"))
            alt = _required_string(block, "alt")
            width = block.get("width", 520)
            if isinstance(width, bool) or not isinstance(width, int) or not 1 <= width <= 560:
                raise TypeError("Email image width is invalid")
            rendered.append(
                f'<p><img src="{_escape(url)}" alt="{_escape(alt)}" width="{width}" '
                'style="max-width:100%;height:auto"></p>'
            )
            plain.append(f"[Image: {alt}]")
        elif kind == "button":
            button_count += 1
            if button_count > 1:
                raise TypeError("Only one email button is allowed")
            text = _required_string(block, "text")
            url = _require_https_url(block.get("url"))
            rendered.append(
                f'<p><a href="{_escape(url)}" style="display:inline-block;padding:12px 20px;'
                f'background:#0d7a6b;color:#fff;text-decoration:none">{_escape(text)}</a></p>'
            )
            plain.append(f"{text}: {url}")
        elif kind == "code":
            label = _required_string(block, "label")
            value = _required_string(block, "value")
            rendered.append(
                f'<p><span>{_escape(label)}</span><br><strong style="font-size:24px">'
                f"{_escape(value)}</strong></p>"
            )
            plain.append(f"{label}: {value}")
        elif kind == "divider":
            rendered.append("<hr>")
        elif kind == "spacer":
            size = block.get("size", "small")
            if size not in {"small", "medium"}:
                raise TypeError("Email spacer size is invalid")
            rendered.append(
                f'<div style="height:{12 if size == "small" else 24}px">&nbsp;</div>'
            )
        else:
            raise TypeError(f"Unsupported email block: {kind}")

    preheader = message.get("preheader", "")
    if not isinstance(preheader, str):
        preheader = ""
    greeting = message.get("greeting") is True
    greeting_html = f"<p>Hi {_escape(first_name)},</p>" if greeting else ""
    year = datetime.now().year
    html_body = _EMAIL_TEMPLATE.substitute(
        preheader=_escape(preheader),
        greeting=greeting_html,
        title=_escape(title),
        body="".join(rendered),
        brand_name=_escape(brand_name),
        year=year,
    )
    text_body = "\n\n".join(
        item
        for item in [
            preheader,
            f"Hi {first_name}," if greeting else "",
            title,
            *plain,
            f"You received this email from {brand_name}. This mailbox is not monitored; "
            "please do not reply. Never share your PIN, OTP, or password by email.",
            f"(c) {year} {brand_name}, all rights reserved",
        ]
        if item
    )
    return html_body, text_body


def _resolve_recipient(
    supplied_email: Any, phone: str | None
) -> tuple[str | None, str]:
    email = _optional_string(supplied_email)
    if not phone and not email:
        return None, "User"
    try:
        user = find_notification_user(phone, email)
    except (SQLAlchemyError, RuntimeError) as error:
        raise EmailNotificationError(
            503, "recipientLookupFailed", "Unable to resolve the recipient email"
        ) from error
    if user:
        resolved_email = _optional_string(user.get("email")) if phone else email
        return resolved_email or email, _optional_string(user.get("firstName")) or "User"
    return email, "User"


def _parse_attachment(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    content = _first_value(payload.get("attachmentContent"), payload.get("attachment_content"))
    filename = _first_value(payload.get("attachmentName"), payload.get("attachment_name"))
    if content is None and filename is None:
        return []
    if not isinstance(content, str) or not isinstance(filename, str) or not filename.strip():
        raise EmailNotificationError(400, "invalidAttachment", "Attachment content and filename are required")
    import base64
    import binascii

    try:
        decoded = base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError) as error:
        raise EmailNotificationError(400, "invalidAttachment", "Attachment content must be base64 encoded") from error
    safe_filename = re.sub(r"[\\/\x00-\x1f\x7f]", "_", filename).strip()
    content_type = _optional_string(
        _first_value(payload.get("attachmentType"), payload.get("attachment_type"))
    ) or "application/octet-stream"
    return [{"filename": safe_filename, "content": decoded, "contentType": content_type}]


def _required_string(value: Mapping[str, Any], key: str) -> str:
    item = value.get(key)
    if not isinstance(item, str) or not item.strip():
        raise TypeError(f"Email field '{key}' is required")
    return item


def _required_value(value: Any) -> str:
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        raise TypeError("Email value must be text or a number")
    return str(value)


def _require_https_url(value: Any) -> str:
    if not isinstance(value, str):
        raise TypeError("Email URL is required")
    from urllib.parse import urlsplit

    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname:
        raise TypeError("Email URLs must use HTTPS")
    return value


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _first_value(*values: Any) -> Any:
    return next((value for value in values if value is not None and value != ""), None)


def _optional_string(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _is_valid_email(value: str) -> bool:
    return re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value) is not None


def _parse_boolean(value: Any, fallback: bool) -> bool:
    if value is None or value == "":
        return fallback
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    raise ValueError("Boolean SMTP configuration must be true or false")
