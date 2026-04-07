"""出题路由"""

from fastapi import APIRouter

from app.models.common import ApiResponse
from app.models.quiz import QuizGenerateRequest
from app.services.quiz_service import handle_quiz_generate

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/generate", response_model=ApiResponse)
async def quiz_generate(req: QuizGenerateRequest):
    result = await handle_quiz_generate(req)
    return ApiResponse.success(data=result.model_dump())
