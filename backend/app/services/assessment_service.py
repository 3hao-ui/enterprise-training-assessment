"""考核任务服务"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

import structlog

from app.core.config import get_settings
from app.core.exceptions import BusinessError
from app.llm.report_chain import generate_report
from app.models.assessment import (
    AssessmentCreateRequest,
    AssessmentItem,
    AssessmentList,
    AssessmentRecordItem,
    AssessmentRecordList,
    AssessmentStartResponse,
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
    AssessmentUpdateRequest,
    MyAssessmentItem,
    MyAssessmentList,
)
from app.models.quiz import AnswerRecord, Question, QuizGenerateRequest
from app.repositories import assessment_repository, knowledge_repository, quiz_repository
from app.services.quiz_service import handle_quiz_generate
from app.services.scoring_service import compute_score_summary
from app.utils.id_generator import gen_assessment_id

logger = structlog.get_logger()


def _parse_deadline(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        raise BusinessError("截止时间格式不正确，应为 ISO 格式如 2026-12-31T18:00:00")


def _is_expired(item: dict) -> bool:
    return bool(item["deadline"]) and datetime.now() > datetime.strptime(
        item["deadline"], "%Y-%m-%d %H:%M:%S"
    )


def _parse_session_start(raw: Optional[str]) -> Optional[datetime]:
    """解析 quiz_sessions.created_at；解析失败时返回 None 放行，
    不能因为时间格式问题把正常提交卡死。"""
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        logger.warning("session_start_unparsable", raw=raw)
        return None


async def create_assessment(admin: dict, req: AssessmentCreateRequest) -> dict:
    doc = await knowledge_repository.get_document(req.doc_id, admin["id"])
    if doc is None:
        raise BusinessError("培训资料不存在")
    if doc["status"] != "ready":
        raise BusinessError("培训资料尚未解析完成，请稍后再发布")

    assessment_id = gen_assessment_id()
    await assessment_repository.create_assessment(
        assessment_id=assessment_id,
        title=req.title,
        doc_id=req.doc_id,
        question_count=req.question_count,
        difficulty=req.difficulty,
        pass_accuracy=req.pass_accuracy,
        deadline=_parse_deadline(req.deadline),
        created_by=admin["id"],
    )
    logger.info("assessment_created", assessment_id=assessment_id, by=admin["id"])
    return {"assessment_id": assessment_id}


async def list_assessments(page: int, page_size: int, status: str) -> AssessmentList:
    items, total = await assessment_repository.list_assessments(page, page_size, status)
    return AssessmentList(
        items=[AssessmentItem(**i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


async def update_assessment(assessment_id: str, req: AssessmentUpdateRequest) -> None:
    existing = await assessment_repository.get_assessment(assessment_id)
    if existing is None:
        raise BusinessError("考核任务不存在")
    await assessment_repository.update_assessment(
        assessment_id,
        status=req.status,
        deadline=_parse_deadline(req.deadline) if req.deadline is not None else None,
    )


async def list_my_assessments(user_id: int, page: int, page_size: int) -> MyAssessmentList:
    items, total = await assessment_repository.list_my_assessments(user_id, page, page_size)
    result = []
    for item in items:
        if item["record_count"] > 0:
            my_status = "done"
        elif item["status"] != "open" or _is_expired(item):
            my_status = "expired"
        else:
            my_status = "pending"
        result.append(MyAssessmentItem(**item, my_status=my_status))
    return MyAssessmentList(items=result, total=total, page=page, page_size=page_size)


async def start_assessment(user: dict, assessment_id: str) -> AssessmentStartResponse:
    assessment = await assessment_repository.get_assessment(assessment_id)
    if assessment is None:
        raise BusinessError("考核任务不存在")
    if assessment["status"] != "open":
        raise BusinessError("考核已关闭")
    if _is_expired(assessment):
        raise BusinessError("考核已截止")

    quiz = await handle_quiz_generate(
        QuizGenerateRequest(
            user_input=assessment["title"],
            question_count=assessment["question_count"],
            difficulty=assessment["difficulty"],
            doc_id=assessment["doc_id"],
            generate_images=False,
        ),
        user_id=user["id"],
        doc_owner_id=assessment.get("created_by"),
    )
    return AssessmentStartResponse(
        assessment_id=assessment_id,
        quiz_id=quiz.quiz_id,
        title=quiz.title,
        summary=quiz.summary,
        questions=[q.model_dump() for q in quiz.questions],
        pass_accuracy=assessment["pass_accuracy"],
        deadline=assessment["deadline"] or None,
    )


async def submit_assessment(
    user: dict, assessment_id: str, req: AssessmentSubmitRequest
) -> AssessmentSubmitResponse:
    assessment = await assessment_repository.get_assessment(assessment_id)
    if assessment is None:
        raise BusinessError("考核任务不存在")

    detail = await quiz_repository.get_quiz_detail(req.quiz_id, user["id"])
    if detail is None:
        raise BusinessError("答题会话不存在")

    # 作答窗口按「开始考核」的时间起算，而不是比对 deadline：
    # 后者会误伤在截止前开始、正常作答中跨过截止点的人
    window = get_settings().assessment_window_minutes
    started_at = _parse_session_start(detail.get("created_at"))
    if started_at and datetime.now() - started_at > timedelta(minutes=window):
        raise BusinessError(f"作答已超过 {window} 分钟，本次提交无效，请重新参加考核")

    questions = [Question(**q) for q in detail["questions"]]
    answers = {a.question_id: a for a in req.answers}

    graded: list[AnswerRecord] = []
    for question in questions:
        submitted = answers.get(question.id)
        selected = sorted(submitted.selected_answers) if submitted else []
        graded.append(
            AnswerRecord(
                question_id=question.id,
                selected_answers=selected,
                is_correct=selected == sorted(question.answer),
                duration_ms=submitted.duration_ms if submitted else 0,
            )
        )

    summary = compute_score_summary(graded)
    passed = summary["accuracy"] >= assessment["pass_accuracy"]
    duration_seconds = sum(r.duration_ms for r in graded) // 1000

    report_output = await generate_report(
        topic=assessment["title"],
        questions=questions,
        answer_records=graded,
        score_summary=summary,
    )

    await quiz_repository.save_answer_record(
        quiz_id=req.quiz_id,
        user_id=user["id"],
        records_json=[r.model_dump() for r in graded],
        total_questions=summary["total"],
        correct_count=summary["correct"],
        accuracy=summary["accuracy"],
    )
    await quiz_repository.save_report(
        quiz_id=req.quiz_id,
        user_id=user["id"],
        report_json=report_output.model_dump(),
    )
    await assessment_repository.add_record(
        assessment_id=assessment_id,
        user_id=user["id"],
        quiz_id=req.quiz_id,
        accuracy=summary["accuracy"],
        passed=passed,
        duration_seconds=duration_seconds,
    )
    logger.info(
        "assessment_submitted",
        assessment_id=assessment_id,
        user_id=user["id"],
        accuracy=summary["accuracy"],
        passed=passed,
    )
    return AssessmentSubmitResponse(
        accuracy=summary["accuracy"],
        passed=passed,
        report=report_output.model_dump(),
    )


async def list_records(
    page: int, page_size: int, assessment_id: str = "", user_id: Optional[int] = None
) -> AssessmentRecordList:
    items, total = await assessment_repository.list_records(
        page, page_size, assessment_id, user_id
    )
    return AssessmentRecordList(
        items=[AssessmentRecordItem(**i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )
