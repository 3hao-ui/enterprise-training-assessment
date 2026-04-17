"""出题服务"""

import asyncio
import uuid
from typing import Optional

import structlog

from app.core.security import check_content
from app.core.exceptions import QuizGenerationError, ContentFilterError
from app.llm.quiz_chain import generate_quiz
from app.models.quiz import (
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizTaskCreateResponse,
    QuizTaskStatusResponse,
)
from app.repositories import quiz_repository
from app.repositories import task_repository
from app.services.search_service import fetch_knowledge_context

logger = structlog.get_logger()


async def handle_quiz_generate(
    req: QuizGenerateRequest,
    user_id: Optional[int] = None,
) -> QuizGenerateResponse:
    # 内容安全检查
    if not check_content(req.user_input):
        raise ContentFilterError("输入内容包含不当内容，请修改后重试")

    # 联网搜索获取参考资料
    search_context = await fetch_knowledge_context(req.user_input)

    try:
        quiz_output = await generate_quiz(
            user_input=req.user_input,
            question_count=req.question_count,
            difficulty=req.difficulty,
            search_context=search_context,
        )
    except Exception as e:
        logger.error("quiz_generation_failed", error=str(e))
        raise QuizGenerationError(f"题库生成失败：{e}") from e

    quiz_id = f"quiz_{uuid.uuid4().hex[:12]}"

    # 有登录态时落库
    if user_id is not None:
        try:
            await quiz_repository.save_quiz_session(
                quiz_id=quiz_id,
                user_id=user_id,
                title=quiz_output.title,
                summary=quiz_output.summary,
                user_input=req.user_input,
                questions_json=[q.model_dump() for q in quiz_output.questions],
            )
        except Exception as e:
            logger.error("quiz_session_save_failed", error=str(e))

    return QuizGenerateResponse(
        quiz_id=quiz_id,
        title=quiz_output.title,
        summary=quiz_output.summary,
        questions=quiz_output.questions,
    )


# ---- 异步任务模式 ----

async def create_quiz_task(
    req: QuizGenerateRequest,
    user_id: Optional[int] = None,
) -> QuizTaskCreateResponse:
    """创建异步出题任务，立即返回 task_id"""
    if not check_content(req.user_input):
        raise ContentFilterError("输入内容包含不当内容，请修改后重试")

    task_id = f"task_{uuid.uuid4().hex[:12]}"

    await task_repository.create_task(
        task_id=task_id,
        user_id=user_id,
        user_input=req.user_input,
        question_count=req.question_count,
        difficulty=req.difficulty,
    )

    # 在后台启动生成任务
    asyncio.create_task(_run_quiz_task(task_id, req, user_id))

    return QuizTaskCreateResponse(task_id=task_id)


async def _run_quiz_task(
    task_id: str,
    req: QuizGenerateRequest,
    user_id: Optional[int],
) -> None:
    """后台执行出题任务"""
    try:
        await task_repository.update_task_status(task_id, "running")
        logger.info("quiz_task_started", task_id=task_id)

        # 联网搜索获取参考资料
        search_context = await fetch_knowledge_context(req.user_input)

        # 生成题目
        quiz_output = await generate_quiz(
            user_input=req.user_input,
            question_count=req.question_count,
            difficulty=req.difficulty,
            search_context=search_context,
        )

        quiz_id = f"quiz_{uuid.uuid4().hex[:12]}"

        # 有登录态时落库
        if user_id is not None:
            try:
                await quiz_repository.save_quiz_session(
                    quiz_id=quiz_id,
                    user_id=user_id,
                    title=quiz_output.title,
                    summary=quiz_output.summary,
                    user_input=req.user_input,
                    questions_json=[q.model_dump() for q in quiz_output.questions],
                )
            except Exception as e:
                logger.error("quiz_session_save_failed", task_id=task_id, error=str(e))

        result = QuizGenerateResponse(
            quiz_id=quiz_id,
            title=quiz_output.title,
            summary=quiz_output.summary,
            questions=quiz_output.questions,
        )

        await task_repository.update_task_status(
            task_id, "completed", result_json=result.model_dump()
        )
        logger.info("quiz_task_completed", task_id=task_id, quiz_id=quiz_id)

    except Exception as e:
        logger.error("quiz_task_failed", task_id=task_id, error=str(e))
        await task_repository.update_task_status(
            task_id, "failed", error_message=str(e)[:500]
        )


async def get_quiz_task_status(task_id: str) -> QuizTaskStatusResponse:
    """查询任务状态"""
    row = await task_repository.get_task(task_id)
    if row is None:
        raise QuizGenerationError("任务不存在")

    result = None
    if row["status"] == "completed" and row.get("result_json"):
        result = QuizGenerateResponse.model_validate(row["result_json"])

    return QuizTaskStatusResponse(
        task_id=row["task_id"],
        status=row["status"],
        result=result,
        error_message=row.get("error_message"),
    )
