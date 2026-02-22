import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from extensions.auth.route import _auth_user_id_from_request

from db.models import (
    Organization,
    OrganizationMember,
    Problem,
    ProblemSubmission,
    Quiz,
    QuizProblem,
    TestCase,
    User,
)
from db.session import get_db

router = APIRouter(
    prefix="/data",
    tags=["data"],
    responses={404: {"description": "Not found"}},
)


def dt(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "is_admin": user.is_admin,
        "student_id": user.student_id,
        "name": user.name,
        "nickname": user.nickname,
        "email": user.email,
        "created_at": dt(user.created_at),
    }


def organization_to_dict(org: Organization) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "created_by": str(org.created_by),
        "created_at": dt(org.created_at),
        "is_private": org.is_private,
    }


def organization_member_to_dict(member: OrganizationMember) -> dict:
    return {
        "organization_id": member.organization_id,
        "user_id": str(member.user_id),
        "joined_at": dt(member.joined_at),
        "role": member.role,
    }


def problem_to_dict(problem: Problem) -> dict:
    return {
        "id": problem.id,
        "created_at": dt(problem.created_at),
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
        "published_at": dt(problem.published_at),
        "default_code": problem.default_code,
        "deadline": dt(problem.deadline),
        "grade": problem.grade,
        "available_languages": problem.available_languages,
        "source": problem.source,
        "tags": problem.tags,
    }


def test_case_to_dict(test_case: TestCase) -> dict:
    return {
        "id": str(test_case.id),
        "problem_id": test_case.problem_id,
        "input": test_case.input,
        "output": test_case.output,
        "created_at": dt(test_case.created_at),
    }


