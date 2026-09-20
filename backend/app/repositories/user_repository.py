"""用户数据访问层"""

from __future__ import annotations

from typing import Optional

import structlog

from app.core.db import get_mysql_pool
from app.core.exceptions import BusinessError

logger = structlog.get_logger()


async def find_user_by_openid(openid: str) -> Optional[dict]:
    pool = get_mysql_pool()
    if pool is None:
        return None
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT id, openid, nickname, avatar_url, total_xp, created_at, updated_at "
                "FROM users WHERE openid = %s",
                (openid,),
            )
            row = await cur.fetchone()
            if row is None:
                return None
            return {
                "id": row[0],
                "openid": row[1],
                "nickname": row[2],
                "avatar_url": row[3],
                "total_xp": row[4],
                "created_at": row[5],
                "updated_at": row[6],
            }


async def create_user(openid: str) -> dict:
    pool = get_mysql_pool()
    if pool is None:
        raise RuntimeError("数据库未初始化")
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO users (openid) VALUES (%s)",
                (openid,),
            )
            user_id = cur.lastrowid
            return {
                "id": user_id,
                "openid": openid,
                "nickname": "员工",
                "avatar_url": "",
                "total_xp": 0,
            }


async def update_user_profile(user_id: int, nickname: Optional[str], avatar_url: Optional[str]) -> None:
    pool = get_mysql_pool()
    if pool is None:
        return
    fields = []
    values = []
    if nickname is not None:
        fields.append("nickname = %s")
        values.append(nickname)
    if avatar_url is not None:
        fields.append("avatar_url = %s")
        values.append(avatar_url)
    if not fields:
        return
    values.append(user_id)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"UPDATE users SET {', '.join(fields)} WHERE id = %s",
                tuple(values),
            )


async def add_user_xp(user_id: int, xp: int) -> None:
    pool = get_mysql_pool()
    if pool is None:
        return
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE users SET total_xp = total_xp + %s WHERE id = %s",
                (xp, user_id),
            )


async def get_user_by_id(user_id: int) -> Optional[dict]:
    pool = get_mysql_pool()
    if pool is None:
        return None
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT id, openid, nickname, avatar_url, total_xp, "
                "username, role, department, status FROM users WHERE id = %s",
                (user_id,),
            )
            row = await cur.fetchone()
            if row is None:
                return None
            return {
                "id": row[0],
                "openid": row[1],
                "nickname": row[2],
                "avatar_url": row[3],
                "total_xp": row[4],
                "username": row[5],
                "role": row[6],
                "department": row[7],
                "status": row[8],
            }


async def find_user_by_username(username: str) -> Optional[dict]:
    pool = get_mysql_pool()
    if pool is None:
        return None
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT id, openid, nickname, avatar_url, total_xp, "
                "username, password_hash, role, department, status "
                "FROM users WHERE username = %s",
                (username,),
            )
            row = await cur.fetchone()
            if row is None:
                return None
            return {
                "id": row[0],
                "openid": row[1],
                "nickname": row[2],
                "avatar_url": row[3],
                "total_xp": row[4],
                "username": row[5],
                "password_hash": row[6],
                "role": row[7],
                "department": row[8],
                "status": row[9],
            }


async def list_web_users(page: int, page_size: int, keyword: str = "") -> tuple[list[dict], int]:
    pool = get_mysql_pool()
    if pool is None:
        return [], 0
    where = "WHERE username IS NOT NULL"
    params: list = []
    if keyword:
        where += " AND (username LIKE %s OR nickname LIKE %s OR department LIKE %s)"
        like = f"%{keyword}%"
        params.extend([like, like, like])

    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"SELECT COUNT(*) FROM users {where}", tuple(params))
            (total,) = await cur.fetchone()
            await cur.execute(
                f"SELECT id, username, nickname, department, role, status, total_xp, created_at "
                f"FROM users {where} ORDER BY id LIMIT %s OFFSET %s",
                tuple(params + [page_size, (page - 1) * page_size]),
            )
            rows = await cur.fetchall()
    items = [
        {
            "id": r[0],
            "username": r[1],
            "nickname": r[2],
            "department": r[3],
            "role": r[4],
            "status": r[5],
            "total_xp": r[6],
            "created_at": r[7].isoformat() if r[7] else "",
        }
        for r in rows
    ]
    return items, total


async def update_web_user(
    user_id: int,
    *,
    nickname: str | None = None,
    department: str | None = None,
    status: int | None = None,
) -> None:
    pool = get_mysql_pool()
    if pool is None:
        raise RuntimeError("数据库未初始化")
    fields = []
    values = []
    if nickname is not None:
        fields.append("nickname = %s")
        values.append(nickname)
    if department is not None:
        fields.append("department = %s")
        values.append(department)
    if status is not None:
        fields.append("status = %s")
        values.append(status)
    if not fields:
        return
    values.append(user_id)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"UPDATE users SET {', '.join(fields)} "
                f"WHERE id = %s AND username IS NOT NULL",
                tuple(values),
            )
            if cur.rowcount == 0:
                raise BusinessError("员工不存在")


async def update_password_hash(user_id: int, password_hash: str) -> None:
    pool = get_mysql_pool()
    if pool is None:
        raise RuntimeError("数据库未初始化")
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s AND username IS NOT NULL",
                (password_hash, user_id),
            )
            if cur.rowcount == 0:
                raise BusinessError("员工不存在")


async def create_web_user(
    *,
    username: str,
    password_hash: str,
    nickname: str,
    department: str,
    role: str,
) -> dict:
    pool = get_mysql_pool()
    if pool is None:
        raise RuntimeError("数据库未初始化")
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO users (username, password_hash, nickname, department, role) "
                "VALUES (%s, %s, %s, %s, %s)",
                (username, password_hash, nickname, department, role),
            )
            return {
                "id": cur.lastrowid,
                "username": username,
                "nickname": nickname,
                "department": department,
                "role": role,
                "status": 1,
                "total_xp": 0,
            }
