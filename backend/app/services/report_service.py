"""报告服务"""

import structlog

from app.core.exceptions import ReportGenerationError
from app.llm.report_chain import generate_report
from app.models.report import ReportGenerateRequest, ReportGenerateResponse
from app.services.scoring_service import compute_score_summary

logger = structlog.get_logger()


async def handle_report_generate(
    req: ReportGenerateRequest,
) -> ReportGenerateResponse:
    score_summary = compute_score_summary(req.answer_records)

    try:
        report_output = await generate_report(
            topic=req.topic,
            questions=req.questions,
            answer_records=req.answer_records,
            score_summary=score_summary,
        )
    except Exception as e:
        logger.error("report_generation_failed", error=str(e))
        raise ReportGenerationError(f"报告生成失败：{e}") from e

    return ReportGenerateResponse(
        accuracy=report_output.accuracy,
        mastered_points=report_output.mastered_points,
        weak_points=report_output.weak_points,
        three_line_summary=report_output.three_line_summary,
        advice=report_output.advice,
        share_quote=report_output.share_quote,
    )
