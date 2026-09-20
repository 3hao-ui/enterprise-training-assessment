"""考核任务数据访问层"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import structlog

from app.core.db import get_mysql_pool

logger = structlog.get_logger()


def _fmt(dt) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else ""


def _assessment_row(r) -> dict:
    return {
        "assessment_id": r[0],
        "title": r[1],
        "doc_id": r[2],
        "doc_file_name": r[3] or "",
        "question_count": r[4],
        "difficulty": r[5],
        "pass_accuracy": float(r[6]),
        "deadline": _fmt(r[7]),
        "status": r[8],
        "created_at": _fmt(r[9]),
        "created_by": r[10],
    }


ASSESSMENT_SELECT = (
    "SELECT a.assessment_id, a.title, a.doc_id, k.file_name, a.question_count, "
    "a.difficulty, a.pass_accuracy, a.deadline, a.status, a.created_at, a.created_by "
    "FROM assessments a LEFT JOIN kb_documents k ON k.doc_id = a.doc_id "
)


async def create_assessment(
    assessment_id: str,
    title: str,
    doc_id: str,
    question_count: int,
    difficulty: str,
    pass_accuracy: float,
    deadline: Optional[datetime],
    created_by: int,
) -> dict:
    pool = get_mysql_pool()
    if pool is None:
        raise RuntimeError("数据库未初始化")
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO assessments "
                "(assessment_id, title, doc_id, question_count, difficulty, pass_accuracy, deadline, created_by) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (assessment_id, title, doc_id, question_count, difficulty,
                 pass_accuracy, deadline, created_by),
            )
    return {"assessment_id": assessment_id, "title": title}


async def get_assessment(assessment_id: str) -> Optional[dict]:
    pool = get_mysql_pool()
    if pool is None:
        return None
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                ASSESSMENT_SELECT + "WHERE a.assessment_id = %s", (assessment_id,)
            )
            row = await cur.fetchone()
            return _assessment_row(row) if row else None


async def list_assessments(page: int, page_size: int, status: str = "") -> tuple[list[dict], int]:
    pool = get_mysql_pool()
    if pool is None:
        return [], 0
    where = "WHERE a.status = %s" if status else ""
    params = [status] if status else []
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"SELECT COUNT(*) FROM assessments a {where}", tuple(params)
            )
            (total,) = await cur.fetchone()
            await cur.execute(
                ASSESSMENT_SELECT + f"{where} ORDER BY a.id DESC LIMIT %s OFFSET %s",
                tuple(params + [page_size, (page - 1) * page_size]),
            )
            rows = await cur.fetchall()
    return [_assessment_row(r) for r in rows], total


async def update_assessment(
    assessment_id: str, *, status: Optional[str] = None, deadline: Optional[datetime] = None
) -> None:
    pool = get_mysql_pool()
    if pool is None:
        raise RuntimeError("数据库未初始化")
    fields, values = [], []
    if status is not None:
        fields.append("status = %s")
        values.append(status)
    if deadline is not None:
        fields.append("deadline = %s")
        values.append(deadline)
    if not fields:
        return
    values.append(assessment_id)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"UPDATE assessments SET {', '.join(fields)} WHERE assessment_id = %s",
                tuple(values),
            )


async def list_my_assessments(user_id: int, page: int, page_size: int) -> tuple[list[dict], int]:
    pool = get_mysql_pool()
    if pool is None:
        return [], 0
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM assessments")
            (total,) = await cur.fetchone()
            await cur.execute(
                ASSESSMENT_SELECT
                + "ORDER BY a.id DESC LIMIT %s OFFSET %s",
                (page_size, (page - 1) * page_size),
            )
            rows = await cur.fetchall()
            items = [_assessment_row(r) for r in rows]
            if items:
                ids = tuple(i["assessment_id"] for i in items)
                placeholders = ",".join(["%s"] * len(ids))
                await cur.execute(
                    f"SELECT assessment_id, COUNT(*), MAX(accuracy) FROM assessment_records "
                    f"WHERE user_id = %s AND assessment_id IN ({placeholders}) "
                    f"GROUP BY assessment_id",
                    (user_id, *ids),
                )
                stats = {r[0]: (r[1], float(r[2])) for r in await cur.fetchall()}
            else:
                stats = {}
    for item in items:
        count, best = stats.get(item["assessment_id"], (0, None))
        item["record_count"] = count
        item["best_accuracy"] = best
    return items, total


async def add_record(
    assessment_id: str,
    user_id: int,
    quiz_id: str,
    accuracy: float,
    passed: bool,
    duration_seconds: int,
) -> None:
    pool = get_mysql_pool()
    if pool is None:
        raise RuntimeError("数据库未初始化")
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO assessment_records "
                "(assessment_id, user_id, quiz_id, accuracy, passed, duration_seconds) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (assessment_id, user_id, quiz_id, accuracy, int(passed), duration_seconds),
            )


async def list_records(
    page: int,
    page_size: int,
    assessment_id: str = "",
    user_id: Optional[int] = None,
) -> tuple[list[dict], int]:
    pool = get_mysql_pool()
    if pool is None:
        return [], 0
    where = ["1=1"]
    params: list = []
    if assessment_id:
        where.append("r.assessment_id = %s")
        params.append(assessment_id)
    if user_id is not None:
        where.append("r.user_id = %s")
        params.append(user_id)
    where_sql = "WHERE " + " AND ".join(where)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"SELECT COUNT(*) FROM assessment_records r {where_sql}", tuple(params)
            )
            (total,) = await cur.fetchone()
            await cur.execute(
                "SELECT r.id, r.assessment_id, a.title, r.user_id, u.username, u.nickname, "
                "u.department, r.quiz_id, r.accuracy, r.passed, r.duration_seconds, r.created_at "
                "FROM assessment_records r "
                "JOIN assessments a ON a.assessment_id = r.assessment_id "
                "JOIN users u ON u.id = r.user_id "
                f"{where_sql} ORDER BY r.id DESC LIMIT %s OFFSET %s",
                tuple(params + [page_size, (page - 1) * page_size]),
            )
            rows = await cur.fetchall()
    items = [
        {
            "record_id": r[0],
            "assessment_id": r[1],
            "assessment_title": r[2] or "",
            "user_id": r[3],
            "username": r[4] or "",
            "nickname": r[5],
            "department": r[6],
            "quiz_id": r[7],
            "accuracy": float(r[8]),
            "passed": bool(r[9]),
            "duration_seconds": r[10],
            "created_at": _fmt(r[11]),
        }
        for r in rows
    ]
    return items, total
