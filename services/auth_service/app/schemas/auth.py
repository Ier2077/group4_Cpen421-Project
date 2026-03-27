from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.models.user import UserRole


class UserRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole
    organization_id: str | None = None


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organization_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}