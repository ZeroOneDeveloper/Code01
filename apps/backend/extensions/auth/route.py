import base64
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from db.models import PasswordReset, PendingSignup, User
from db.serializers import serialize_user
from db.session import get_db

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)

COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "code01_session")
COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN")
COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "false").lower() == "true"
TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "604800"))  # 7 days
VERIFY_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_VERIFY_TOKEN_TTL_SECONDS", "86400"))
RESET_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_RESET_TOKEN_TTL_SECONDS", "3600"))
AUTH_SECRET = os.getenv(
    "AUTH_SECRET",
    "code01-change-this-secret-in-production",
)

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
RESEND_API_URL = "https://api.resend.com/emails"
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL")
RESEND_VERIFY_SUBJECT = os.getenv(
    "RESEND_VERIFY_SUBJECT",
    "Code01 이메일 인증을 완료해 주세요",
)
RESEND_RESET_SUBJECT = os.getenv(
    "RESEND_RESET_SUBJECT",
    "Code01 비밀번호 재설정 안내",
)
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
BACKEND_PUBLIC_ORIGIN = os.getenv("BACKEND_PUBLIC_ORIGIN", "http://localhost:3001")
VERIFY_SUCCESS_REDIRECT = os.getenv(
    "AUTH_VERIFY_SUCCESS_REDIRECT",
    f"{FRONTEND_ORIGIN.rstrip('/')}/?verified=success",
)
VERIFY_EXPIRED_REDIRECT = os.getenv(
    "AUTH_VERIFY_EXPIRED_REDIRECT",
    f"{FRONTEND_ORIGIN.rstrip('/')}/login?verified=expired",
)
VERIFY_INVALID_REDIRECT = os.getenv(
    "AUTH_VERIFY_INVALID_REDIRECT",
    f"{FRONTEND_ORIGIN.rstrip('/')}/login?verified=invalid",
)


class SignUpRequest(BaseModel):
    email: str
    password: str
    student_id: str
    name: str
    nickname: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ExchangeRequest(BaseModel):
    code: str


class PasswordResetRequest(BaseModel):
    email: str
    redirect_to: str | None = None


class PasswordResetConfirmRequest(BaseModel):
    token: str
    password: str


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
        dklen=32,
    )
    return f"scrypt${_b64url_encode(salt)}${_b64url_encode(digest)}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False

    try:
        algo, salt_b64, digest_b64 = encoded.split("$", 2)
        if algo != "scrypt":
            return False

        salt = _b64url_decode(salt_b64)
        expected = _b64url_decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=2**14,
            r=8,
            p=1,
            dklen=32,
        )
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_session_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
        "iat": int(time.time()),
    }
    payload_raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64url_encode(payload_raw)
    signature = hmac.new(
        AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    signature_b64 = _b64url_encode(signature)
    return f"{payload_b64}.{signature_b64}"


def verify_session_token(token: str | None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None

    payload_b64, signature_b64 = token.split(".", 1)
    expected_sig = hmac.new(
        AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    try:
        if not hmac.compare_digest(expected_sig, _b64url_decode(signature_b64)):
            return None

        payload_raw = _b64url_decode(payload_b64)
        payload = json.loads(payload_raw.decode("utf-8"))

        exp = int(payload.get("exp", 0))
        if exp < int(time.time()):
            return None

        if not payload.get("sub"):
            return None

        return payload
    except Exception:
        return None


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=TOKEN_TTL_SECONDS,
        path="/",
        domain=COOKIE_DOMAIN,
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        domain=COOKIE_DOMAIN,
    )


def _auth_user_id_from_request(request: Request) -> str | None:
    token = request.cookies.get(COOKIE_NAME)
    payload = verify_session_token(token)
    if not payload:
        return None
    return str(payload.get("sub"))


async def _get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None

    return await db.get(User, uid)


def _is_resend_configured() -> bool:
    return bool(RESEND_API_KEY and RESEND_FROM_EMAIL)


def _hash_verification_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generate_verification_token() -> tuple[str, str]:
    raw_token = secrets.token_urlsafe(32)
    return raw_token, _hash_verification_token(raw_token)


def _build_verify_url(token: str) -> str:
    encoded = quote(token, safe="")
    return f"{BACKEND_PUBLIC_ORIGIN.rstrip('/')}/auth/verify?token={encoded}"


def _build_verify_email_html(email: str, token: str) -> str:
    safe_email = html.escape(email)
    verify_url = _build_verify_url(token)
    expire_hours = max(1, round(VERIFY_TOKEN_TTL_SECONDS / 3600))

    return f"""
<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
  <h2>Code01 이메일 인증</h2>
  <p><strong>{safe_email}</strong> 계정의 가입을 마치려면 아래 버튼을 눌러 인증을 완료해 주세요.</p>
  <p>
    <a href="{verify_url}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
      이메일 인증 완료
    </a>
  </p>
  <p style="color:#6b7280;font-size:12px">인증 링크는 약 {expire_hours}시간 동안 유효합니다.</p>
  <p style="color:#6b7280;font-size:12px">본 메일은 발신 전용입니다.</p>
</div>
""".strip()


def _build_password_reset_url(token: str, redirect_to: str | None) -> str:
    base_url = (
        redirect_to.strip()
        if redirect_to and redirect_to.strip()
        else f"{FRONTEND_ORIGIN.rstrip('/')}/reset-password"
    )
    parsed = urlsplit(base_url)
    query_items = parse_qsl(parsed.query, keep_blank_values=True)
    query_items = [(key, value) for key, value in query_items if key != "token"]
    query_items.append(("token", token))
    query = urlencode(query_items)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))


