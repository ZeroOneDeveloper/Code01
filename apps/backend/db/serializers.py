from datetime import datetime
from typing import Any

from .models import (
    Organization,
    OrganizationMember,
    Problem,
    ProblemAsset,
    ProblemSubmission,
    Quiz,
    QuizProblem,
    TestCase,
    User,
)


def _dt(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "is_admin": user.is_admin,
        "student_id": user.student_id,
        "name": user.name,
        "nickname": user.nickname,
        "email": user.email,
        "created_at": _dt(user.created_at),
    }


def serialize_organization(org: Organization) -> dict[str, Any]:
    return {
        "id": org.id,
        "name": org.name,
        "created_by": str(org.created_by),
        "created_at": _dt(org.created_at),
        "is_private": org.is_private,
    }


def serialize_organization_member(member: OrganizationMember) -> dict[str, Any]:
    return {
        "organization_id": member.organization_id,
        "user_id": str(member.user_id),
        "joined_at": _dt(member.joined_at),
        "role": member.role,
    }


def serialize_problem(problem: Problem) -> dict[str, Any]:
    return {
        "id": problem.id,
        "created_at": _dt(problem.created_at),
        "title": problem.title,
        "description": problem.description,
        "created_by": str(problem.created_by),
        "input_description": problem.input_description,
        "output_description": problem.output_description,
        "sample_inputs": problem.sample_inputs,
        "sample_outputs": problem.sample_outputs,
        "time_limit": problem.time_limit,
        "memory_limit": problem.memory_limit,
        "organization_id": problem.organization_id,
        "conditions": problem.conditions,
        "published_at": _dt(problem.published_at),
        "default_code": problem.default_code,
        "deadline": _dt(problem.deadline),
        "grade": problem.grade,
        "available_languages": problem.available_languages,
        "source": problem.source,
        "tags": problem.tags,
    }


def serialize_test_case(test_case: TestCase) -> dict[str, Any]:
    return {
        "id": str(test_case.id),
        "problem_id": test_case.problem_id,
        "input": test_case.input,
        "output": test_case.output,
        "created_at": _dt(test_case.created_at),
    }


def serialize_problem_asset(asset: ProblemAsset) -> dict[str, Any]:
    return {
        "id": asset.id,
        "problem_id": asset.problem_id,
        "url": asset.url,
        "path": asset.path,
        "section": asset.section,
        "created_at": _dt(asset.created_at),
    }


def serialize_problem_submission(submission: ProblemSubmission) -> dict[str, Any]:
    return {
        "id": submission.id,
        "user_id": str(submission.user_id),
        "problem_id": submission.problem_id,
        "code": submission.code,
        "passed_all": submission.passed_all,
        "stdout_list": submission.stdout_list,
        "stderr_list": submission.stderr_list,
        "submitted_at": _dt(submission.submitted_at),
        "passed_time_limit": submission.passed_time_limit,
        "passed_memory_limit": submission.passed_memory_limit,
        "is_correct": submission.is_correct,
        "status_code": submission.status_code,
        "memory_kb": submission.memory_kb,
        "time_ms": submission.time_ms,
        "visibility": submission.visibility,
        "cases_total": submission.cases_total,
        "cases_done": submission.cases_done,
        "language": submission.language,
    }


def serialize_quiz(quiz: Quiz) -> dict[str, Any]:
    return {
        "id": quiz.id,
        "created_at": _dt(quiz.created_at),
        "organization_id": quiz.organization_id,
        "title": quiz.title,
        "description": quiz.description,
        "time_limit_sec": quiz.time_limit_sec,
        "start_at": _dt(quiz.start_at),
        "end_at": _dt(quiz.end_at),
        "assignment_mode": quiz.assignment_mode,
        "problem_count": quiz.problem_count,
        "created_by": str(quiz.created_by),
        "global_problem_id": quiz.global_problem_id,
        "published_at": _dt(quiz.published_at),
    }


def serialize_quiz_problem(quiz_problem: QuizProblem) -> dict[str, Any]:
    return {
        "id": quiz_problem.id,
        "quiz_id": quiz_problem.quiz_id,
        "problem_id": quiz_problem.problem_id,
        "order_index": quiz_problem.order_index,
    }


def serialize_row(row: Any) -> dict[str, Any]:
    if isinstance(row, User):
        return serialize_user(row)
    if isinstance(row, Organization):
        return serialize_organization(row)
    if isinstance(row, OrganizationMember):
        return serialize_organization_member(row)
    if isinstance(row, Problem):
        return serialize_problem(row)
    if isinstance(row, TestCase):
        return serialize_test_case(row)
    if isinstance(row, ProblemAsset):
        return serialize_problem_asset(row)
    if isinstance(row, ProblemSubmission):
        return serialize_problem_submission(row)
    if isinstance(row, Quiz):
        return serialize_quiz(row)
    if isinstance(row, QuizProblem):
        return serialize_quiz_problem(row)

    raise TypeError(f"Unsupported row type: {type(row)!r}")
