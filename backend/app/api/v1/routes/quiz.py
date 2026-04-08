"""出题路由"""

from typing import Optional

from fastapi import APIRouter, Depends

from app.core.auth import get_optional_user
from app.models.common import ApiResponse
from app.models.quiz import QuizGenerateRequest
from app.services.quiz_service import handle_quiz_generate

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/generate", response_model=ApiResponse)
async def quiz_generate(
    req: QuizGenerateRequest,
    user_id: Optional[int] = Depends(get_optional_user),
):
    result = await handle_quiz_generate(req, user_id=user_id)
    return ApiResponse.success(data=result.model_dump())
