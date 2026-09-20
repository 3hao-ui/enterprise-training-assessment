"""考核任务相关数据模型"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class AssessmentCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    doc_id: str = Field(min_length=1, max_length=64)
    question_count: int = Field(default=5, ge=3, le=10)
    difficulty: Literal["easy", "medium", "hard", "mixed"] = "mixed"
    pass_accuracy: float = Field(default=60.0, ge=0, le=100)
    deadline: Optional[str] = Field(default=None, description="ISO 格式截止时间，空表示不限")


class AssessmentUpdateRequest(BaseModel):
    status: Optional[Literal["open", "closed"]] = None
    deadline: Optional[str] = None


class AssessmentItem(BaseModel):
    assessment_id: str
    title: str
    doc_id: str
    doc_file_name: str = ""
    question_count: int
    difficulty: str
    pass_accuracy: float
    deadline: Optional[str] = None
    status: str
    created_at: str


class AssessmentList(BaseModel):
    items: list[AssessmentItem]
    total: int
    page: int
    page_size: int


class MyAssessmentItem(AssessmentItem):
    my_status: Literal["pending", "done", "expired"] = "pending"
    record_count: int = 0
    best_accuracy: Optional[float] = None


class MyAssessmentList(BaseModel):
    items: list[MyAssessmentItem]
    total: int
    page: int
    page_size: int


class AssessmentStartResponse(BaseModel):
    assessment_id: str
    quiz_id: str
    title: str
    summary: str
    questions: list
    pass_accuracy: float
    deadline: Optional[str] = None


class AssessmentAnswerItem(BaseModel):
    question_id: str
    selected_answers: list[str]
    duration_ms: int = Field(ge=0)


class AssessmentSubmitRequest(BaseModel):
    quiz_id: str
    answers: list[AssessmentAnswerItem] = Field(min_length=1)


class AssessmentSubmitResponse(BaseModel):
    accuracy: float
    passed: bool
    report: dict


class AssessmentRecordItem(BaseModel):
    record_id: int
    assessment_id: str
    assessment_title: str = ""
    user_id: int
    username: str
    nickname: str
    department: str
    quiz_id: str
    accuracy: float
    passed: bool
    duration_seconds: int
    created_at: str


class AssessmentRecordList(BaseModel):
    items: list[AssessmentRecordItem]
    total: int
    page: int
    page_size: int
