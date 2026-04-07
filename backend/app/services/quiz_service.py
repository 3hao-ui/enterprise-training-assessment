"""出题服务"""

import uuid
import structlog

from app.core.security import check_content
from app.core.exceptions import QuizGenerationError, ContentFilterError
from app.llm.quiz_chain import generate_quiz
from app.models.quiz import QuizGenerateRequest, QuizGenerateResponse

logger = structlog.get_logger()


async def handle_quiz_generate(req: QuizGenerateRequest) -> QuizGenerateResponse:
    # 内容安全检查
    if not check_content(req.user_input):
        raise ContentFilterError("输入内容包含不当内容，请修改后重试")

    try:
        quiz_output = await generate_quiz(
            user_input=req.user_input,
            question_count=req.question_count,
            difficulty=req.difficulty,
        )
    except Exception as e:
        logger.error("quiz_generation_failed", error=str(e))
        raise QuizGenerationError(f"题库生成失败：{e}") from e

    quiz_id = f"quiz_{uuid.uuid4().hex[:12]}"

    return QuizGenerateResponse(
        quiz_id=quiz_id,
        title=quiz_output.title,
        summary=quiz_output.summary,
        questions=quiz_output.questions,
    )
