import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ProblemSubmission
from db.session import get_db

from .func import run_code_in_background


class ProblemSubmissionRequest(BaseModel):
    userId: str
    problemId: int
    code: str
    language: str
    visibility: str = "public"


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

    inserted = ProblemSubmission(
        user_id=user_id,
        problem_id=problem_submission.problemId,
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
    }
