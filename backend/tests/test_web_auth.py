"""网页端账号密码认证单元测试"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.auth import create_token, get_current_admin, get_current_web_user
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.password import hash_password, verify_password
from app.services.user_service import handle_web_login


def _web_user(**overrides):
    user = {
        "id": 10,
        "openid": None,
        "nickname": "张三",
        "avatar_url": "",
        "total_xp": 0,
        "username": "zhangsan",
        "password_hash": hash_password("pass123456"),
        "role": "employee",
        "department": "研发部",
        "status": 1,
    }
    user.update(overrides)
    return user


class TestPassword:
    def test_hash_then_verify(self):
        hashed = hash_password("secret123")
        assert hashed != "secret123"
        assert verify_password("secret123", hashed)

    def test_wrong_password_rejected(self):
        hashed = hash_password("secret123")
        assert not verify_password("wrong123", hashed)


class TestHandleWebLogin:
    @pytest.mark.asyncio
    async def test_login_success_returns_token_with_role(self):
        user = _web_user(role="admin")
        with patch(
            "app.services.user_service.user_repository.find_user_by_username",
            new=AsyncMock(return_value=user),
        ):
            result = await handle_web_login("zhangsan", "pass123456")
        assert result.token
        assert result.user.role == "admin"
        assert result.user.username == "zhangsan"

    @pytest.mark.asyncio
    async def test_wrong_password_rejected(self):
        user = _web_user()
        with patch(
            "app.services.user_service.user_repository.find_user_by_username",
            new=AsyncMock(return_value=user),
        ):
            with pytest.raises(AuthenticationError, match="用户名或密码错误"):
                await handle_web_login("zhangsan", "badpass")

    @pytest.mark.asyncio
    async def test_unknown_user_rejected(self):
        with patch(
            "app.services.user_service.user_repository.find_user_by_username",
            new=AsyncMock(return_value=None),
        ):
            with pytest.raises(AuthenticationError, match="用户名或密码错误"):
                await handle_web_login("ghost", "pass123456")

    @pytest.mark.asyncio
    async def test_wechat_only_user_cannot_web_login(self):
        user = _web_user(password_hash=None)
        with patch(
            "app.services.user_service.user_repository.find_user_by_username",
            new=AsyncMock(return_value=user),
        ):
            with pytest.raises(AuthenticationError, match="用户名或密码错误"):
                await handle_web_login("zhangsan", "pass123456")

    @pytest.mark.asyncio
    async def test_disabled_user_rejected(self):
        user = _web_user(status=0)
        with patch(
            "app.services.user_service.user_repository.find_user_by_username",
            new=AsyncMock(return_value=user),
        ):
            with pytest.raises(AuthenticationError, match="停用"):
                await handle_web_login("zhangsan", "pass123456")


def _request_with_token(user_id: int, role: str) -> MagicMock:
    token = create_token(user_id=user_id, openid="", role=role)
    request = MagicMock()
    request.headers = {"Authorization": f"Bearer {token}"}
    return request


class TestWebDependencies:
    @pytest.mark.asyncio
    async def test_get_current_web_user_returns_user(self):
        request = _request_with_token(10, "employee")
        with patch(
            "app.core.auth.user_repository.get_user_by_id",
            new=AsyncMock(return_value=_web_user()),
        ):
            user = await get_current_web_user(request)
        assert user["id"] == 10

    @pytest.mark.asyncio
    async def test_get_current_web_user_rejects_disabled(self):
        request = _request_with_token(10, "employee")
        with patch(
            "app.core.auth.user_repository.get_user_by_id",
            new=AsyncMock(return_value=_web_user(status=0)),
        ):
            with pytest.raises(AuthenticationError, match="停用"):
                await get_current_web_user(request)

    @pytest.mark.asyncio
    async def test_get_current_admin_allows_admin(self):
        request = _request_with_token(2, "admin")
        with patch(
            "app.core.auth.user_repository.get_user_by_id",
            new=AsyncMock(return_value=_web_user(role="admin")),
        ):
            user = await get_current_admin(request)
        assert user["role"] == "admin"

    @pytest.mark.asyncio
    async def test_get_current_admin_rejects_employee(self):
        request = _request_with_token(10, "employee")
        with patch(
            "app.core.auth.user_repository.get_user_by_id",
            new=AsyncMock(return_value=_web_user()),
        ):
            with pytest.raises(PermissionDeniedError):
                await get_current_admin(request)

    @pytest.mark.asyncio
    async def test_legacy_wechat_token_still_works_for_get_current_user(self):
        """回归：不含 role 字段的旧 token 仍能被小程序依赖解析。"""
        from app.core.auth import get_current_user

        token = create_token(user_id=5, openid="wx_openid")
        request = MagicMock()
        request.headers = {"Authorization": f"Bearer {token}"}
        assert await get_current_user(request) == 5
