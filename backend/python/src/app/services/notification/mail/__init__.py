"""Email notification channel."""

from app.services.notification.mail.service import (
    EmailNotificationError,
    MailSender,
    enqueue_email_notification,
    render_structured_message,
    process_next_email,
    send_email_notification,
    start_email_outbox_worker,
    stop_email_outbox_worker,
    verify_email_transport,
)
from app.services.notification.mail.smtp_transport import SmtpTransport

__all__ = [
    "EmailNotificationError",
    "MailSender",
    "SmtpTransport",
    "enqueue_email_notification",
    "process_next_email",
    "render_structured_message",
    "send_email_notification",
    "start_email_outbox_worker",
    "stop_email_outbox_worker",
    "verify_email_transport",
]
