"""Drain a bounded batch of due email notifications from the db-01 outbox."""

from app.config import get_settings
from app.services.notification.mail import process_next_email


async def process_email_outbox_batch() -> int:
    """Deliver up to the configured batch size and return the number claimed."""
    settings = get_settings()
    processed = 0
    for _ in range(settings.email_outbox_batch_size):
        if not await process_next_email(max_attempts=settings.email_outbox_max_attempts):
            break
        processed += 1
    return processed
