from uuid import UUID

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    ConfigDict
)


# ============================================================
# REGISTER
# ============================================================

class RegisterRequest(BaseModel):

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128
    )

    username: str | None = Field(
        default=None,
        max_length=100
    )

    full_name: str | None = Field(
        default=None,
        max_length=200
    )


# ============================================================
# LOGIN
# ============================================================

class LoginRequest(BaseModel):

    email: EmailStr

    password: str


# ============================================================
# USER RESPONSE
# ============================================================

class UserResponse(BaseModel):

    id: UUID

    email: EmailStr

    username: str | None

    full_name: str | None

    profile_picture_url: str | None

    is_active: bool

    is_verified: bool

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# TOKEN RESPONSE
# ============================================================

class TokenResponse(BaseModel):

    access_token: str

    refresh_token: str

    token_type: str = "bearer"

    user: UserResponse


# ============================================================
# REFRESH REQUEST
# ============================================================

class RefreshTokenRequest(BaseModel):

    refresh_token: str


# ============================================================
# GOOGLE CALLBACK RESPONSE
# ============================================================

class GoogleAuthResponse(BaseModel):

    access_token: str

    refresh_token: str

    token_type: str = "bearer"

    user: UserResponse


# ============================================================
# UPDATE PROFILE
# ============================================================

class UpdateProfileRequest(BaseModel):

    full_name: str | None = Field(
        default=None,
        max_length=200
    )

    username: str | None = Field(
        default=None,
        max_length=100
    )


# ============================================================
# CHANGE PASSWORD
# ============================================================

class ChangePasswordRequest(BaseModel):

    current_password: str = Field(
        min_length=8,
        max_length=128
    )

    new_password: str = Field(
        min_length=8,
        max_length=128
    )