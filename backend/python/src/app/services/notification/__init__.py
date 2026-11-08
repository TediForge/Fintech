"""Public notification service surface."""

from app.services.notification.inapp import InAppSender, send_in_app_notification
from app.services.notification.mail import (
    EmailNotificationError,
    MailSender,
    enqueue_email_notification,
    process_next_email,
    render_structured_message,
    send_email_notification,
    start_email_outbox_worker,
    stop_email_outbox_worker,
    verify_email_transport,
)
from app.services.notification.push import (
    PushSender,
    get_active_push_targets,
    get_active_push_targets_for_broadcast,
    save_push_token,
    send_push_notification,
)
from app.services.notification.webhook import (
    WebhookDeliveryResult,
    WebhookSender,
    send_user_webhook,
)

__all__ = [
    "EmailNotificationError",
    "InAppSender",
    "MailSender",
    "PushSender",
    "WebhookDeliveryResult",
    "WebhookSender",
    "enqueue_email_notification",
    "get_active_push_targets",
    "get_active_push_targets_for_broadcast",
    "process_next_email",
    "render_structured_message",
    "save_push_token",
    "send_email_notification",
    "send_in_app_notification",
    "send_push_notification",
    "send_user_webhook",
    "start_email_outbox_worker",
    "stop_email_outbox_worker",
    "verify_email_transport",
]
