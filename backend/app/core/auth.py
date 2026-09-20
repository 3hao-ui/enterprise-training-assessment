"""JWT 鉴权模块"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
import structlog
from fastapi import Depends, Request

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.repositories import user_repository

logger = structlog.get_logger()

ALGORITHM = "HS256"


def create_token(user_id: int, openid: str, role: str = "") -> str:
    """生成 JWT token。"""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "user_id": user_id,
        "openid": openid,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """解析 JWT token，失败时抛出 AuthenticationError。"""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise AuthenticationError("无效的登录凭证")


def _extract_token(request: Request) -> Optional[str]:
    """从请求 Header 中提取 Bearer token。"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def get_current_user(request: Request) -> int:
    """必选鉴权依赖，返回 user_id。未登录时抛出 AuthenticationError。"""
    token = _extract_token(request)
    if not token:
        raise AuthenticationError()
    payload = decode_token(token)
    return payload["user_id"]


async def get_optional_user(request: Request) -> Optional[int]:
    """可选鉴权依赖，返回 user_id 或 None。不抛异常。"""
    token = _extract_token(request)
    if not token:
        return None
    try:
        payload = decode_token(token)
        return payload["user_id"]
    except AuthenticationError:
        return None


async def get_current_web_user(request: Request) -> dict:
    """网页端鉴权依赖：校验 token 且账号存在、未被停用，返回用户 dict。"""
    token = _extract_token(request)
    if not token:
        raise AuthenticationError()
    payload = decode_token(token)
    user = await user_repository.get_user_by_id(payload["user_id"])
    if user is None:
        raise AuthenticationError("账号不存在")
    if user["status"] != 1:
        raise AuthenticationError("账号已停用，请联系管理员")
    return user


async def get_current_admin(request: Request) -> dict:
    """网页端管理员依赖：在 get_current_web_user 基础上校验 admin 角色。"""
    user = await get_current_web_user(request)
    if user["role"] != "admin":
        raise PermissionDeniedError()
    return user
