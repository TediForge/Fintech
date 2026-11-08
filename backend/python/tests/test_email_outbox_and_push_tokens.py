import asyncio

from app.services.notification.mail import service as mail_service
from app.services.notification.push import service as push_service


def test_email_outbox_records_retry_and_exponential_backoff(monkeypatch) -> None:
    recorded: list[tuple[object, ...]] = []

    monkeypatch.setattr(
        mail_service,
        "_claim_email_job",
        lambda: {
            "id": 41,
            "attempts": 2,
            "payload": {"email": "user@example.com", "message": "Hello"},
        },
    )

    async def fail_delivery(*_args, **_kwargs):
        raise mail_service.EmailNotificationError(502, "emailSendFailed", "Failed")

    monkeypatch.setattr(mail_service, "send_email_notification", fail_delivery)
    monkeypatch.setattr(
        mail_service,
        "_record_email_failure",
        lambda *args: recorded.append(args),
    )

    assert asyncio.run(mail_service.process_next_email()) is True
    assert recorded == [(41, False, 120, "emailSendFailed")]


def test_email_outbox_marks_fifth_attempt_final(monkeypatch) -> None:
    recorded: list[tuple[object, ...]] = []
    monkeypatch.setattr(
        mail_service,
        "_claim_email_job",
        lambda: {
            "id": 42,
            "attempts": 5,
            "payload": {"email": "user@example.com", "message": "Hello"},
        },
    )

    async def fail_delivery(*_args, **_kwargs):
        raise mail_service.EmailNotificationError(502, "emailSendFailed", "Failed")

    monkeypatch.setattr(mail_service, "send_email_notification", fail_delivery)
    monkeypatch.setattr(
        mail_service,
        "_record_email_failure",
        lambda *args: recorded.append(args),
    )

    assert asyncio.run(mail_service.process_next_email()) is True
    assert recorded == [(42, True, 960, "emailSendFailed")]


def test_save_push_token_ignores_blank_tokens_without_database_access(
    monkeypatch,
) -> None:
    def unexpected_database_access():
        raise AssertionError("Blank tokens must not access the database")

    monkeypatch.setattr(push_service, "get_database_engine", unexpected_database_access)

    asyncio.run(
        push_service.save_push_token(
            user_id=1,
            token="  ",
            platform="ios",
            provider="fcm",
        )
    )
