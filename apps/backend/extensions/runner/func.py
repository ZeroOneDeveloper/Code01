import os
import logging
from supabase import AsyncClient
import httpx

# Piston API가 지원하는 언어와 최신 버전을 매핑합니다.
# 실제 Piston의 /runtimes 엔드포인트를 통해 동적으로 가져올 수도 있습니다.
LANGUAGE_VERSION_MAP = {
    "c": "10.2.0",
    "cpp": "10.2.0",
    "python": "3.12.0",
    "java": "15.0.2"
}

LANGUAGE_FILENAME_MAP = {
    "c": "main.c",
    "cpp": "main.cpp",
    "python": "main.py",
    "java": "Main.java"
}


def normalize_output(text: str) -> list[str]:
    return [line.strip() for line in text.strip().replace("\r\n", "\n").split("\n") if line.strip()]

async def run_code_in_background(
    supabase: AsyncClient,
    pendingId: int,
    code: str,
    language: str,
    problem_id: int,
):
    PISTON_API_URL = os.getenv("PISTON_API_URL", "http://piston:2000")
    
    try:
        problem = (
            await supabase.table("problems").select("time_limit, memory_limit").eq(
                "id", problem_id
            ).execute()
        ).data
        if not problem:
            raise ValueError(f"Problem with ID {problem_id} not found.")

        time_limit_ms = 20000 if problem[0].get("time_limit") is None else problem[0].get("time_limit")
        memory_limit_mb = 128 if problem[0].get("memory_limit") is None else problem[0].get("memory_limit")

        test_cases = (await supabase.table("test_cases").select("input, output").eq(
            "problem_id", problem_id
        ).execute()).data
        if not test_cases:
            raise ValueError(f"No test cases found for problem {problem_id}.")

        result_list = []
        
        async with httpx.AsyncClient() as client:
            for index, test_case in enumerate(test_cases):
                try:
                    filename = LANGUAGE_FILENAME_MAP.get(language)
                    if not filename:
                        raise ValueError(f"Unsupported language: {language}")
                    if not code:
                        raise ValueError("Code content is empty.")

                    payload = {
                        "language": language,
                        "version": LANGUAGE_VERSION_MAP.get(language, "*"),
                        "files": [{"name": filename, "content": code}],
                        "stdin": test_case.get("input", ""),
                        "run_timeout": time_limit_ms,
                        "compile_memory_limit": memory_limit_mb * 1024 * 1024,
                        "run_memory_limit": memory_limit_mb * 1024 * 1024,
                    }

                    response = await client.post(f"{PISTON_API_URL}/api/v2/execute", json=payload, timeout=time_limit_ms * 1000 + 5)
                    response.raise_for_status()
                    result = response.json()

                    if 'message' in result:
                        logging.error(f"Piston API message: {result['message']}")

                    run_result = result.get("run", {})
                    stdout = run_result.get("stdout", "").strip()
                    stderr = run_result.get("stderr", "")
                    exit_code = run_result.get("code", 0)
                    status = run_result.get("status")
                    memory = run_result.get("memory") or 0
                    wall_time = run_result.get("wall_time", 0)

                    expected_output = normalize_output(test_case.get("output", ""))
                    actual_output = normalize_output(stdout)

                    is_correct = expected_output == actual_output

                    is_timeout = status == 'TO'
                    is_memory_exceeded = status == ""

                    result_list.append({
                        "stdout": stdout,
                        "stderr": stderr,
                        "is_correct": is_correct,
                        "is_timeout": is_timeout,
                        "is_memory_over": is_memory_exceeded,
                        "exit_code": exit_code,
                        "runtime_ms": wall_time,  # piston에서 안 주므로 0으로 두되, DB 필드는 유지
                        "memory_kb": memory,  # piston에서 안 주므로 0으로 두되, DB 필드는 유지
                    })

                except httpx.ReadTimeout:
                    result_list.append({
                        "stdout": "",
                        "stderr": "Request to Piston API timed out.",
                        "is_correct": False,
                        "is_timeout": True,
                        "exit_code": -1,
                        "runtime_ms": time_limit_ms,
                        "memory_kb": 0,
                    })
                except Exception as api_err:
                    logging.error(f"Piston API call failed: {api_err}")
                    result_list.append({
                        "stdout": "",
                        "stderr": str(api_err),
                        "is_correct": False,
                        "is_timeout": False,
                        "exit_code": -1,
                        "runtime_ms": 0,
                        "memory_kb": 0,
                    })

                # Update progress in DB
                await supabase.table("problem_submissions").update(
                    {"cases_done": index + 1, "cases_total": len(test_cases)}
                ).eq("id", pendingId).execute()

        # Final result determination
        is_correct_all = all(r["is_correct"] for r in result_list)
        is_time_limit_exceeded = any(r["is_timeout"] for r in result_list)
        is_memory_limit_exceeded = any(r.get("is_memory_over", False) for r in result_list)
        # Consider non-zero exit code as a runtime error, unless it was a timeout
        is_runtime_error = any(r["exit_code"] != 0 and not r["is_timeout"] for r in result_list)

        status_code = 7  # InternalError (초기값 유지)

        if is_time_limit_exceeded:
            status_code = 3  # TimeLimitExceeded
        elif is_memory_limit_exceeded:
            status_code = 4  # MemoryLimitExceeded
        elif is_runtime_error:
            status_code = 5  # RuntimeError
        elif not is_correct_all:
            status_code = 2  # WrongAnswer
        elif is_correct_all:
            status_code = 1  # Accepted

        max_runtime_ms = max([r.get("runtime_ms", 0) for r in result_list]) if result_list else 0
        max_memory_kb = max([r.get("memory_kb", 0) for r in result_list]) if result_list else 0

        await supabase.table("problem_submissions").update({
            "passed_all": status_code == 1,
            "stdout_list": [r["stdout"] for r in result_list],
            "stderr_list": [r["stderr"] for r in result_list],
            "passed_time_limit": not is_time_limit_exceeded,
            "passed_memory_limit": max_memory_kb < (memory_limit_mb * 1024),
            "is_correct": is_correct_all,
            "status_code": status_code,
            "memory_kb": max_memory_kb,
            "time_ms": max_runtime_ms,
        }).eq("id", pendingId).execute()

    except Exception as e:
        logging.error(f"Error processing submission {pendingId}: {e}")
        try:
            await supabase.table("problem_submissions").update({
                "status_code": 7, # InternalError
                "stderr_list": [str(e)]
            }).eq("id", pendingId).execute()
        except Exception as db_e:
            logging.error(f"Failed to update DB for submission {pendingId} on error: {db_e}")
