from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from .func import (
    generate_unique_cases,
    load_generate_function,
    validate_generate_function,
)


class GenerateRequest(BaseModel):
    problem_id: int
    code: str
    count: int
    base_seed: int = 0


router = APIRouter(
    prefix="/testCase",
    tags=["testCase"],
    responses={404: {"description": "Not found"}},
)


@router.post("/generate")
async def generate_testcases(
    payload: GenerateRequest, background_tasks: BackgroundTasks
):
    try:
        generate_func = load_generate_function(payload.code, payload.base_seed)
        validate_generate_function(generate_func, payload.base_seed)
    except ValueError as exc:
        return {"error": str(exc)}
    except Exception as exc:
        return {"error": f"테스트 케이스 생성 중 오류 발생: {exc}"}

    background_tasks.add_task(
        generate_unique_cases,
        generate_func,
        int(payload.problem_id),
        int(payload.count),
        int(payload.base_seed),
    )

    return {
        "message": f"Started generating {payload.count} unique test cases for problem {payload.problem_id} in background."
    }
