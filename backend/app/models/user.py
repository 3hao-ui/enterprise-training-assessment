"""用户相关数据模型"""

from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    code: str = Field(min_length=1, description="wx.login() 返回的 code")


class WebLoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=64)


class WebUserBrief(BaseModel):
    id: int
    username: str
    nickname: str
    role: str
    department: str


class WebLoginResponse(BaseModel):
    token: str
    user: WebUserBrief


class EmployeeCreateRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=6, max_length=64)
    nickname: str = Field(min_length=1, max_length=100)
    department: str = Field(default="", max_length=64)


class EmployeeUpdateRequest(BaseModel):
    nickname: Optional[str] = Field(default=None, min_length=1, max_length=100)
    department: Optional[str] = Field(default=None, max_length=64)
    status: Optional[int] = Field(default=None, ge=0, le=1)


class EmployeeResetPasswordRequest(BaseModel):
    password: str = Field(min_length=6, max_length=64)


class EmployeeItem(BaseModel):
    id: int
    username: str
    nickname: str
    department: str
    role: str
    status: int
    total_xp: int
    created_at: str


class EmployeeList(BaseModel):
    items: list[EmployeeItem]
    total: int
    page: int
    page_size: int


class LoginResponse(BaseModel):
    token: str
    user: "UserBrief"


class UserBrief(BaseModel):
    id: int
    nickname: str
    avatar_url: str
    total_xp: int


class UserProfile(BaseModel):
    id: int
    nickname: str
    avatar_url: str
    total_xp: int
    quiz_count: int
    correct_count: int
    average_accuracy: int


class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = Field(default=None, max_length=500)


class QuizHistoryItem(BaseModel):
    quiz_id: str
    title: str
    accuracy: float
    question_count: int
    created_at: str


class QuizHistoryList(BaseModel):
    items: list[QuizHistoryItem]
    total: int
    page: int
    page_size: int


class QuizDetailResponse(BaseModel):
    quiz_id: str
    title: str
    summary: str
    user_input: Optional[str] = None
    questions: list  # raw JSON
    answer_records: Optional[list] = None
    report: Optional[dict] = None
    created_at: str
