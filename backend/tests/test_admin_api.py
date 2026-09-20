"""管理端员工管理 API 集成测试"""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import create_token
from app.main import app


def _header(user_id: int, role: str) -> dict:
    return {"Authorization": f"Bearer {create_token(user_id=user_id, openid='', role=role)}"}


def _patch_admin():
    return patch(
        "app.core.auth.user_repository.get_user_by_id",
        new=AsyncMock(
            return_value={
                "id": 2,
                "openid": None,
                "nickname": "培训管理员",
                "avatar_url": "",
                "total_xp": 0,
                "username": "admin",
                "role": "admin",
                "department": "",
                "status": 1,
            }
        ),
    )


def _patch_employee():
    return patch(
        "app.core.auth.user_repository.get_user_by_id",
        new=AsyncMock(
            return_value={
                "id": 3,
                "openid": None,
                "nickname": "张三",
                "avatar_url": "",
                "total_xp": 0,
                "username": "emp001",
                "role": "employee",
                "department": "",
                "status": 1,
            }
        ),
    )


@pytest.mark.asyncio
class TestAdminEmployeesAPI:
    async def test_list_requires_login(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/admin/employees")
        assert resp.status_code == 401

    async def test_list_rejects_employee_role(self):
        with _patch_employee():
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get(
                    "/api/v1/admin/employees", headers=_header(3, "employee")
                )
        assert resp.status_code == 403
        assert resp.json()["code"] == 4030

    async def test_list_success(self):
        with _patch_admin(), patch(
            "app.services.user_service.user_repository.list_web_users",
            new=AsyncMock(return_value=([], 0)),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get(
                    "/api/v1/admin/employees", headers=_header(2, "admin")
                )
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] == 0

    async def test_create_employee_success(self):
        with _patch_admin(), patch(
            "app.services.user_service.user_repository.find_user_by_username",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.services.user_service.user_repository.create_web_user",
            new=AsyncMock(return_value={"id": 9, "username": "emp009", "nickname": "李四",
                                        "department": "销售部", "role": "employee",
                                        "status": 1, "total_xp": 0}),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/admin/employees",
                    headers=_header(2, "admin"),
                    json={"username": "emp009", "password": "pass123456",
                          "nickname": "李四", "department": "销售部"},
                )
        assert resp.status_code == 200
        assert resp.json()["data"]["username"] == "emp009"

    async def test_create_employee_duplicate_rejected(self):
        with _patch_admin(), patch(
            "app.services.user_service.user_repository.find_user_by_username",
            new=AsyncMock(return_value={"id": 3}),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/admin/employees",
                    headers=_header(2, "admin"),
                    json={"username": "emp001", "password": "pass123456",
                          "nickname": "重复", "department": ""},
                )
        assert resp.status_code == 400
        assert resp.json()["code"] == 4002

    async def test_update_employee_status(self):
        with _patch_admin(), patch(
            "app.services.user_service.user_repository.update_web_user",
            new=AsyncMock(),
        ) as mock_update:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.put(
                    "/api/v1/admin/employees/3",
                    headers=_header(2, "admin"),
                    json={"status": 0},
                )
        assert resp.status_code == 200
        assert mock_update.call_args.kwargs["status"] == 0

    async def test_reset_password(self):
        with _patch_admin(), patch(
            "app.services.user_service.user_repository.update_password_hash",
            new=AsyncMock(),
        ) as mock_update:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/admin/employees/3/reset-password",
                    headers=_header(2, "admin"),
                    json={"password": "newpass123"},
                )
        assert resp.status_code == 200
        stored = mock_update.call_args.args[1]
        assert stored != "newpass123"  # 只存哈希
