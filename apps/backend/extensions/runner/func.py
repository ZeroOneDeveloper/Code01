import os
import re
import uuid
import time
import logging
import subprocess
from supabase import AsyncClient
import tempfile
import shutil
import math


def parse_time_E(time_str):
    match = re.match(r"(\d+):(\d+):([0-9.]+)", time_str)
    if not match:
        return None
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


async def run_code_in_background(
    supabase: AsyncClient,
    pendingId: int,
    code: str,
    problem_id: int,
):
    problem = (
        await supabase.table("problems").select("time_limit, memory_limit").eq(
            "id", problem_id
        ).execute()
    ).data
    if not problem:
        logging.warning(
            f"Problem with ID {problem_id} not found in the database."
        )
        return None

    timeLimitMs = problem[0]["time_limit"] * 1000 if problem[0]["time_limit"] is not None else 20000
    memoryLimitMb = problem[0]["memory_limit"] if problem[0]["memory_limit"] is not None else 128

    test_cases = (await supabase.table("test_cases").select("input, output").eq(
        "problem_id", problem_id
    ).execute()).data

    if not test_cases:
        logging.warning(f"No test cases found for problem {problem_id}.")
        return None

    tmp_root = os.environ.get("CODE01_TMPDIR") or os.environ.get("TMPDIR") or "/tmp"
    temp_dir = tempfile.mkdtemp(prefix="code01_", dir=tmp_root)
    code_path = os.path.join(temp_dir, "main.c")
    binary_path = os.path.join(temp_dir, "main.out")
    result_list = []

    # Step 1. C 코드 저장
    with open(code_path, "w") as f:
        f.write(code)

    # Step 2. 컨테이너 내부에서 직접 컴파일
    compile_cmd = [
        "gcc",
        code_path,
        "-o",
        binary_path,
    ]
    compile_result = subprocess.run(compile_cmd, capture_output=True, text=True)

    if compile_result.returncode != 0:
        await supabase.table("problem_submissions").update(
            {
                "status_code": 6,  # CompilationError
                "stdout_list": [],
                "stderr_list": [compile_result.stderr.strip()],
                "passed_all": False,
                "is_correct": False,
                "passed_time_limit": False,
                "passed_memory_limit": False,
            }
        ).eq("id", pendingId).execute()
        return [{"error": "Compilation failed", "log": compile_result.stderr}]

    for index, test_case in enumerate(test_cases):
        input_data = test_case["input"]
        expected_output = test_case["output"]

        # Step 3. 컨테이너 내부에서 직접 실행
        # GNU time으로 메모리 측정, timeout으로 시간 제한 (초 단위 정수)
        timeout_secs = max(1, int(math.ceil(timeLimitMs / 1000)))
        if os.path.exists("/usr/bin/time"):
            cmd = ["/usr/bin/time", "-f", "MEM:%M", "timeout", str(timeout_secs), binary_path]
        else:
            # /usr/bin/time이 없을 때는 메모리 측정 없이 실행
            cmd = ["timeout", str(timeout_secs), binary_path]

        start = time.time()
        result = subprocess.run(cmd, input=str(input_data), capture_output=True, text=True)
        end = time.time()

        time_ms = int((end - start) * 1000)
        mem_kb = None
        if result.stderr:
            mem_match = re.search(r"MEM:(\d+)", result.stderr)
            if mem_match:
                mem_kb = int(mem_match.group(1))

        memory_exceeded = False
        if result.returncode != 0 and mem_kb:
             # Check if memory limit was exceeded (often results in non-zero exit code)
             if mem_kb > memoryLimitMb * 1024:
                 memory_exceeded = True

        result_list.append(
            {
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "timeMs": time_ms,
                "memoryKb": mem_kb,
                "isCorrect": result.stdout.strip() == expected_output.strip(),
                "expected": expected_output.strip(),
                "received": result.stdout.strip(),
                "timeout": result.returncode == 124,
                "memoryExceeded": memory_exceeded,
            }
        )

        await supabase.table("problem_submissions").update(
            {
                "cases_total": len(test_cases),
                "cases_done": index + 1,
            }
        ).eq("id", pendingId).execute()

    # Step 4. 정리
    try:
        if os.path.exists(code_path):
            os.remove(code_path)
        if os.path.exists(binary_path):
            os.remove(binary_path)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    is_correct = all(result["isCorrect"] for result in result_list)
    passed_time_limit = all(not result["timeout"] for result in result_list)
    passed_memory_limit = all(
        not result["memoryExceeded"] for result in result_list
    )

    if is_correct and passed_time_limit and passed_memory_limit:
        status_code = 1  # Accepted
    elif not is_correct:
        status_code = 2  # WrongAnswer
    elif not passed_time_limit:
        status_code = 3  # TimeLimitExceeded
    elif not passed_memory_limit:
        status_code = 4  # MemoryLimitExceeded
    elif any("error" in result for result in result_list):
        status_code = 5  # RuntimeError
    else:
        status_code = 7  # InternalError

    await supabase.table("problem_submissions").update(
        {
            "status_code": status_code,
            "stdout_list": [result["stdout"] for result in result_list],
            "stderr_list": [result["stderr"] for result in result_list],
            "time_ms": max(
                [result["timeMs"] for result in result_list if result["timeMs"] is not None] or [0]
            ),
            "memory_kb": max(
                [result["memoryKb"] for result in result_list if result["memoryKb"] is not None] or [0]
            ),
            "passed_all": all([is_correct, passed_time_limit, passed_memory_limit]),
            "is_correct": is_correct,
            "passed_time_limit": passed_time_limit,
            "passed_memory_limit": passed_memory_limit,
        }
    ).eq("id", pendingId).execute()

    print(f"Processed problem {problem_id} with {len(result_list)} test cases.")

    return None
