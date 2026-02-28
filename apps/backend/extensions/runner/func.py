import logging
import os

import httpx
from sqlalchemy import select

from db.models import Problem, ProblemSubmission, TestCase
from db.session import SessionLocal

# Piston의 설치 버전에 종속되지 않도록 version은 "*"로 요청합니다.
# (설치된 런타임 중 최신 호환 버전을 자동 선택)
LANGUAGE_VERSION_MAP = {
    "c": "*",
    "cpp": "*",
    "python": "*",
    "java": "*",
}

LANGUAGE_FILENAME_MAP = {
    "c": "main.c",
    "cpp": "main.cpp",
    "python": "main.py",
    "java": "Main.java",
}


def normalize_output(text: str) -> list[str]:
    return [
        line.strip()
        for line in text.strip().replace("\r\n", "\n").split("\n")
        if line.strip()
    ]


def normalize_memory_kb(raw_memory: object) -> float:
    """Piston run.memory is bytes. Persist as KB in DB."""
    try:
        value = float(raw_memory or 0)
    except (TypeError, ValueError):
        return 0.0
    if value <= 0:
        return 0.0
    return value / 1024.0


async def _mark_internal_error(pending_id: int, message: str) -> None:
    async with SessionLocal() as db:
        submission = await db.get(ProblemSubmission, pending_id)
        if not submission:
            return
        submission.status_code = 7  # InternalError
        submission.stderr_list = [message]
        await db.commit()


async def run_code_in_background(
    pending_id: int,
    code: str,
    language: str,
    problem_id: int,
):
    PISTON_API_URL = os.getenv("PISTON_API_URL", "http://piston:2000")

    try:
        async with SessionLocal() as db:
            problem = await db.get(Problem, problem_id)
            if not problem:
                raise ValueError(f"Problem with ID {problem_id} not found.")

            submission = await db.get(ProblemSubmission, pending_id)
            if not submission:
                raise ValueError(f"Submission with ID {pending_id} not found.")

            time_limit_ms = 20000 if problem.time_limit is None else problem.time_limit
            memory_limit_mb = 128 if problem.memory_limit is None else problem.memory_limit
            run_memory_limit_bytes = memory_limit_mb * 1024 * 1024
            # 컴파일 단계는 런타임 메모리 제한보다 여유를 둡니다.
            compile_memory_limit_bytes = max(run_memory_limit_bytes, 512 * 1024 * 1024)

            test_cases_result = await db.execute(
                select(TestCase).where(TestCase.problem_id == problem_id)
            )
            test_cases = list(test_cases_result.scalars().all())
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
                            "stdin": test_case.input,
                            "run_timeout": time_limit_ms,
                            "compile_memory_limit": compile_memory_limit_bytes,
                            "run_memory_limit": run_memory_limit_bytes,
                        }

                        response = await client.post(
                            f"{PISTON_API_URL}/api/v2/execute",
                            json=payload,
                            timeout=(time_limit_ms / 1000) + 5,
                        )
                        if response.status_code >= 400:
                            try:
                                err_payload = response.json()
                            except Exception:
                                err_payload = None
                            err_message = (
                                err_payload.get("message")
                                if isinstance(err_payload, dict)
                                else None
                            )
                            result_list.append(
                                {
                                    "stdout": "",
                                    "stderr": err_message
                                    or f"Piston API request failed ({response.status_code})",
                                    "is_correct": False,
                                    "is_timeout": False,
                                    "is_memory_over": False,
                                    "exit_code": -1,
                                    "runtime_ms": 0,
                                    "memory_kb": 0,
                                }
                            )
                            submission.cases_done = index + 1
                            submission.cases_total = len(test_cases)
                            await db.commit()
                            continue

                        result = response.json()

                        if "message" in result:
                            logging.error(f"Piston API message: {result['message']}")

                        run_result = result.get("run", {})
                        stdout = run_result.get("stdout", "").strip()
                        stderr = run_result.get("stderr", "")
                        exit_code = run_result.get("code", 0)
                        status = run_result.get("status")
                        memory_bytes = run_result.get("memory") or 0
                        memory_kb = normalize_memory_kb(memory_bytes)
                        wall_time = run_result.get("wall_time", 0)

                        expected_output = normalize_output(test_case.output)
                        actual_output = normalize_output(stdout)

                        is_correct = expected_output == actual_output

                        is_timeout = status == "TO"
                        is_memory_exceeded = status == ""

                        result_list.append(
                            {
                                "stdout": stdout,
                                "stderr": stderr,
                                "is_correct": is_correct,
                                "is_timeout": is_timeout,
                                "is_memory_over": is_memory_exceeded,
                                "exit_code": exit_code,
                                "runtime_ms": wall_time,
                                "memory_kb": memory_kb,
                            }
                        )

                    except httpx.ReadTimeout:
                        result_list.append(
                            {
                                "stdout": "",
                                "stderr": "Request to Piston API timed out.",
                                "is_correct": False,
                                "is_timeout": True,
                                "exit_code": -1,
                                "runtime_ms": time_limit_ms,
                                "memory_kb": 0,
                            }
                        )
                    except Exception as api_err:
                        logging.error(f"Piston API call failed: {api_err}")
                        result_list.append(
                            {
                                "stdout": "",
                                "stderr": str(api_err),
                                "is_correct": False,
                                "is_timeout": False,
                                "exit_code": -1,
                                "runtime_ms": 0,
                                "memory_kb": 0,
                            }
                        )

                    submission.cases_done = index + 1
                    submission.cases_total = len(test_cases)
                    await db.commit()

            is_correct_all = all(r["is_correct"] for r in result_list)
            is_time_limit_exceeded = any(r["is_timeout"] for r in result_list)
            is_memory_limit_exceeded = any(
                r.get("is_memory_over", False) for r in result_list
            )
            is_runtime_error = any(
                r["exit_code"] != 0 and not r["is_timeout"] for r in result_list
            )

            status_code = 7  # InternalError

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

            max_runtime_ms = (
                max([r.get("runtime_ms", 0) for r in result_list]) if result_list else 0
            )
            max_memory_kb = (
                max([r.get("memory_kb", 0) for r in result_list]) if result_list else 0
            )

            submission.passed_all = status_code == 1
            submission.stdout_list = [r["stdout"] for r in result_list]
            submission.stderr_list = [r["stderr"] for r in result_list]
            submission.passed_time_limit = not is_time_limit_exceeded
            submission.passed_memory_limit = max_memory_kb < (memory_limit_mb * 1024)
            submission.is_correct = is_correct_all
            submission.status_code = status_code
            submission.memory_kb = max_memory_kb
            submission.time_ms = max_runtime_ms

            await db.commit()

    except Exception as e:
        logging.error(f"Error processing submission {pending_id}: {e}")
        try:
            await _mark_internal_error(pending_id, str(e))
        except Exception as db_err:
            logging.error(
                f"Failed to update DB for submission {pending_id} on error: {db_err}"
            )
