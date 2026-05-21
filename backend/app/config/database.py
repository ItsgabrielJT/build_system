from __future__ import annotations

from typing import AsyncGenerator

import asyncpg

from app.config.settings import settings

_pool: asyncpg.Pool | None = None


async def init_db() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
    )


async def close_db() -> None:
    if _pool is not None:
        await _pool.close()


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    async with _pool.acquire() as conn:
        yield conn
