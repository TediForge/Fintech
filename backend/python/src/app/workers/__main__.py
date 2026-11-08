"""Run the scheduled background workers."""

import asyncio
import logging
from collections.abc import Awaitable, Callable

from app.config import get_settings
from app.workers.cron.birthdays import send_birthday_wishes
from app.workers.cron.earnings import recalculate_cashback_earnings
from app.workers.cron.tedibloom import send_tedibloom_promo
from app.workers.shared import read_interval
from app.workers.tasks.email.outbox import process_email_outbox_batch

_LOGGER = logging.getLogger(__name__)
_WORKERS = (
    (
        "earnings",
        read_interval("earningsRecalcIntervalMs", 30 * 60_000),
        recalculate_cashback_earnings,
    ),
    (
        "birthdays",
        read_interval("birthdaySyncIntervalMs", 5 * 60_000),
        send_birthday_wishes,
    ),
    (
        "tediBloom",
        read_interval("tediBloomIntervalMs", 15 * 60_000),
        send_tedibloom_promo,
    ),
    (
        "emailOutbox",
        int(get_settings().email_outbox_interval_seconds * 1000),
        process_email_outbox_batch,
    ),
)


async def _run_worker(
    name: str, interval_ms: int, operation: Callable[[], Awaitable[int]]
) -> None:
    while True:
        try:
            result = await operation()
            if result:
                _LOGGER.info("Worker %s completed: %s", name, result)
        except Exception:
            _LOGGER.exception("Worker %s failed", name)
        await asyncio.sleep(interval_ms / 1000)


async def main() -> None:
    await asyncio.gather(
        *(
            _run_worker(name, interval_ms, operation)
            for name, interval_ms, operation in _WORKERS
        )
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