def _build_password_reset_email_html(email: str, reset_url: str) -> str:
    safe_email = html.escape(email)
    expire_minutes = max(1, round(RESET_TOKEN_TTL_SECONDS / 60))
    return f"""
<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
  <h2>Code01 비밀번호 재설정</h2>
  <p><strong>{safe_email}</strong> 계정의 비밀번호를 재설정하려면 아래 버튼을 눌러 주세요.</p>
  <p>
    <a href="{reset_url}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
      비밀번호 재설정
    </a>
  </p>
  <p style="color:#6b7280;font-size:12px">링크는 약 {expire_minutes}분 동안 유효합니다.</p>
  <p style="color:#6b7280;font-size:12px">본 메일은 발신 전용입니다.</p>
</div>
""".strip()


async def send_verification_email(email: str, token: str) -> None:
    if not _is_resend_configured():
        return

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [email],
        "subject": RESEND_VERIFY_SUBJECT,
        "html": _build_verify_email_html(email, token),
    }
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(RESEND_API_URL, json=payload, headers=headers)
            response.raise_for_status()
    except Exception as exc:
        print(f"[auth] Failed to send verification email to {email}: {exc}")


async def send_password_reset_email(email: str, reset_url: str) -> None:
    if not _is_resend_configured():
        return

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [email],
        "subject": RESEND_RESET_SUBJECT,
        "html": _build_password_reset_email_html(email, reset_url),
    }
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(RESEND_API_URL, json=payload, headers=headers)
            response.raise_for_status()
    except Exception as exc:
        print(f"[auth] Failed to send password reset email to {email}: {exc}")


@router.post("/signup")
async def signup(
    payload: SignUpRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.strip().lower()
    password = payload.password
    student_id = payload.student_id.strip()
    name = payload.name.strip()
    nickname = payload.nickname.strip()

    if not EMAIL_REGEX.match(email):
        return JSONResponse(
            status_code=400,
            content={"user": None, "error": {"message": "Invalid email format"}},
        )

    if len(password) < 8:
        return JSONResponse(
            status_code=400,
            content={
                "user": None,
                "error": {"message": "Password must be at least 8 characters"},
            },
        )

    if not student_id:
        return JSONResponse(
            status_code=400,
            content={"user": None, "error": {"message": "Student ID is required"}},
        )

    if len(student_id) > 64:
        return JSONResponse(
            status_code=400,
            content={
                "user": None,
                "error": {"message": "Student ID must be 64 characters or fewer"},
            },
        )

    if not name:
        return JSONResponse(
            status_code=400,
            content={"user": None, "error": {"message": "Name is required"}},
        )

    if len(name) > 80:
        return JSONResponse(
            status_code=400,
            content={
                "user": None,
                "error": {"message": "Name must be 80 characters or fewer"},
            },
        )

    if not nickname:
        return JSONResponse(
            status_code=400,
            content={"user": None, "error": {"message": "Nickname is required"}},
        )

    if len(nickname) > 40:
        return JSONResponse(
            status_code=400,
            content={
                "user": None,
                "error": {"message": "Nickname must be 40 characters or fewer"},
            },
        )

    if not _is_resend_configured():
        return JSONResponse(
            status_code=500,
            content={
                "user": None,
                "error": {"message": "Email service is not configured"},
            },
        )

    existing_user_row = await db.execute(select(User).where(User.email == email))
    if existing_user_row.scalars().first() is not None:
        return JSONResponse(
            status_code=409,
            content={"user": None, "error": {"message": "Email already exists"}},
        )

    raw_token, token_hash = _generate_verification_token()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=VERIFY_TOKEN_TTL_SECONDS)

    pending_row = await db.execute(select(PendingSignup).where(PendingSignup.email == email))
    pending = pending_row.scalars().first()

    if pending is None:
        pending = PendingSignup(
            id=uuid.uuid4(),
            email=email,
            password_hash=hash_password(password),
            student_id=student_id,
            name=name,
            nickname=nickname,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(pending)
    else:
        pending.password_hash = hash_password(password)
        pending.student_id = student_id
        pending.name = name
        pending.nickname = nickname
        pending.token_hash = token_hash
        pending.expires_at = expires_at

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return JSONResponse(
            status_code=500,
            content={
                "user": None,
                "error": {"message": "Could not create verification request"},
            },
        )

    background_tasks.add_task(send_verification_email, email, raw_token)
    return JSONResponse(
        content={"user": None, "error": None},
        background=background_tasks,
    )


@router.get("/verify")
async def verify_email(
    token: str = Query(..., min_length=10),
    db: AsyncSession = Depends(get_db),
):
    token_hash = _hash_verification_token(token)

    pending_row = await db.execute(
        select(PendingSignup).where(PendingSignup.token_hash == token_hash)
    )
    pending = pending_row.scalars().first()

    if pending is None:
        return RedirectResponse(url=VERIFY_INVALID_REDIRECT, status_code=302)

    expires_at = pending.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        await db.delete(pending)
        await db.commit()
        return RedirectResponse(url=VERIFY_EXPIRED_REDIRECT, status_code=302)

    email = pending.email
    password_hash = pending.password_hash
    student_id = pending.student_id
    name = pending.name
    nickname = pending.nickname

    user_row = await db.execute(select(User).where(User.email == email))
    user = user_row.scalars().first()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=email,
            name=name,
            nickname=nickname,
            student_id=student_id,
            is_admin=False,
            password_hash=password_hash,
        )
        db.add(user)
    else:
        # Preserve existing profile data unless the current value is empty.
        if (not user.student_id) and student_id:
            user.student_id = student_id
        if (not user.name) and name:
            user.name = name
        if (not user.nickname) and nickname:
            user.nickname = nickname

    await db.delete(pending)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        retry_user_row = await db.execute(select(User).where(User.email == email))
        user = retry_user_row.scalars().first()

        cleanup_pending_row = await db.execute(
            select(PendingSignup).where(PendingSignup.email == email)
        )
        cleanup_pending = cleanup_pending_row.scalars().first()
        if cleanup_pending is not None:
            await db.delete(cleanup_pending)
            await db.commit()

    if user is None:
        return RedirectResponse(url=VERIFY_INVALID_REDIRECT, status_code=302)

    session_token = create_session_token(str(user.id))
    response = RedirectResponse(url=VERIFY_SUCCESS_REDIRECT, status_code=302)
    _set_session_cookie(response, session_token)
    return response


