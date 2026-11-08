"""Shared worker locking and interval configuration."""

import asyncio
import os
from collections.abc import Awaitable, Callable
from typing import TypeVar

from sqlalchemy import text
from sqlalchemy.engine import Connection

from database.db_01.connection import get_database_engine

T = TypeVar("T")


async def with_worker_lock(
    lock_name: str, operation: Callable[[], Awaitable[T]]
) -> T | None:
    connection = await asyncio.to_thread(_acquire_lock, lock_name)
    if connection is None:
        return None
    try:
        return await operation()
    finally:
        await asyncio.to_thread(_release_lock, connection, lock_name)


def read_interval(name: str, default_value: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default_value
    try:
        value = int(raw)
    except ValueError:
        return default_value
    return value if value >= 1_000 else default_value


def _acquire_lock(lock_name: str) -> Connection | None:
    connection = get_database_engine().connect()
    try:
        locked = connection.execute(
            text("SELECT pg_try_advisory_lock(hashtextextended(:lock_name, 0))"),
            {"lock_name": lock_name},
        ).scalar_one()
        if not locked:
            connection.close()
            return None
        return connection
    except Exception:
        connection.close()
        raise


def _release_lock(connection: Connection, lock_name: str) -> None:
    try:
        connection.execute(
            text("SELECT pg_advisory_unlock(hashtextextended(:lock_name, 0))"),
            {"lock_name": lock_name},
        )
    finally:
        connection.close()