def submission_to_dict(submission: ProblemSubmission) -> dict:
    return {
        "id": submission.id,
        "user_id": str(submission.user_id),
        "problem_id": submission.problem_id,
        "code": submission.code,
        "passed_all": submission.passed_all,
        "stdout_list": submission.stdout_list,
        "stderr_list": submission.stderr_list,
        "submitted_at": dt(submission.submitted_at),
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


def quiz_to_dict(quiz: Quiz) -> dict:
    return {
        "id": quiz.id,
        "created_at": dt(quiz.created_at),
        "organization_id": quiz.organization_id,
        "title": quiz.title,
        "description": quiz.description,
        "time_limit_sec": quiz.time_limit_sec,
        "start_at": dt(quiz.start_at),
        "end_at": dt(quiz.end_at),
        "assignment_mode": quiz.assignment_mode,
        "problem_count": quiz.problem_count,
        "created_by": str(quiz.created_by),
        "global_problem_id": quiz.global_problem_id,
        "published_at": dt(quiz.published_at),
    }


def quiz_problem_to_dict(quiz_problem: QuizProblem) -> dict:
    return {
        "id": quiz_problem.id,
        "quiz_id": quiz_problem.quiz_id,
        "problem_id": quiz_problem.problem_id,
        "order_index": quiz_problem.order_index,
    }


class UserCreate(BaseModel):
    id: uuid.UUID | None = None
    email: str
    name: str | None = None
    nickname: str | None = None
    student_id: str | None = None
    is_admin: bool = False


class UserUpdate(BaseModel):
    email: str | None = None
    name: str | None = None
    nickname: str | None = None
    student_id: str | None = None
    is_admin: bool | None = None


class OrganizationCreate(BaseModel):
    name: str
    created_by: uuid.UUID
    is_private: bool = True


class OrganizationMemberUpsert(BaseModel):
    user_id: uuid.UUID
    role: str = "member"


class ProblemCreate(BaseModel):
    title: str
    description: str
    created_by: uuid.UUID
    input_description: str | None = None
    output_description: str | None = None
    sample_inputs: list[str] = Field(default_factory=list)
    sample_outputs: list[str] = Field(default_factory=list)
    time_limit: int | None = None
    memory_limit: int | None = None
    organization_id: int | None = None
    conditions: list[str] = Field(default_factory=list)
    published_at: datetime | None = None
    default_code: str | None = None
    deadline: datetime | None = None
    grade: str | None = None
    available_languages: list[str] = Field(default_factory=list)
    source: str | None = None
    tags: list[str] = Field(default_factory=list)


class ProblemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    input_description: str | None = None
    output_description: str | None = None
    sample_inputs: list[str] | None = None
    sample_outputs: list[str] | None = None
    time_limit: int | None = None
    memory_limit: int | None = None
    organization_id: int | None = None
    conditions: list[str] | None = None
    published_at: datetime | None = None
    default_code: str | None = None
    deadline: datetime | None = None
    grade: str | None = None
    available_languages: list[str] | None = None
    source: str | None = None
    tags: list[str] | None = None


class TestCaseCreate(BaseModel):
    problem_id: int
    input: str
    output: str


class TestCaseDeleteRequest(BaseModel):
    ids: list[uuid.UUID]


class SubmissionUpdate(BaseModel):
    visibility: str | None = None


class QuizCreate(BaseModel):
    organization_id: int
    title: str
    description: str | None = None
    time_limit_sec: int | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    assignment_mode: str | None = None
    problem_count: int | None = None
    created_by: uuid.UUID
    global_problem_id: int | None = None
    published_at: datetime | None = None


class QuizUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    time_limit_sec: int | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    assignment_mode: str | None = None
    problem_count: int | None = None
    global_problem_id: int | None = None
    published_at: datetime | None = None


class QuizProblemCreate(BaseModel):
    quiz_id: int
    problem_id: int
    order_index: int = 0


@router.post("/users")
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    user = User(
        id=payload.id or uuid.uuid4(),
        email=payload.email,
        name=payload.name,
        nickname=payload.nickname,
        student_id=payload.student_id,
        is_admin=payload.is_admin,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email already exists") from exc

    await db.refresh(user)
    return user_to_dict(user)


@router.get("/users/{user_id}")
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_dict(user)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(user, key, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email already exists") from exc

    await db.refresh(user)
    return user_to_dict(user)


@router.get("/organizations")
async def list_organizations(
    user_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    if user_id is None:
        rows = await db.execute(select(Organization).order_by(Organization.id.desc()))
    else:
        rows = await db.execute(
            select(Organization)
            .join(
                OrganizationMember,
                OrganizationMember.organization_id == Organization.id,
            )
            .where(OrganizationMember.user_id == user_id)
            .order_by(Organization.id.desc())
        )

    return [organization_to_dict(org) for org in rows.scalars().all()]


@router.post("/organizations")
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
):
    creator = await db.get(User, payload.created_by)
    if not creator:
        raise HTTPException(status_code=404, detail="Creator user not found")

    organization = Organization(
        name=payload.name,
        created_by=payload.created_by,
        is_private=payload.is_private,
    )
    db.add(organization)
    await db.flush()

    db.add(
        OrganizationMember(
            organization_id=organization.id,
            user_id=payload.created_by,
            role="admin",
        )
    )
    await db.commit()
    await db.refresh(organization)
    return organization_to_dict(organization)


@router.get("/organizations/{organization_id}/members")
async def list_organization_members(
    organization_id: int,
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id
        )
    )
    return [organization_member_to_dict(member) for member in rows.scalars().all()]


@router.post("/organizations/{organization_id}/members")
async def upsert_organization_member(
    organization_id: int,
    payload: OrganizationMemberUpsert,
    db: AsyncSession = Depends(get_db),
):
    organization = await db.get(Organization, organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    user = await db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    member = await db.get(
        OrganizationMember,
        {"organization_id": organization_id, "user_id": payload.user_id},
    )
    if member:
        member.role = payload.role
    else:
        member = OrganizationMember(
            organization_id=organization_id,
            user_id=payload.user_id,
            role=payload.role,
        )
        db.add(member)

    await db.commit()
    await db.refresh(member)
    return organization_member_to_dict(member)


@router.delete("/organizations/{organization_id}/members/{user_id}")
async def delete_organization_member(
    organization_id: int,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    member = await db.get(
        OrganizationMember,
        {"organization_id": organization_id, "user_id": user_id},
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(member)
    await db.commit()
    return {"deleted": True}


@router.get("/problems")
async def list_problems(
    organization_id: int | None = None,
    created_by: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Problem).order_by(Problem.id.desc())
    if organization_id is not None:
        query = query.where(Problem.organization_id == organization_id)
    if created_by is not None:
        query = query.where(Problem.created_by == created_by)

    rows = await db.execute(query)
    return [problem_to_dict(problem) for problem in rows.scalars().all()]


def _is_problem_published(published_at: datetime | None, now: datetime) -> bool:
    if published_at is None:
        return False
    target = (
        published_at
        if published_at.tzinfo is not None
        else published_at.replace(tzinfo=timezone.utc)
    )
    return target <= now


@router.get("/problems/visible")
async def list_visible_problems(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    auth_user_id = _auth_user_id_from_request(request)
    viewer_user_id: uuid.UUID | None = None
    if auth_user_id:
        try:
            viewer_user_id = uuid.UUID(auth_user_id)
        except ValueError:
            viewer_user_id = None

    org_rows = await db.execute(
        select(Organization.id, Organization.name, Organization.is_private)
    )
    organizations: dict[int, dict] = {}
    for org_id, name, is_private in org_rows.all():
        organizations[org_id] = {
            "id": org_id,
            "name": name,
            "is_private": bool(is_private),
        }

    member_org_ids: set[int] = set()
    if viewer_user_id is not None:
        membership_rows = await db.execute(
            select(OrganizationMember.organization_id).where(
                OrganizationMember.user_id == viewer_user_id
            )
        )
        member_org_ids = {row[0] for row in membership_rows.all()}

    problem_rows = await db.execute(
        select(Problem).order_by(Problem.created_at.desc(), Problem.id.desc())
    )
    all_problems = problem_rows.scalars().all()

    visible_problems: list[Problem] = []
    for problem in all_problems:
        org_id = problem.organization_id
        published = _is_problem_published(problem.published_at, now)

        if org_id is None:
            if published:
                visible_problems.append(problem)
            continue

        if viewer_user_id is not None and org_id in member_org_ids:
            visible_problems.append(problem)
            continue

        org = organizations.get(org_id)
        if org and (not org["is_private"]) and published:
            visible_problems.append(problem)

    problem_ids = [problem.id for problem in visible_problems]
    stats_map: dict[int, dict[str, float | int]] = {
        problem_id: {"solved": 0, "submitted": 0, "accuracy": 0.0}
        for problem_id in problem_ids
    }
    if problem_ids:
        submission_rows = await db.execute(
            select(ProblemSubmission.problem_id, ProblemSubmission.passed_all).where(
                ProblemSubmission.problem_id.in_(problem_ids)
            )
        )
        for problem_id, passed_all in submission_rows.all():
            stat = stats_map.setdefault(
                problem_id, {"solved": 0, "submitted": 0, "accuracy": 0.0}
            )
            stat["submitted"] += 1
            if passed_all:
                stat["solved"] += 1
        for stat in stats_map.values():
            submitted = int(stat["submitted"])
            solved = int(stat["solved"])
            stat["accuracy"] = (solved / submitted * 100.0) if submitted > 0 else 0.0

    creator_ids = list({problem.created_by for problem in visible_problems})
    creator_map: dict[str, str] = {}
    if creator_ids:
        creator_rows = await db.execute(
            select(User.id, User.name, User.nickname).where(User.id.in_(creator_ids))
        )
        for creator_id, name, nickname in creator_rows.all():
            creator_map[str(creator_id)] = nickname or name or "-"

    sections_by_key: dict[str, dict] = {}
    for problem in visible_problems:
        org_id = problem.organization_id
        if org_id is None:
            section_key = "public"
            section = sections_by_key.setdefault(
                section_key,
                {
                    "key": section_key,
                    "organization_id": None,
                    "organization_name": "공개 문제",
                    "is_private": False,
                    "is_member": False,
                    "problems": [],
                },
            )
        else:
            section_key = f"org:{org_id}"
            org = organizations.get(org_id)
            section = sections_by_key.setdefault(
                section_key,
                {
                    "key": section_key,
                    "organization_id": org_id,
                    "organization_name": org["name"] if org else f"Organization #{org_id}",
                    "is_private": bool(org["is_private"]) if org else True,
                    "is_member": org_id in member_org_ids,
                    "problems": [],
                },
            )

        problem_item = problem_to_dict(problem)
        problem_item["uploader_name"] = creator_map.get(str(problem.created_by), "-")
        stat = stats_map.get(problem.id, {"solved": 0, "submitted": 0, "accuracy": 0.0})
        problem_item["stats"] = {
            "solved": int(stat["solved"]),
            "submitted": int(stat["submitted"]),
            "accuracy": float(stat["accuracy"]),
        }
        section["problems"].append(problem_item)

    sections = list(sections_by_key.values())
    sections.sort(
        key=lambda section: (
            0 if section["organization_id"] is None else 1,
            str(section["organization_name"]),
        )
    )

    return {
        "viewer": {
            "authenticated": viewer_user_id is not None,
            "user_id": str(viewer_user_id) if viewer_user_id is not None else None,
        },
        "total": len(visible_problems),
        "sections": sections,
    }


@router.get("/problems/{problem_id}")
async def get_problem(problem_id: int, db: AsyncSession = Depends(get_db)):
    problem = await db.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem_to_dict(problem)


@router.post("/problems")
async def create_problem(payload: ProblemCreate, db: AsyncSession = Depends(get_db)):
    creator = await db.get(User, payload.created_by)
    if not creator:
        raise HTTPException(status_code=404, detail="Creator user not found")

    problem = Problem(**payload.model_dump())
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return problem_to_dict(problem)


@router.patch("/problems/{problem_id}")
async def update_problem(
    problem_id: int,
    payload: ProblemUpdate,
    db: AsyncSession = Depends(get_db),
):
    problem = await db.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(problem, key, value)

    await db.commit()
    await db.refresh(problem)
    return problem_to_dict(problem)


@router.get("/test-cases")
async def list_test_cases(
    problem_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(
        select(func.count()).select_from(TestCase).where(TestCase.problem_id == problem_id)
    )

    rows = await db.execute(
        select(TestCase)
        .where(TestCase.problem_id == problem_id)
        .order_by(TestCase.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    return {
        "items": [test_case_to_dict(case) for case in rows.scalars().all()],
        "total": total or 0,
        "page": page,
        "page_size": page_size,
    }


@router.post("/test-cases")
async def create_test_case(payload: TestCaseCreate, db: AsyncSession = Depends(get_db)):
    problem = await db.get(Problem, payload.problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    test_case = TestCase(
        problem_id=payload.problem_id,
        input=payload.input,
        output=payload.output,
    )
    db.add(test_case)
    await db.commit()
    await db.refresh(test_case)
    return test_case_to_dict(test_case)


@router.delete("/test-cases")
async def delete_test_cases(
    payload: TestCaseDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    if not payload.ids:
        return {"deleted": 0}

    result = await db.execute(delete(TestCase).where(TestCase.id.in_(payload.ids)))
    await db.commit()
    return {"deleted": result.rowcount or 0}


@router.get("/problem-submissions")
async def list_problem_submissions(
    problem_id: int | None = None,
    user_id: uuid.UUID | None = None,
    organization_id: int | None = None,
    visibility: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ProblemSubmission).order_by(ProblemSubmission.id.desc())

    if organization_id is not None:
        query = query.join(Problem, Problem.id == ProblemSubmission.problem_id).where(
            Problem.organization_id == organization_id
        )
    if problem_id is not None:
        query = query.where(ProblemSubmission.problem_id == problem_id)
    if user_id is not None:
        query = query.where(ProblemSubmission.user_id == user_id)
    if visibility is not None:
        query = query.where(ProblemSubmission.visibility == visibility)

    rows = await db.execute(query)
    return [submission_to_dict(item) for item in rows.scalars().all()]


@router.get("/problem-submissions/{submission_id}")
async def get_problem_submission(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(ProblemSubmission, submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission_to_dict(item)


@router.patch("/problem-submissions/{submission_id}")
async def update_problem_submission(
    submission_id: int,
    payload: SubmissionUpdate,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(ProblemSubmission, submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return submission_to_dict(item)


@router.get("/quizzes")
async def list_quizzes(
    organization_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Quiz).order_by(Quiz.id.desc())
    if organization_id is not None:
        query = query.where(Quiz.organization_id == organization_id)

    rows = await db.execute(query)
    return [quiz_to_dict(item) for item in rows.scalars().all()]


@router.post("/quizzes")
async def create_quiz(payload: QuizCreate, db: AsyncSession = Depends(get_db)):
    creator = await db.get(User, payload.created_by)
    if not creator:
        raise HTTPException(status_code=404, detail="Creator user not found")

    quiz = Quiz(**payload.model_dump())
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)
    return quiz_to_dict(quiz)


@router.patch("/quizzes/{quiz_id}")
async def update_quiz(
    quiz_id: int,
    payload: QuizUpdate,
    db: AsyncSession = Depends(get_db),
):
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(quiz, key, value)

    await db.commit()
    await db.refresh(quiz)
    return quiz_to_dict(quiz)


@router.get("/quiz-problems")
async def list_quiz_problems(quiz_id: int, db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(QuizProblem)
        .where(QuizProblem.quiz_id == quiz_id)
        .order_by(QuizProblem.order_index.asc(), QuizProblem.id.asc())
    )
    return [quiz_problem_to_dict(item) for item in rows.scalars().all()]


@router.post("/quiz-problems")
async def create_quiz_problem(
    payload: QuizProblemCreate,
    db: AsyncSession = Depends(get_db),
):
    quiz = await db.get(Quiz, payload.quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    problem = await db.get(Problem, payload.problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    quiz_problem = QuizProblem(**payload.model_dump())
    db.add(quiz_problem)
    await db.commit()
    await db.refresh(quiz_problem)
    return quiz_problem_to_dict(quiz_problem)


@router.delete("/quiz-problems/{quiz_problem_id}")
async def delete_quiz_problem(
    quiz_problem_id: int,
    db: AsyncSession = Depends(get_db),
):
    quiz_problem = await db.get(QuizProblem, quiz_problem_id)
    if not quiz_problem:
        raise HTTPException(status_code=404, detail="Quiz problem not found")

    await db.delete(quiz_problem)
    await db.commit()
    return {"deleted": True}
