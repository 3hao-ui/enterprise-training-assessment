"""管理端路由（员工管理；考核管理见后续迭代同文件扩展）"""

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_admin
from app.models.assessment import (
    AssessmentCreateRequest,
    AssessmentUpdateRequest,
)
from app.models.common import ApiResponse
from app.models.user import (
    EmployeeCreateRequest,
    EmployeeResetPasswordRequest,
    EmployeeUpdateRequest,
)
from app.services import assessment_service, user_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/employees", response_model=ApiResponse)
async def list_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    keyword: str = Query(""),
    _admin: dict = Depends(get_current_admin),
):
    result = await user_service.list_employees(page, page_size, keyword)
    return ApiResponse.success(data=result.model_dump())


@router.post("/employees", response_model=ApiResponse)
async def create_employee(
    req: EmployeeCreateRequest,
    _admin: dict = Depends(get_current_admin),
):
    result = await user_service.create_employee(
        req.username, req.password, req.nickname, req.department
    )
    return ApiResponse.success(data=result)


@router.put("/employees/{user_id}", response_model=ApiResponse)
async def update_employee(
    user_id: int,
    req: EmployeeUpdateRequest,
    _admin: dict = Depends(get_current_admin),
):
    await user_service.update_employee(
        user_id, req.nickname, req.department, req.status
    )
    return ApiResponse.success()


@router.post("/employees/{user_id}/reset-password", response_model=ApiResponse)
async def reset_employee_password(
    user_id: int,
    req: EmployeeResetPasswordRequest,
    _admin: dict = Depends(get_current_admin),
):
    await user_service.reset_employee_password(user_id, req.password)
    return ApiResponse.success()


@router.get("/assessments", response_model=ApiResponse)
async def list_assessments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status: str = Query(""),
    _admin: dict = Depends(get_current_admin),
):
    result = await assessment_service.list_assessments(page, page_size, status)
    return ApiResponse.success(data=result.model_dump())


@router.post("/assessments", response_model=ApiResponse)
async def create_assessment(
    req: AssessmentCreateRequest,
    admin: dict = Depends(get_current_admin),
):
    result = await assessment_service.create_assessment(admin, req)
    return ApiResponse.success(data=result)


@router.put("/assessments/{assessment_id}", response_model=ApiResponse)
async def update_assessment(
    assessment_id: str,
    req: AssessmentUpdateRequest,
    _admin: dict = Depends(get_current_admin),
):
    await assessment_service.update_assessment(assessment_id, req)
    return ApiResponse.success()


@router.get("/assessments/{assessment_id}/records", response_model=ApiResponse)
async def assessment_records(
    assessment_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    _admin: dict = Depends(get_current_admin),
):
    result = await assessment_service.list_records(page, page_size, assessment_id=assessment_id)
    return ApiResponse.success(data=result.model_dump())


@router.get("/records", response_model=ApiResponse)
async def all_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    user_id: int | None = Query(None),
    _admin: dict = Depends(get_current_admin),
):
    result = await assessment_service.list_records(page, page_size, user_id=user_id)
    return ApiResponse.success(data=result.model_dump())
