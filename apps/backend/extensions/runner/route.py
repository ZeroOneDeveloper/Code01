import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import (
    OrganizationMember,
    ProblemSubmission,
    Quiz,
    QuizAttempt,
    QuizProblem,
)
from db.session import get_db

from .func import run_code_in_background


class ProblemSubmissionRequest(BaseModel):
    userId: str
    problemId: int
    code: str
    language: str
    visibility: str = "public"
    quizId: int | None = None


def _to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


router = APIRouter(
    prefix="/runner",
    tags=["runner"],
    responses={404: {"description": "Not found"}},
)


@router.get("/")
async def root():
    return {"message": "Hello, Runner!"}


@router.post("/")
async def run_code(
    problem_submission: ProblemSubmissionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = uuid.UUID(problem_submission.userId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid userId") from exc

    quiz_id: int | None = None
    quiz_attempt_started_at: datetime | None = None

    if problem_submission.quizId is not None:
        quiz_id = int(problem_submission.quizId)
        quiz = await db.get(Quiz, quiz_id)
        if quiz is None:
            raise HTTPException(status_code=404, detail="Quiz not found")

        now = datetime.now(timezone.utc)

        member_row = await db.execute(
            select(OrganizationMember.organization_id).where(
                OrganizationMember.organization_id == quiz.organization_id,
                OrganizationMember.user_id == user_id,
            )
        )
        if member_row.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Quiz access denied")

        published_at = _to_utc(quiz.published_at)
        start_at = _to_utc(quiz.start_at)
        end_at = _to_utc(quiz.end_at)

        if published_at is not None and now < published_at:
            raise HTTPException(status_code=403, detail="Quiz is not published yet")
        if start_at is not None and now < start_at:
            raise HTTPException(status_code=403, detail="Quiz has not started yet")

        quiz_problem_row = await db.execute(
            select(QuizProblem.id).where(
                QuizProblem.quiz_id == quiz.id,
                QuizProblem.problem_id == problem_submission.problemId,
            )
        )
        in_pool = quiz_problem_row.scalar_one_or_none() is not None
        in_legacy_pool = (
            quiz.global_problem_id is not None
            and int(quiz.global_problem_id) == int(problem_submission.problemId)
        )
        if not in_pool and not in_legacy_pool:
            raise HTTPException(status_code=403, detail="Problem is not assigned to this quiz")

        quiz_attempt_row = await db.execute(
            select(QuizAttempt.started_at).where(
                QuizAttempt.quiz_id == quiz.id,
                QuizAttempt.user_id == user_id,
            )
        )
        quiz_attempt_started_at = _to_utc(quiz_attempt_row.scalar_one_or_none())
        if quiz_attempt_started_at is None:
            raise HTTPException(
                status_code=403,
                detail="퀴즈 입장 후 제출할 수 있습니다. 퀴즈 페이지에서 먼저 입장해 주세요.",
            )

        effective_deadlines: list[datetime] = []
        if end_at is not None:
            effective_deadlines.append(end_at)
        if isinstance(quiz.time_limit_sec, int) and quiz.time_limit_sec > 0:
            effective_deadlines.append(
                quiz_attempt_started_at + timedelta(seconds=int(quiz.time_limit_sec))
            )

        if effective_deadlines and now > min(effective_deadlines):
            raise HTTPException(status_code=403, detail="Quiz submission window has ended")

    inserted = ProblemSubmission(
        user_id=user_id,
        problem_id=problem_submission.problemId,
        quiz_id=quiz_id,
        quiz_attempt_started_at=quiz_attempt_started_at,
        status_code=0,
        code=problem_submission.code,
        language=problem_submission.language,
        stdout_list=[],
        stderr_list=[],
        time_ms=0,
        memory_kb=0.0,
        passed_all=False,
        is_correct=False,
        passed_time_limit=False,
        passed_memory_limit=False,
        visibility=problem_submission.visibility,
        cases_total=0,
        cases_done=0,
    )

    db.add(inserted)
    await db.commit()
    await db.refresh(inserted)

    background_tasks.add_task(
        run_code_in_background,
        int(inserted.id),
        problem_submission.code,
        problem_submission.language,
        int(problem_submission.problemId),
    )

    return {
        "message": "Code is being processed in the background.",
        "pendingId": inserted.id,
        "quizAttemptStartedAt": inserted.quiz_attempt_started_at.isoformat()
        if inserted.quiz_attempt_started_at
        else None,
    }
