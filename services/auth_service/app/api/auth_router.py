from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    RefreshRequest,
    UserProfileResponse,
)
from app.services.auth_service import register_user, login_user, refresh_tokens
from app.core.dependencies import get_current_user
from app.models.user import User
from sqlalchemy import select
from shared.jwt_utils import TokenPayload

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserProfileResponse, status_code=201)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await register_user(db, req)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    access, refresh = await login_user(db, req.email, req.password)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh-token", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    access, refresh = await refresh_tokens(db, req.refresh_token)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.get("/profile", response_model=UserProfileResponse)
async def profile(
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current_user.sub))
    user = result.scalar_one_or_none()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    return user