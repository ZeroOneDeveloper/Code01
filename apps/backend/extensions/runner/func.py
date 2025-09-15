import os
import logging
from supabase import AsyncClient
import tempfile
import subprocess
from pathlib import Path

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

async def run_code_in_background(
    supabase: AsyncClient,
    pendingId: int,
    code: str,
    language: str,
    problem_id: int,
):
    try:
        problem = (
            await supabase.table("problems").select("time_limit, memory_limit").eq(
                "id", problem_id
            ).execute()
        ).data
        if not problem:
            raise ValueError(f"Problem with ID {problem_id} not found.")

        time_limit_sec = problem[0].get("time_limit", 10)
        memory_limit_mb = problem[0].get("memory_limit", 128)

        test_cases = (await supabase.table("test_cases").select("input, output").eq(
            "problem_id", problem_id
        ).execute()).data
        if not test_cases:
            raise ValueError(f"No test cases found for problem {problem_id}.")

        isolate_path = "/opt/isolate/isolate"
        box_id = "0"
        box_dir = f"/var/local/lib/isolate/{box_id}/box"
        result_list = []

        for index, test_case in enumerate(test_cases):
            subprocess.run([isolate_path, "--cg", "--box-id", box_id, "--init"], check=True)

            input_path = Path(box_dir) / "input.txt"
            input_path.write_text(test_case.get("input", ""))

            code_file = "Main.java" if language == "java" else "code"
            code_path = Path(box_dir) / code_file
            code_path.write_text(code)

            compile_cmd = None
            run_cmd = None

            if language == "c":
                compile_cmd = f"gcc {code_file} -o exec"
                run_cmd = "./exec"
            elif language == "cpp":
                compile_cmd = f"g++ {code_file} -o exec"
                run_cmd = "./exec"
            elif language == "python":
                run_cmd = f"python3 {code_file}"
            elif language == "java":
                compile_cmd = f"javac {code_file}"
                run_cmd = "java Main"

            if compile_cmd:
                subprocess.run(
                    [isolate_path, "--cg", "--box-id", box_id, "--run", "--", "sh", "-c", compile_cmd],
                    check=True,
                )

            exec_result = subprocess.run([
                isolate_path, "--cg", "--box-id", box_id,
                f"--time={time_limit_sec}", f"--mem={memory_limit_mb}",
                "--stdin=input.txt", "--stdout=stdout.txt", "--stderr=stderr.txt",
                "--", *run_cmd.split()
            ])

            stdout_file = Path(box_dir) / "stdout.txt"
            stderr_file = Path(box_dir) / "stderr.txt"
            stdout = stdout_file.read_text().strip() if stdout_file.exists() else ""
            stderr = stderr_file.read_text().strip() if stderr_file.exists() else ""
            exit_code = exec_result.returncode

            is_correct = stdout == test_case.get("output", "").strip()
            is_timeout = exit_code == 142  # isolate timeout signal

            result_list.append({
                "stdout": stdout,
                "stderr": stderr,
                "is_correct": is_correct,
                "is_timeout": is_timeout,
                "exit_code": exit_code,
            })

            await supabase.table("problem_submissions").update(
                {"cases_done": index + 1, "cases_total": len(test_cases)}
            ).eq("id", pendingId).execute()

        subprocess.run([isolate_path, "--box-id", box_id, "--cleanup"])

        # 최종 결과 판정
        is_correct_all = all(r["is_correct"] for r in result_list)
        is_time_limit_exceeded = any(r["is_timeout"] for r in result_list)
        is_runtime_error = any(r["exit_code"] != 0 for r in result_list)

        status_code = 7 # InternalError by default
        if is_time_limit_exceeded:
            status_code = 3 # TimeLimitExceeded
        elif not is_correct_all:
            status_code = 2 # WrongAnswer
        elif is_runtime_error:
            status_code = 5 # RuntimeError
        elif is_correct_all:
            status_code = 1 # Accepted

        await supabase.table("problem_submissions").update({
            "status_code": status_code,
            "stdout_list": [r["stdout"] for r in result_list],
            "stderr_list": [r["stderr"] for r in result_list],
            "passed_all": status_code == 1,
            "is_correct": is_correct_all,
            "passed_time_limit": not is_time_limit_exceeded,
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
