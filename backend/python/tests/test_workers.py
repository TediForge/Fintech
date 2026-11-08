import asyncio
from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.workers import __main__ as worker_runner
from app.workers.cron import birthdays, earnings, tedibloom
from app.workers.tasks.email import outbox


def test_worker_runner_excludes_schedule_bill_and_runs_migrated_jobs() -> None:
    assert [worker[0] for worker in worker_runner._WORKERS] == [
        "earnings",
        "birthdays",
        "tediBloom",
        "emailOutbox",
    ]


def test_email_outbox_batch_stops_when_queue_is_empty(monkeypatch) -> None:
    calls = []

    async def fake_process_next_email(*, max_attempts):
        calls.append(max_attempts)
        return len(calls) < 3

    monkeypatch.setattr(
        outbox,
        "get_settings",
        lambda: SimpleNamespace(
            email_outbox_batch_size=10,
            email_outbox_max_attempts=4,
        ),
    )
    monkeypatch.setattr(outbox, "process_next_email", fake_process_next_email)

    assert asyncio.run(outbox.process_email_outbox_batch()) == 2
    assert calls == [4, 4, 4]


def test_earnings_worker_updates_cashback_under_lock(monkeypatch) -> None:
    async def fake_lock(name, operation):
        assert name == "worker.earnings.recalculate"
        return await operation()

    monkeypatch.setattr(earnings, "with_worker_lock", fake_lock)
    monkeypatch.setattr(earnings, "_recalculate_cashback_earnings", lambda: 5)

    assert asyncio.run(earnings.recalculate_cashback_earnings()) == 5


def test_birthday_worker_claims_and_sends_only_at_local_nine(monkeypatch) -> None:
    sent = []
    user = {
        "userId": 2,
        "firstName": "Ada Example",
        "email": "ada@example.com",
        "phoneNumber": None,
        "settings": {},
    }

    async def fake_lock(_name, operation):
        return await operation()

    async def fake_push(payload):
        sent.append(payload)
        return {"success": True}

    monkeypatch.setattr(birthdays, "with_worker_lock", fake_lock)
    monkeypatch.setattr(birthdays, "_birthday_targets", lambda *_args: [user])
    monkeypatch.setattr(birthdays, "_claim_birthday", lambda *_args: True)
    monkeypatch.setattr(birthdays, "send_push_notification", fake_push)

    local_nine = datetime(2026, 5, 1, 9, tzinfo=ZoneInfo("Africa/Lagos"))
    local_eight = datetime(2026, 5, 1, 8, tzinfo=ZoneInfo("Africa/Lagos"))
    assert asyncio.run(birthdays.send_birthday_wishes(local_nine)) == 1
    assert asyncio.run(birthdays.send_birthday_wishes(local_eight)) == 0
    assert len(sent) == 1
    assert "Ada" in sent[0]["message"]


def test_tedibloom_worker_uses_service_and_records_delivery(monkeypatch) -> None:
    stored = []

    async def fake_lock(_name, operation):
        return await operation()

    async def fake_generate(_now, _local_date):
        return {"title": "Welcome", "message": "Hello {firstName}"}

    async def fake_push(payload):
        assert payload["message"] == "Hello Ada"
        return {"success": True}

    monkeypatch.setattr(tedibloom, "with_worker_lock", fake_lock)
    monkeypatch.setattr(tedibloom, "get_cached_payload", lambda *_args: None)
    monkeypatch.setattr(
        tedibloom, "store_cached_payload", lambda *args: stored.append(args)
    )
    monkeypatch.setattr(
        tedibloom,
        "_promo_targets",
        lambda: [
            {
                "userId": 3,
                "email": "ada@example.com",
                "phoneNumber": None,
                "firstName": "Ada Example",
                "settings": {},
            }
        ],
    )
    monkeypatch.setattr(tedibloom, "generate_tedibloom_message", fake_generate)
    monkeypatch.setattr(tedibloom, "send_push_notification", fake_push)

    current = datetime(2026, 5, 1, 12, tzinfo=ZoneInfo("Africa/Lagos"))
    assert asyncio.run(tedibloom.send_tedibloom_promo(current)) == 1
    assert len(stored) == 3
