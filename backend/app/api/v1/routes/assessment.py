"""员工端考核路由"""

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_web_user
from app.models.assessment import AssessmentSubmitRequest
from app.models.common import ApiResponse
from app.services import assessment_service

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("/mine", response_model=ApiResponse)
async def my_assessments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_web_user),
):
    result = await assessment_service.list_my_assessments(user["id"], page, page_size)
    return ApiResponse.success(data=result.model_dump())


@router.get("/records/mine", response_model=ApiResponse)
async def my_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_web_user),
):
    result = await assessment_service.list_records(page, page_size, user_id=user["id"])
    return ApiResponse.success(data=result.model_dump())


@router.post("/{assessment_id}/start", response_model=ApiResponse)
async def start_assessment(
    assessment_id: str,
    user: dict = Depends(get_current_web_user),
):
    result = await assessment_service.start_assessment(user, assessment_id)
    return ApiResponse.success(data=result.model_dump())


@router.post("/{assessment_id}/submit", response_model=ApiResponse)
async def submit_assessment(
    assessment_id: str,
    req: AssessmentSubmitRequest,
    user: dict = Depends(get_current_web_user),
):
    result = await assessment_service.submit_assessment(user, assessment_id, req)
    return ApiResponse.success(data=result.model_dump())