@router.post("/password-reset/request")
async def request_password_reset(
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.strip().lower()
    if not EMAIL_REGEX.match(email):
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": {"message": "Invalid email format"}},
        )

    if not _is_resend_configured():
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": {"message": "Email service is not configured"}},
        )

    user_row = await db.execute(select(User).where(User.email == email))
    user = user_row.scalars().first()

    if user is not None:
        await db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
        raw_token, token_hash = _generate_verification_token()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=RESET_TOKEN_TTL_SECONDS)

        db.add(
            PasswordReset(
                id=uuid.uuid4(),
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
            )
        )

        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            return JSONResponse(
                status_code=500,
                content={
                    "ok": False,
                    "error": {"message": "Could not create password reset request"},
                },
            )

        reset_url = _build_password_reset_url(raw_token, payload.redirect_to)
        background_tasks.add_task(send_password_reset_email, email, reset_url)
        return JSONResponse(
            content={"ok": True, "error": None},
            background=background_tasks,
        )

    # 사용자 존재 여부를 노출하지 않기 위해 성공 응답을 동일하게 반환합니다.
    return JSONResponse(content={"ok": True, "error": None})


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    token = payload.token.strip()
    password = payload.password

    if len(token) < 10:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": {"message": "Invalid reset token"}},
        )

    if len(password) < 8:
        return JSONResponse(
            status_code=400,
            content={
                "ok": False,
                "error": {"message": "Password must be at least 8 characters"},
            },
        )

    token_hash = _hash_verification_token(token)
    reset_row = await db.execute(
        select(PasswordReset).where(PasswordReset.token_hash == token_hash)
    )
    reset_request = reset_row.scalars().first()

    if reset_request is None:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": {"message": "Invalid or expired reset token"}},
        )

    expires_at = reset_request.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        await db.delete(reset_request)
        await db.commit()
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": {"message": "Invalid or expired reset token"}},
        )

    user = await db.get(User, reset_request.user_id)
    if user is None:
        await db.delete(reset_request)
        await db.commit()
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": {"message": "Invalid reset token"}},
        )

    user.password_hash = hash_password(password)
    await db.execute(delete(PasswordReset).where(PasswordReset.user_id == reset_request.user_id))
    await db.commit()

    return JSONResponse(content={"ok": True, "error": None})


@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()
    password = payload.password

    row = await db.execute(select(User).where(User.email == email))
    user = row.scalars().first()

    if not user or not verify_password(password, user.password_hash):
        return JSONResponse(
            status_code=401,
            content={"user": None, "error": {"message": "Invalid credentials"}},
        )

    token = create_session_token(str(user.id))
    response = JSONResponse(content={"user": serialize_user(user), "error": None})
    _set_session_cookie(response, token)
    return response


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"ok": True, "error": None})
    _clear_session_cookie(response)
    return response


@router.get("/me")
async def me(request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _auth_user_id_from_request(request)
    if not user_id:
        return {"user": None, "error": None}

    user = await _get_user_by_id(db, user_id)
    if not user:
        return {"user": None, "error": None}

    return {"user": serialize_user(user), "error": None}


@router.post("/exchange")
async def exchange_code(_payload: ExchangeRequest):
    # Supabase OAuth compatibility endpoint.
    # Current auth flow does not require code exchange.
    return {"ok": True, "error": None}
