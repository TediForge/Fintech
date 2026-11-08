"""Scheduled cashback earnings refresh."""

import asyncio
import logging

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.workers.shared import with_worker_lock

_LOGGER = logging.getLogger(__name__)


async def recalculate_cashback_earnings() -> int:
    async def run() -> int:
        return await asyncio.to_thread(_recalculate_cashback_earnings)

    affected = await with_worker_lock("worker.earnings.recalculate", run)
    count = affected or 0
    _LOGGER.info("Cashback earnings recalculated for %s users", count)
    return count


def _recalculate_cashback_earnings() -> int:
    statement = text(
        """
        WITH lagos_days AS (
            SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date AS today
        ), totals AS (
            SELECT transaction."userId",
                COALESCE(SUM(transaction."amount") FILTER (
                    WHERE (transaction."createdAt" AT TIME ZONE 'UTC'
                        AT TIME ZONE 'Africa/Lagos')::date = days.today
                ), 0) AS today_earnings,
                COALESCE(SUM(transaction."amount") FILTER (
                    WHERE (transaction."createdAt" AT TIME ZONE 'UTC'
                        AT TIME ZONE 'Africa/Lagos')::date = days.today - 1
                ), 0) AS yesterday_earnings
            FROM "transactions" transaction
            CROSS JOIN lagos_days days
            WHERE transaction."environment" = 'LIVE'
              AND LOWER(transaction."status") IN ('successful', 'success')
              AND transaction."direction" = 'credit'
              AND UPPER(transaction."walletType") = 'CASHBACK'
              AND transaction."createdAt" >= (
                  (days.today - 1)::timestamp
                  AT TIME ZONE 'Africa/Lagos' AT TIME ZONE 'UTC'
              )
              AND transaction."createdAt" < (
                  (days.today + 1)::timestamp
                  AT TIME ZONE 'Africa/Lagos' AT TIME ZONE 'UTC'
              )
            GROUP BY transaction."userId"
        ), all_users AS (
            SELECT users."userId",
                COALESCE(totals.today_earnings, 0) AS today_earnings,
                COALESCE(totals.yesterday_earnings, 0) AS yesterday_earnings
            FROM "users" users
            LEFT JOIN totals ON totals."userId" = users."userId"
        )
        UPDATE "users" users
        SET "todaysEarnings" = all_users.today_earnings,
            "yesterdaysEarnings" = all_users.yesterday_earnings
        FROM all_users
        WHERE users."userId" = all_users."userId"
          AND (
              users."todaysEarnings" IS DISTINCT FROM all_users.today_earnings
              OR users."yesterdaysEarnings" IS DISTINCT FROM all_users.yesterday_earnings
          )
        """
    )
    with get_database_engine().begin() as connection:
        result = connection.execute(statement)
        return max(result.rowcount or 0, 0)


if __name__ == "__main__":
    asyncio.run(recalculate_cashback_earnings())
