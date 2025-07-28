from fastapi import APIRouter, BackgroundTasks

import os
from pydantic import BaseModel
from supabase import create_async_client, AsyncClient

from extensions.runner.func import run_code_in_background


class ProblemSubmission(BaseModel):
    userId: str
    problemId: str
    code: str
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
    problem_submission: ProblemSubmission, background_tasks: BackgroundTasks
):
    supabase: AsyncClient = await create_async_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_PUBLISHABLE_KEY"),
    )

    inserted = await supabase.table("problem_submissions").insert(
        {
            "user_id": problem_submission.userId,
            "problem_id": problem_submission.problemId,
            "status_code": 0,
            "code": problem_submission.code,
            "stdout_list": [],
            "stderr_list": [],
            "time_ms": 0,
            "memory_kb": 0.0,
            "passed_all": False,
            "is_correct": False,
            "passed_time_limit": False,
            "passed_memory_limit": False,
            "visibility": problem_submission.visibility,
        }
    ).execute()
    background_tasks.add_task(
        run_code_in_background,
        supabase,
        inserted.data[0]['id'],
        problem_submission.code,
        problem_submission.problemId,
    )
    return {"message": "Code is being processed in the background."}
