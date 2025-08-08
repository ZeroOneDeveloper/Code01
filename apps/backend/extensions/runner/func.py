import os
import re
import uuid
import time
import subprocess
from supabase import AsyncClient

def parse_time_E(time_str):
    match = re.match(r"(\d+):(\d+):([0-9.]+)", time_str)
    if not match:
        return None
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


async def run_code_in_background(
    supabase: AsyncClient,
    pendingId: str,
    code: str,
    problem_id: str,
):
    test_cases = (await supabase.table("test_cases").select("input, output").eq(
        "problem_id", problem_id
    ).execute()).data

    problem = (
        await supabase.table("problems").select("time_limit, memory_limit").eq(
            "id", problem_id
        ).execute()
    ).data
    if not problem:
        return [{"error": "Problem not found."}]

    timeLimitMs = problem[0]["time_limit"] * 1000 if problem[0]["time_limit"] is not None else 20000
    memoryLimitMb = problem[0]["memory_limit"] if problem[0]["memory_limit"] is not None else 128

    if not test_cases:
        return [{"error": "No test cases found for the problem."}]

    temp_id = str(uuid.uuid4())
    code_path = f"/tmp/{temp_id}.c"
    binary_path = f"/tmp/{temp_id}.out"
    result_list = []

    # Step 1. C 코드 저장
    with open(code_path, "w") as f:
        f.write(code)

    # Step 2. Docker 컨테이너에서 컴파일
    compile_cmd = [
        "docker",
        "run",
        "--rm",
        "-v",
        f"{code_path}:/app/code.c",
        "-v",
        f"/tmp:/output",
        "devzerone/gcc-time:latest",
        "bash",
        "-c",
        f"gcc /app/code.c -o /output/{temp_id}.out",
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
        ).eq("problem_id", problem_id).execute()
        return [{"error": "Compilation failed", "log": compile_result.stderr}]

    for test_case in test_cases:
        input_data = test_case["input"]
        expected_output = test_case["output"]

        run_cmd = [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            "--memory",
            f"{memoryLimitMb}m",
            "--cpus",
            "0.5",
            "-v",
            f"/tmp/{temp_id}.out:/app/run.out",
            "devzerone/gcc-time:latest",
            "bash",
            "-c",
            f'/usr/bin/time -f "MEM:%M" timeout {timeLimitMs // 1000} bash -c "echo \'{input_data}\' | /app/run.out"',
        ]

        start = time.time()
        result = subprocess.run(run_cmd, capture_output=True, text=True)
        end = time.time()

        time_ms = int((end - start) * 1000)
        mem_kb = None
        mem_match = re.search(r"MEM:(\d+)", result.stderr)
        if mem_match:
            mem_kb = int(mem_match.group(1))

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
                "memoryExceeded": mem_kb and mem_kb > memoryLimitMb * 1024,
            }
        )

    # Step 4. 정리
    os.remove(code_path)
    if os.path.exists(binary_path):
        os.remove(binary_path)

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
                [result["timeMs"] for result in result_list if result["timeMs"] is not None]
            ),
            "memory_kb": max(
                [result["memoryKb"] for result in result_list if result["memoryKb"] is not None]
            ),
            "passed_all": all([is_correct, passed_time_limit, passed_memory_limit]),
            "is_correct": is_correct,
            "passed_time_limit": passed_time_limit,
            "passed_memory_limit": passed_memory_limit,
        }
    ).eq("id", pendingId).execute()

    print(f"Processed problem {problem_id} with {len(result_list)} test cases.")

    return None
