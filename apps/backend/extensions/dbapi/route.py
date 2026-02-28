from datetime import datetime
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.schema import Column
from sqlalchemy.sql.sqltypes import BigInteger, Boolean, DateTime, Float, Integer, SmallInteger

from db.models import (
    Organization,
    OrganizationMember,
    Problem,
    ProblemAsset,
    ProblemSubmission,
    Quiz,
    QuizAttempt,
    QuizProblem,
    TestCase,
    User,
)
from db.serializers import serialize_row
from db.session import get_db

router = APIRouter(
    prefix="/db",
    tags=["db"],
    responses={404: {"description": "Not found"}},
)


MODEL_MAP = {
    "users": User,
    "organizations": Organization,
    "organization_members": OrganizationMember,
    "problems": Problem,
    "test_cases": TestCase,
    "problem_assets": ProblemAsset,
    "problem_submissions": ProblemSubmission,
    "quizzes": Quiz,
    "quiz_problems": QuizProblem,
    "quiz_attempts": QuizAttempt,
}


class QueryFilter(BaseModel):
    op: Literal["eq", "in"]
    column: str
    value: Any


class QueryOrder(BaseModel):
    column: str
    ascending: bool = True


class SelectRequest(BaseModel):
    table: str
    columns: str = "*"
    filters: list[QueryFilter] = Field(default_factory=list)
    or_filters: list[QueryFilter] = Field(default_factory=list)
    order: QueryOrder | None = None
    range_from: int | None = None
    range_to: int | None = None
    count: bool = False
    head: bool = False


class InsertRequest(BaseModel):
    table: str
    values: dict[str, Any] | list[dict[str, Any]]
    returning: bool = False


class UpdateRequest(BaseModel):
    table: str
    values: dict[str, Any]
    filters: list[QueryFilter] = Field(default_factory=list)
    or_filters: list[QueryFilter] = Field(default_factory=list)
    returning: bool = False


class DeleteRequest(BaseModel):
    table: str
    filters: list[QueryFilter] = Field(default_factory=list)
    or_filters: list[QueryFilter] = Field(default_factory=list)
    returning: bool = False


def _normalize_table_name(name: str) -> str:
    return name.strip().lower().replace("-", "_")


def _get_model(name: str):
    normalized = _normalize_table_name(name)
    model = MODEL_MAP.get(normalized)
    if model is None:
        raise HTTPException(status_code=400, detail=f"Unsupported table: {name}")
    return model


def _get_column(model, column_name: str) -> Column:
    table = model.__table__
    if column_name not in table.c:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown column '{column_name}' on table '{table.name}'",
        )
    return table.c[column_name]


def _coerce_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    raise ValueError(f"Invalid datetime value: {value!r}")


def _coerce_value(column: Column, value: Any) -> Any:
    if value is None:
        return None

    if isinstance(column.type, PGUUID):
        return uuid.UUID(str(value))

    if isinstance(column.type, (SmallInteger, Integer, BigInteger)):
        return int(value)

    if isinstance(column.type, Float):
        return float(value)

    if isinstance(column.type, Boolean):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"true", "1", "yes", "y"}:
                return True
            if lowered in {"false", "0", "no", "n"}:
                return False
        return bool(value)

    if isinstance(column.type, DateTime):
        return _coerce_datetime(value)

    return value


def _coerce_filter_value(column: Column, op: str, value: Any) -> Any:
    if op == "in":
        if not isinstance(value, list):
            raise HTTPException(
                status_code=400,
                detail=f"Filter '{column.name}' with op 'in' must be a list",
            )
        return [_coerce_value(column, item) for item in value]

    return _coerce_value(column, value)


def _build_condition(model, filter_item: QueryFilter) -> ColumnElement[bool]:
    column = _get_column(model, filter_item.column)
    value = _coerce_filter_value(column, filter_item.op, filter_item.value)

    if filter_item.op == "eq":
        return column == value
    if filter_item.op == "in":
        return column.in_(value)

    raise HTTPException(status_code=400, detail=f"Unsupported filter op: {filter_item.op}")


