"""考核任务 API 集成测试（大模型与数据库均 mock）"""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import create_token
from app.main import app
from app.models.quiz import Question, QuestionOption
from app.llm.report_chain import ReportOutput

ADMIN = {
    "id": 2, "openid": None, "nickname": "培训管理员", "avatar_url": "", "total_xp": 0,
    "username": "admin", "role": "admin", "department": "", "status": 1,
}
EMP = {
    "id": 3, "openid": None, "nickname": "张三", "avatar_url": "", "total_xp": 0,
    "username": "emp001", "role": "employee", "department": "研发部", "status": 1,
}


def _header(user: dict) -> dict:
    return {"Authorization": f"Bearer {create_token(user_id=user['id'], openid='', role=user['role'])}"}


def _patch_current(user: dict):
    return patch(
        "app.core.auth.user_repository.get_user_by_id", new=AsyncMock(return_value=user)
    )


def _question():
    return Question(
        id="q1",
        type="single",
        stem="TCP 建立连接需要几次握手？",
        options=[QuestionOption(key="A", text="两次"), QuestionOption(key="B", text="三次")],
        answer=["B"],
        explanation="三次握手",
        knowledge_point="TCP",
        difficulty="easy",
    )


def _report_output():
    return ReportOutput(
        accuracy=100,
        mastered_points=["TCP"],
        weak_points=[],
        three_line_summary=["a", "b", "c"],
        advice=["d"],
        share_quote="e",
    )


@pytest.mark.asyncio
class TestAssessmentAdminAPI:
    async def test_create_requires_ready_doc(self):
        with _patch_current(ADMIN), patch(
            "app.services.assessment_service.knowledge_repository.get_document",
            new=AsyncMock(return_value={"doc_id": "doc_1", "status": "processing"}),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/admin/assessments",
                    headers=_header(ADMIN),
                    json={"title": "TCP 考核", "doc_id": "doc_1"},
                )
        assert resp.status_code == 400
        assert "解析" in resp.json()["message"]

    async def test_create_success(self):
        with _patch_current(ADMIN), patch(
            "app.services.assessment_service.knowledge_repository.get_document",
            new=AsyncMock(return_value={"doc_id": "doc_1", "status": "ready"}),
        ), patch(
            "app.services.assessment_service.assessment_repository.create_assessment",
            new=AsyncMock(),
        ) as mock_create:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/admin/assessments",
                    headers=_header(ADMIN),
                    json={"title": "TCP 考核", "doc_id": "doc_1", "pass_accuracy": 80},
                )
        assert resp.status_code == 200
        assert resp.json()["data"]["assessment_id"].startswith("asmt_")
        assert mock_create.call_args.kwargs["pass_accuracy"] == 80

    async def test_employee_cannot_create(self):
        with _patch_current(EMP):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/admin/assessments",
                    headers=_header(EMP),
                    json={"title": "x", "doc_id": "doc_1"},
                )
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestAssessmentEmployeeAPI:
    async def test_start_rejects_closed(self):
        with _patch_current(EMP), patch(
            "app.services.assessment_service.assessment_repository.get_assessment",
            new=AsyncMock(return_value={"assessment_id": "asmt_1", "status": "closed",
                                        "deadline": "", "title": "t", "doc_id": "d",
                                        "question_count": 5, "difficulty": "mixed",
                                        "pass_accuracy": 60.0, "doc_file_name": "",
                                        "created_at": ""}),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/assessments/asmt_1/start", headers=_header(EMP)
                )
        assert resp.status_code == 400
        assert "关闭" in resp.json()["message"]

    async def test_start_rejects_expired(self):
        with _patch_current(EMP), patch(
            "app.services.assessment_service.assessment_repository.get_assessment",
            new=AsyncMock(return_value={"assessment_id": "asmt_1", "status": "open",
                                        "deadline": "2020-01-01 00:00:00", "title": "t",
                                        "doc_id": "d", "question_count": 5,
                                        "difficulty": "mixed", "pass_accuracy": 60.0,
                                        "doc_file_name": "", "created_at": ""}),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/assessments/asmt_1/start", headers=_header(EMP)
                )
        assert resp.status_code == 400
        assert "截止" in resp.json()["message"]

    async def test_submit_grades_server_side(self):
        """正确率必须由服务端按标准答案判定，忽略客户端任何声明。"""
        questions = [_question()]
        with _patch_current(EMP), patch(
            "app.services.assessment_service.assessment_repository.get_assessment",
            new=AsyncMock(return_value={"assessment_id": "asmt_1", "status": "open",
                                        "deadline": "", "title": "TCP 考核",
                                        "pass_accuracy": 60.0}),
        ), patch(
            "app.services.assessment_service.quiz_repository.get_quiz_detail",
            new=AsyncMock(return_value={
                "quiz_id": "quiz_1", "title": "t", "summary": "s",
                "questions": [q.model_dump() for q in questions],
            }),
        ), patch(
            "app.services.assessment_service.generate_report",
            new=AsyncMock(return_value=_report_output()),
        ), patch(
            "app.services.assessment_service.quiz_repository.save_answer_record",
            new=AsyncMock(),
        ), patch(
            "app.services.assessment_service.quiz_repository.save_report",
            new=AsyncMock(),
        ), patch(
            "app.services.assessment_service.assessment_repository.add_record",
            new=AsyncMock(),
        ) as mock_record:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/assessments/asmt_1/submit",
                    headers=_header(EMP),
                    json={
                        "quiz_id": "quiz_1",
                        "answers": [
                            {"question_id": "q1", "selected_answers": ["B"], "duration_ms": 5000}
                        ],
                    },
                )
        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["accuracy"] == 100
        assert body["passed"] is True
        assert mock_record.call_args.kwargs["duration_seconds"] == 5

    async def test_submit_wrong_answer_not_passed(self):
        questions = [_question()]
        with _patch_current(EMP), patch(
            "app.services.assessment_service.assessment_repository.get_assessment",
            new=AsyncMock(return_value={"assessment_id": "asmt_1", "status": "open",
                                        "deadline": "", "title": "TCP 考核",
                                        "pass_accuracy": 60.0}),
        ), patch(
            "app.services.assessment_service.quiz_repository.get_quiz_detail",
            new=AsyncMock(return_value={
                "quiz_id": "quiz_1", "title": "t", "summary": "s",
                "questions": [q.model_dump() for q in questions],
            }),
        ), patch(
            "app.services.assessment_service.generate_report",
            new=AsyncMock(return_value=_report_output()),
        ), patch(
            "app.services.assessment_service.quiz_repository.save_answer_record",
            new=AsyncMock(),
        ), patch(
            "app.services.assessment_service.quiz_repository.save_report",
            new=AsyncMock(),
        ), patch(
            "app.services.assessment_service.assessment_repository.add_record",
            new=AsyncMock(),
        ) as mock_record:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/v1/assessments/asmt_1/submit",
                    headers=_header(EMP),
                    json={
                        "quiz_id": "quiz_1",
                        "answers": [
                            {"question_id": "q1", "selected_answers": ["A"], "duration_ms": 1000}
                        ],
                    },
                )
        body = resp.json()["data"]
        assert body["accuracy"] == 0
        assert body["passed"] is False
        assert mock_record.call_args.kwargs["passed"] is False
