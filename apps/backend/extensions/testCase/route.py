from fastapi import APIRouter, BackgroundTasks

import os
from pydantic import BaseModel
from supabase import acreate_client, AsyncClient

from .func import load_generate_function, generate_unique_cases


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
    supabase: AsyncClient = await acreate_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_PUBLISHABLE_KEY"),
    )

    try:
        generate_func = load_generate_function(payload.code, payload.base_seed)
        print(
            await generate_unique_cases(
                supabase=supabase,
                generate_func=generate_func,
                problem_id=payload.problem_id,
                count=1,
                base_seed=payload.base_seed,
            )
        )
    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"테스트 케이스 생성 중 오류 발생: {e}"}

    background_tasks.add_task(
        generate_unique_cases,
        supabase,
        generate_func,
        int(payload.problem_id),
        int(payload.count),
        int(payload.base_seed),
    )

    return {
        "message": f"Started generating {payload.count} unique test cases for problem {payload.problem_id} in background."
    }
