"""SMTP transport configured from deployment environment variables."""

from email.message import EmailMessage
from email.utils import formataddr
from typing import Any

import aiosmtplib

from app.config import get_settings


class SmtpTransport:
    """Deliver rendered mail through the configured SMTP relay."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.smtp_host or not settings.smtp_from_email:
            raise ValueError("SMTP_HOST and SMTP_FROM_EMAIL must be configured")
        self._host = settings.smtp_host
        self._port = settings.smtp_port
        self._secure = settings.smtp_secure
        self._username = settings.smtp_user
        self._password = (
            settings.smtp_password.get_secret_value()
            if settings.smtp_password is not None
            else None
        )
        self._from_email = settings.smtp_from_email
        self._from_name = settings.smtp_from_name or "Tediwave Team"
        self._timeout = settings.smtp_timeout_seconds

    async def send_mail(self, message: dict[str, Any]) -> dict[str, Any]:
        recipient = message.get("to_email")
        subject = message.get("subject")
        if not isinstance(recipient, str) or not recipient.strip():
            raise ValueError("SMTP recipient email is required")
        if not isinstance(subject, str) or not subject.strip():
            raise ValueError("SMTP subject is required")

        outgoing = EmailMessage()
        outgoing["From"] = formataddr((self._from_name, self._from_email))
        outgoing["To"] = recipient.strip()
        outgoing["Subject"] = subject.strip()
        headers = message.get("headers")
        if isinstance(headers, dict):
            for name, value in headers.items():
                if isinstance(name, str) and isinstance(value, str):
                    outgoing[name] = value
        text_body = message.get("text")
        html_body = message.get("html")
        if isinstance(text_body, str) and text_body:
            outgoing.set_content(text_body)
        if isinstance(html_body, str) and html_body:
            outgoing.add_alternative(html_body, subtype="html")

        sender = await aiosmtplib.send(
            outgoing,
            hostname=self._host,
            port=self._port,
            username=self._username,
            password=self._password,
            use_tls=self._secure and self._port == 465,
            start_tls=self._secure and self._port != 465,
            timeout=self._timeout,
        )
        return {
            "messageId": outgoing.get("Message-ID", ""),
            "accepted": [recipient.strip()],
            "sender": sender,
        }

    async def verify(self) -> bool:
        client = aiosmtplib.SMTP(
            hostname=self._host,
            port=self._port,
            username=self._username,
            password=self._password,
            use_tls=self._secure and self._port == 465,
            start_tls=self._secure and self._port != 465,
            timeout=self._timeout,
        )
        await client.connect()
        try:
            await client.noop()
        finally:
            await client.quit()
        return True
