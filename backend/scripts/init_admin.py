"""初始化管理员账号：python -m scripts.init_admin <用户名> <密码>"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import aiomysql

from app.core.config import get_settings
from app.core.password import hash_password


async def init_admin(username: str, password: str) -> None:
    settings = get_settings()
    conn = await aiomysql.connect(
        host=settings.mysql_host,
        port=settings.mysql_port,
        user=settings.mysql_user,
        password=settings.mysql_password,
        db=settings.mysql_database,
        charset=settings.mysql_charset,
        autocommit=True,
    )
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT id FROM users WHERE username = %s", (username,)
            )
            row = await cursor.fetchone()
            password_hash = hash_password(password)
            if row:
                await cursor.execute(
                    "UPDATE users SET password_hash = %s, role = 'admin', status = 1 "
                    "WHERE username = %s",
                    (password_hash, username),
                )
                print(f"管理员已存在，密码已重置: {username} (id={row[0]})")
            else:
                await cursor.execute(
                    "INSERT INTO users (username, password_hash, role, department, status) "
                    "VALUES (%s, %s, 'admin', '系统管理', 1)",
                    (username, password_hash),
                )
                await cursor.execute("SELECT LAST_INSERT_ID()")
                new_id = (await cursor.fetchone())[0]
                print(f"管理员创建成功: {username} (id={new_id})")
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python -m scripts.init_admin <用户名> <密码>")
        sys.exit(1)
    asyncio.run(init_admin(sys.argv[1], sys.argv[2]))
