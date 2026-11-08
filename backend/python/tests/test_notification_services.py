import asyncio

import pytest

from app.services.notification.mail.service import (
    EmailNotificationError,
    render_structured_message,
    send_email_notification,
)


def test_structured_email_escapes_text_and_renders_plain_text() -> None:
    html, text = render_structured_message(
        {
            "title": "Welcome <user>",
            "preheader": "A <safe> preheader",
            "greeting": True,
            "blocks": [
                {"type": "paragraph", "text": "Balance: <NGN 10>"},
                {"type": "button", "text": "Open account", "url": "https://example.com"},
            ],
        },
        first_name="Ada",
    )

    assert "Welcome &lt;user&gt;" in html
    assert "Balance: &lt;NGN 10&gt;" in html
    assert "Hi Ada," in text
    assert "Open account: https://example.com" in text


def test_structured_email_rejects_non_https_links() -> None:
    with pytest.raises(TypeError, match="HTTPS"):
        render_structured_message(
            {
                "title": "Notice",
                "blocks": [{"type": "button", "text": "Open", "url": "http://example.com"}],
            }
        )


def test_email_delivery_fails_closed_without_database_provider(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.notification.mail.service.find_notification_user",
        lambda *_args: None,
    )

    with pytest.raises(EmailNotificationError) as error:
        asyncio.run(
            send_email_notification(
                {"email": "user@example.com", "message": "Hello", "isHTML": False}
            )
        )

    assert error.value.status == 503
    assert error.value.code == "emailProviderUnavailable"
