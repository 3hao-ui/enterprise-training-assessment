"""网页端登录路由"""

from fastapi import APIRouter, Depends

from app.core.auth import get_current_web_user
from app.models.common import ApiResponse
from app.models.user import WebLoginRequest, WebUserBrief
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ApiResponse)
async def web_login(req: WebLoginRequest):
    result = await user_service.handle_web_login(req.username, req.password)
    return ApiResponse.success(data=result.model_dump())


@router.get("/me", response_model=ApiResponse)
async def web_me(user: dict = Depends(get_current_web_user)):
    brief = WebUserBrief(
        id=user["id"],
        username=user["username"],
        nickname=user["nickname"],
        role=user["role"],
        department=user["department"],
    )
    return ApiResponse.success(data=brief.model_dump())
