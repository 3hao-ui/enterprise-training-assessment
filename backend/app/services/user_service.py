"""用户服务"""

from __future__ import annotations

import httpx
import structlog

from app.core.auth import create_token
from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, BusinessError
from app.core.password import hash_password, verify_password
from app.models.user import (
    EmployeeItem,
    EmployeeList,
    LoginResponse,
    UserBrief,
    UserProfile,
    WebLoginResponse,
    WebUserBrief,
)
from app.repositories import user_repository, quiz_repository

logger = structlog.get_logger()

WX_CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"


async def wx_code_to_openid(code: str) -> str:
    """调用微信 jscode2session 获取 openid。"""
    settings = get_settings()
    if not settings.wechat_app_id or not settings.wechat_app_secret:
        raise AuthenticationError("微信登录未配置")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                WX_CODE2SESSION_URL,
                params={
                    "appid": settings.wechat_app_id,
                    "secret": settings.wechat_app_secret,
                    "js_code": code,
                    "grant_type": "authorization_code",
                },
            )
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("wx_login_request_failed", error=str(exc), exc_info=True)
        raise AuthenticationError("微信登录服务暂时不可用，请稍后重试") from exc
    except ValueError as exc:  # resp.json() 解析失败
        logger.error("wx_login_invalid_response", error=str(exc), exc_info=True)
        raise AuthenticationError("微信登录失败，请重试") from exc

    if "openid" not in data:
        logger.error(
            "wx_login_failed",
            errcode=data.get("errcode"),
            errmsg=data.get("errmsg"),
            appid=settings.wechat_app_id,
        )
        raise AuthenticationError("微信登录失败，请重试")

    return data["openid"]


async def handle_login(code: str) -> LoginResponse:
    """微信登录：code -> openid -> 查/建用户 -> JWT。"""
    openid = await wx_code_to_openid(code)

    user = await user_repository.find_user_by_openid(openid)
    if user is None:
        user = await user_repository.create_user(openid)

    token = create_token(user_id=user["id"], openid=openid)

    return LoginResponse(
        token=token,
        user=UserBrief(
            id=user["id"],
            nickname=user["nickname"],
            avatar_url=user["avatar_url"],
            total_xp=user["total_xp"],
        ),
    )


async def handle_web_login(username: str, password: str) -> WebLoginResponse:
    """网页端登录：username + password -> 校验 -> JWT（带 role）。"""
    user = await user_repository.find_user_by_username(username)
    if user is None or not user["password_hash"]:
        raise AuthenticationError("用户名或密码错误")
    if not verify_password(password, user["password_hash"]):
        raise AuthenticationError("用户名或密码错误")
    if user["status"] != 1:
        raise AuthenticationError("账号已停用，请联系管理员")

    token = create_token(user_id=user["id"], openid=user["openid"] or "", role=user["role"])
    return WebLoginResponse(
        token=token,
        user=WebUserBrief(
            id=user["id"],
            username=user["username"],
            nickname=user["nickname"],
            role=user["role"],
            department=user["department"],
        ),
    )


async def get_profile(user_id: int) -> UserProfile:
    """获取用户档案，含统计聚合。"""
    user = await user_repository.get_user_by_id(user_id)
    if user is None:
        raise AuthenticationError("用户不存在")

    quiz_count = await quiz_repository.get_user_quiz_count(user_id)
    answer_stats = await quiz_repository.get_user_answer_stats(user_id)

    return UserProfile(
        id=user["id"],
        nickname=user["nickname"],
        avatar_url=user["avatar_url"],
        total_xp=user["total_xp"],
        quiz_count=quiz_count,
        correct_count=answer_stats["correct_count"],
        average_accuracy=answer_stats["average_accuracy"],
    )


async def update_profile(user_id: int, nickname: str | None, avatar_url: str | None) -> None:
    """更新用户档案。"""
    await user_repository.update_user_profile(user_id, nickname, avatar_url)


async def create_employee(
    username: str, password: str, nickname: str, department: str
) -> dict:
    """管理端新建员工账号。"""
    if await user_repository.find_user_by_username(username) is not None:
        raise BusinessError("用户名已存在")
    return await user_repository.create_web_user(
        username=username,
        password_hash=hash_password(password),
        nickname=nickname,
        department=department,
        role="employee",
    )


async def list_employees(page: int, page_size: int, keyword: str) -> EmployeeList:
    items, total = await user_repository.list_web_users(page, page_size, keyword)
    return EmployeeList(
        items=[EmployeeItem(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


async def update_employee(
    user_id: int, nickname: str | None, department: str | None, status: int | None
) -> None:
    await user_repository.update_web_user(
        user_id, nickname=nickname, department=department, status=status
    )


async def reset_employee_password(user_id: int, password: str) -> None:
    await user_repository.update_password_hash(user_id, hash_password(password))
