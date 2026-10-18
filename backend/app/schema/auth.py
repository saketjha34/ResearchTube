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


# ============================================================
# FORGOT & RESET PASSWORD
# ============================================================

class ForgotPasswordRequest(BaseModel):

    identifier: str = Field(
        min_length=1,
        max_length=320,
        description="Username or email address of the account",
    )


class ForgotPasswordResponse(BaseModel):

    message: str


class VerifyResetTokenResponse(BaseModel):

    valid: bool
    email_masked: str | None = None


class ResetPasswordRequest(BaseModel):

    token: str = Field(
        min_length=1,
        description="Password reset token from email link",
    )

    identifier: str = Field(
        min_length=1,
        max_length=320,
        description="Username or email address to confirm identity",
    )

    new_password: str = Field(
        min_length=8,
        max_length=128,
        description="New password (minimum 8 characters)",
    )

    confirm_password: str = Field(
        min_length=8,
        max_length=128,
        description="Confirm new password",
    )