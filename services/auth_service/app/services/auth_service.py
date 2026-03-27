from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError

from app.core.config import settings
from app.models.user import User, RefreshToken, UserRole
from app.schemas.auth import UserRegisterRequest
from shared.jwt_utils import create_access_token, create_refresh_token, decode_token
from fastapi import HTTPException, status
import uuid

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


async def register_user(db: AsyncSession, req: UserRegisterRequest) -> User:
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        id=str(uuid.uuid4()),
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
        role=req.role,
        organization_id=req.organization_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def login_user(db: AsyncSession, email: str, password: str):
    result = await db.execute(select(User).where(User.email == email))
    user: User | None = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {"sub": user.id, "role": user.role.value, "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token_str = create_refresh_token(token_data)

    # Store refresh token
    rt = RefreshToken(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    await db.commit()
    return access_token, refresh_token_str


async def refresh_tokens(db: AsyncSession, refresh_token: str):
    # Validate token
    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == refresh_token,
            RefreshToken.is_revoked == False,  # noqa
        )
    )
    rt: RefreshToken | None = result.scalar_one_or_none()
    if not rt or rt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expired or revoked")

    # Revoke old
    rt.is_revoked = True
    await db.flush()

    # Issue new
    token_data = {"sub": payload.sub, "role": payload.role, "email": payload.email}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    new_rt = RefreshToken(
        id=str(uuid.uuid4()),
        user_id=payload.sub,
        token=new_refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_rt)
    await db.commit()
    return new_access, new_refresh