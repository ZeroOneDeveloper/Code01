import os
import logging
from supabase import AsyncClient
import httpx

# Piston API가 지원하는 언어와 최신 버전을 매핑합니다.
# 실제 Piston의 /runtimes 엔드포인트를 통해 동적으로 가져올 수도 있습니다.
LANGUAGE_VERSION_MAP = {
    "c": "10.2.0",
    "cpp": "10.2.0",
    "python": "3.10.0",
    "javascript": "18.15.0",
    "java": "15.0.2",
    "go": "1.16.2",
    "rust": "1.68.2",
}

LANGUAGE_FILENAME_MAP = {
    "c": "main.c",
    "cpp": "main.cpp",
    "python": "main.py",
    "javascript": "main.js",
    "java": "Main.java",
    "go": "main.go",
    "rust": "main.rs",
}

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

        time_limit_sec = problem[0].get("time_limit") or 20
        memory_limit_mb = problem[0].get("memory_limit") or 128

        test_cases = (await supabase.table("test_cases").select("input, output").eq(
            "problem_id", problem_id
        ).execute()).data
        if not test_cases:
            raise ValueError(f"No test cases found for problem {problem_id}.")

        result_list = []
        
        async with httpx.AsyncClient() as client:
            for index, test_case in enumerate(test_cases):
                try:
                    payload = {
                        "language": language,
                        "version": LANGUAGE_VERSION_MAP.get(language, "*"),
                        "files": [{"name": LANGUAGE_FILENAME_MAP.get(language, "main.txt"), "content": code}],
                        "stdin": test_case.get("input", ""),
                        "args": [],
                        "compile_timeout": 10000,
                        "run_timeout": time_limit_sec * 1000,  # Piston uses milliseconds
                        "compile_memory_limit": -1,
                        "run_memory_limit": memory_limit_mb * 1024 * 1024,  # Piston uses bytes
                    }
                    
                    response = await client.post(f"{PISTON_API_URL}/api/v2/execute", json=payload, timeout=time_limit_sec + 5)
                    response.raise_for_status()
                    result = response.json()

                    run_result = result.get("run", {})
                    stdout = run_result.get("stdout", "").strip()
                    stderr = run_result.get("stderr", "").strip()
                    exit_code = run_result.get("code", 0)
                    runtime_ms = run_result.get("runtime", 0)
                    memory_bytes = run_result.get("memory", 0)
                    
                    is_correct = stdout == test_case.get("output", "").strip()
                    # Piston returns signal "SIGKILL" for timeout
                    is_timeout = run_result.get("signal") == "SIGKILL"

                    result_list.append({
                        "stdout": stdout,
                        "stderr": stderr,
                        "is_correct": is_correct,
                        "is_timeout": is_timeout,
                        "exit_code": exit_code,
                        "runtime_ms": runtime_ms,
                        "memory_kb": memory_bytes / 1024 if memory_bytes else 0,
                    })

                except httpx.ReadTimeout:
                    result_list.append({
                        "stdout": "",
                        "stderr": "Request to Piston API timed out.",
                        "is_correct": False,
                        "is_timeout": True,
                        "exit_code": -1,
                        "runtime_ms": time_limit_sec * 1000,
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
        # Consider non-zero exit code as a runtime error, unless it was a timeout
        is_runtime_error = any(r["exit_code"] != 0 and not r["is_timeout"] for r in result_list)

        status_code = 7 # InternalError by default
        if is_time_limit_exceeded:
            status_code = 3 # TimeLimitExceeded
        elif is_runtime_error:
            status_code = 5 # RuntimeError
        elif not is_correct_all:
            status_code = 2 # WrongAnswer
        elif is_correct_all:
            status_code = 1 # Accepted

        max_runtime_ms = max([r.get("runtime_ms", 0) for r in result_list]) if result_list else 0
        max_memory_kb = max([r.get("memory_kb", 0) for r in result_list]) if result_list else 0

        await supabase.table("problem_submissions").update({
            "status_code": status_code,
            "stdout_list": [r["stdout"] for r in result_list],
            "stderr_list": [r["stderr"] for r in result_list],
            "passed_all": status_code == 1,
            "time_ms": max_runtime_ms,
            "memory_kb": max_memory_kb,
            "passed_time_limit": not is_time_limit_exceeded,
            "passed_memory_limit": max_memory_kb < (memory_limit_mb * 1024),
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