def _apply_filters(query, model, filters: list[QueryFilter], or_filters: list[QueryFilter]):
    and_conditions = [_build_condition(model, item) for item in filters]
    if and_conditions:
        query = query.where(and_(*and_conditions))

    if or_filters:
        or_conditions = [_build_condition(model, item) for item in or_filters]
        query = query.where(or_(*or_conditions))

    return query


def _serialize_rows(rows: list[Any]) -> list[dict[str, Any]]:
    return [serialize_row(row) for row in rows]


def _project_rows(rows: list[dict[str, Any]], columns: str) -> list[dict[str, Any]]:
    columns = columns.strip()
    if not columns or columns == "*":
        return rows

    selected = [col.strip() for col in columns.split(",") if col.strip()]
    if not selected:
        return rows

    return [{col: row.get(col) for col in selected} for row in rows]


def _sanitize_payload(model, payload: dict[str, Any]) -> dict[str, Any]:
    table = model.__table__
    sanitized: dict[str, Any] = {}
    for key, raw_value in payload.items():
        if key not in table.c:
            continue
        column = table.c[key]
        sanitized[key] = _coerce_value(column, raw_value)
    return sanitized


@router.post("/select")
async def select_rows(payload: SelectRequest, db: AsyncSession = Depends(get_db)):
    model = _get_model(payload.table)

    base_query = select(model)
    base_query = _apply_filters(base_query, model, payload.filters, payload.or_filters)

    total_count: int | None = None
    if payload.count:
        count_query = select(func.count()).select_from(base_query.subquery())
        total_count = int((await db.execute(count_query)).scalar_one())

    query = base_query

    if payload.order:
        order_col = _get_column(model, payload.order.column)
        query = query.order_by(
            order_col.asc() if payload.order.ascending else order_col.desc()
        )

    if payload.range_from is not None:
        query = query.offset(payload.range_from)

    if payload.range_to is not None and payload.range_from is not None:
        query = query.limit((payload.range_to - payload.range_from) + 1)

    result = await db.execute(query)
    rows = list(result.scalars().all())
    serialized = _serialize_rows(rows)
    projected = _project_rows(serialized, payload.columns)

    if payload.head:
        projected = []

    return {"rows": projected, "count": total_count, "error": None}


@router.post("/insert")
async def insert_rows(payload: InsertRequest, db: AsyncSession = Depends(get_db)):
    model = _get_model(payload.table)

    raw_values = payload.values if isinstance(payload.values, list) else [payload.values]
    if not raw_values:
        return {"rows": [], "count": 0, "error": None}

    created_objects = []
    for item in raw_values:
        sanitized = _sanitize_payload(model, item)
        obj = model(**sanitized)
        db.add(obj)
        created_objects.append(obj)

    await db.commit()

    if not payload.returning:
        return {"rows": [], "count": len(created_objects), "error": None}

    for obj in created_objects:
        await db.refresh(obj)

    rows = _serialize_rows(created_objects)
    return {"rows": rows, "count": len(rows), "error": None}


@router.post("/update")
async def update_rows(payload: UpdateRequest, db: AsyncSession = Depends(get_db)):
    model = _get_model(payload.table)
    query = select(model)
    query = _apply_filters(query, model, payload.filters, payload.or_filters)

    result = await db.execute(query)
    rows = list(result.scalars().all())

    sanitized_values = _sanitize_payload(model, payload.values)
    for row in rows:
        for key, value in sanitized_values.items():
            setattr(row, key, value)

    await db.commit()

    if not payload.returning:
        return {"rows": [], "count": len(rows), "error": None}

    serialized = _serialize_rows(rows)
    return {"rows": serialized, "count": len(serialized), "error": None}


@router.post("/delete")
async def delete_rows(payload: DeleteRequest, db: AsyncSession = Depends(get_db)):
    model = _get_model(payload.table)
    query = select(model)
    query = _apply_filters(query, model, payload.filters, payload.or_filters)

    result = await db.execute(query)
    rows = list(result.scalars().all())

    serialized = _serialize_rows(rows) if payload.returning else []

    for row in rows:
        await db.delete(row)

    await db.commit()

    return {"rows": serialized, "count": len(rows), "error": None}
