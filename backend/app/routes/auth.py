import json
from urllib.parse import quote

# pyrefly: ignore [missing-import]
import structlog

from app.core.limiter import limiter

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request
)

from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from authlib.integrations.starlette_client import (
    OAuth
)

from app.core.config import settings

from app.db.database import get_db

from app.db.models import (
    User,
    OAuthAccount,
    AuthProvider
)

from app.schema.auth import (
    RegisterRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
)

from app.services.auth_service import (
    create_local_user,
    authenticate_user,
    create_token_pair,
    rotate_refresh_token,
    revoke_refresh_token,
    get_user_by_id,
    get_current_user,
    update_user_profile,
    change_local_user_password,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

_logger = structlog.get_logger("auth")


# ============================================================
# GOOGLE OAUTH
# ============================================================

oauth = OAuth()

oauth.register(

    name="google",

    client_id=settings.GOOGLE_CLIENT_ID,

    client_secret=settings.GOOGLE_CLIENT_SECRET,

    server_metadata_url=(
        "https://accounts.google.com/.well-known/openid-configuration"
    ),

    client_kwargs={

        "scope":
            "openid email profile"
    }
)


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/hour")          # prevent account-creation spam
async def register(
    request: Request,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):

    try:

        user = await create_local_user(

            db=db,

            email=data.email,

            password=data.password,

            username=data.username,

            full_name=data.full_name
        )

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    access_token, refresh_token = (
        await create_token_pair(
            db,
            user
        )
    )

    return TokenResponse(

        access_token=access_token,

        refresh_token=refresh_token,

        user=user
    )


@router.post(
    "/login",
    response_model=TokenResponse
)
@limiter.limit("10/minute")        # brute-force protection
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):

    user = await authenticate_user(
        db=db,
        email=form_data.username,
        password=form_data.password
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    access_token, refresh_token = await create_token_pair(
        db,
        user
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user
    )


# ============================================================
# REFRESH
# ============================================================

@router.post(
    "/refresh",
    response_model=TokenResponse
)
@limiter.limit("30/minute")        # token refresh abuse
async def refresh(
    request: Request,
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):

    try:

        access_token, refresh_token = (
            await rotate_refresh_token(
                db,
                data.refresh_token
            )
        )

    except ValueError as e:

        raise HTTPException(
            status_code=401,
            detail=str(e)
        )

    # Get user from new refresh token

    from app.services.auth_service import (
        get_refresh_session
    )

    session = await get_refresh_session(
        db,
        refresh_token
    )

    if not session:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token."
        )

    user = await get_user_by_id(
        db,
        session.user_id
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found."
        )

    return TokenResponse(

        access_token=access_token,

        refresh_token=refresh_token,

        user=user
    )


# ============================================================
# LOGOUT
# ============================================================

@router.post(
    "/logout"
)
@limiter.limit("20/minute")        # prevent refresh token flood
async def logout(
    request: Request,
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):

    await revoke_refresh_token(

        db,

        data.refresh_token
    )

    return {

        "message":
            "Successfully logged out."
    }


# ============================================================
# GOOGLE LOGIN
# ============================================================

@router.get(
    "/google"
)
@limiter.limit("10/minute")        # prevent OAuth initiation spam
async def google_login(
    request: Request,
    prompt: str | None = None,
):

    if settings.ENVIRONMENT == "prod" or request.headers.get("x-forwarded-proto") == "https":
        request.scope["scheme"] = "https"

    redirect_uri = request.url_for("google_callback")
    selected_prompt = prompt or "select_account"

    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
        prompt=selected_prompt,
        access_type="offline",
        include_granted_scopes="true",
    )


# ============================================================
# GOOGLE CALLBACK
# ============================================================

@router.get(
    "/google/callback",
    name="google_callback"
)
async def google_callback(

    request: Request,

    db: AsyncSession = Depends(get_db)
):

    if settings.ENVIRONMENT == "prod" or request.headers.get("x-forwarded-proto") == "https":
        request.scope["scheme"] = "https"

    try:

        token = await oauth.google.authorize_access_token(
            request
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        _logger.error("auth.google_callback_failed", exc=str(e))
        raise HTTPException(

            status_code=401,

            detail=f"Google authentication failed: {str(e)}"
        )

    user_info = token.get(
        "userinfo"
    )

    if not user_info:

        raise HTTPException(

            status_code=401,

            detail="Could not retrieve Google user information."
        )

    google_id = user_info.get(
        "sub"
    )

    email = user_info.get(
        "email"
    )

    name = user_info.get(
        "name"
    )

    picture = user_info.get(
        "picture"
    )

    email_verified = user_info.get(
        "email_verified",
        False
    )

    if not google_id or not email:

        raise HTTPException(

            status_code=400,

            detail="Google account did not provide required information."
        )

    # --------------------------------------------------------
    # Find existing Google account
    # --------------------------------------------------------

    oauth_account = await db.scalar(

        select(OAuthAccount).where(

            OAuthAccount.provider
            == AuthProvider.GOOGLE,

            OAuthAccount.provider_user_id
            == google_id
        )
    )

    # --------------------------------------------------------
    # Existing Google account
    # --------------------------------------------------------

    if oauth_account:

        user = await db.scalar(

            select(User).where(

                User.id
                == oauth_account.user_id
            )
        )

    # --------------------------------------------------------
    # New Google account
    # --------------------------------------------------------

    else:

        user = await db.scalar(

            select(User).where(

                User.email
                == email.lower()
            )
        )

        # ----------------------------------------------------
        # Existing local user with same email
        # ----------------------------------------------------

        if not user:

            user = User(

                email=email.lower(),

                full_name=name,

                profile_picture_url=picture,

                is_active=True,

                is_verified=email_verified
            )

            db.add(user)

            await db.flush()

        else:

            # Optionally update profile information

            if not user.profile_picture_url:

                user.profile_picture_url = picture

            if not user.full_name:

                user.full_name = name

            if email_verified:

                user.is_verified = True

        # ----------------------------------------------------
        # Create OAuth account
        # ----------------------------------------------------

        oauth_account = OAuthAccount(

            user_id=user.id,

            provider=AuthProvider.GOOGLE,

            provider_user_id=google_id,

            provider_email=email,

            access_token=token.get(
                "access_token"
            ),

            refresh_token=token.get(
                "refresh_token"
            )
        )

        db.add(oauth_account)

        await db.commit()

        await db.refresh(user)

    # --------------------------------------------------------
    # JWT
    # --------------------------------------------------------

    access_token, refresh_token = (
        await create_token_pair(
            db,
            user
        )
    )

    user_payload = UserResponse.model_validate(
        user
    )

    user_json = json.dumps(
        user_payload.model_dump(mode="json")
    )

    frontend_callback = (
        f"{settings.runtime_frontend_url.rstrip('/')}"
        "/auth/callback"
    )

    fragment = (
        f"access_token={quote(access_token)}"
        f"&refresh_token={quote(refresh_token)}"
        "&token_type=bearer"
        f"&user={quote(user_json)}"
    )

    return RedirectResponse(
        url=f"{frontend_callback}#{fragment}",
        status_code=302
    )


# ============================================================
# PROFILE
# ============================================================

@router.get(
    "/me",
    response_model=UserResponse
)
@limiter.limit("60/minute")        # read-only, generous
async def get_profile(
    request: Request,
    current_user: User = Depends(get_current_user)
):

    return UserResponse.model_validate(
        current_user
    )


@router.patch(
    "/me",
    response_model=UserResponse
)
@limiter.limit("10/minute")        # profile update
async def update_profile(
    request: Request,
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):

    try:

        updated_user = await update_user_profile(
            db=db,
            user=current_user,
            full_name=data.full_name,
            username=data.username,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    return UserResponse.model_validate(
        updated_user
    )


@router.post(
    "/change-password"
)
@limiter.limit("5/minute")         # sensitive — very strict
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):

    if data.current_password == data.new_password:

        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password."
        )

    try:

        await change_local_user_password(
            db=db,
            user=current_user,
            current_password=data.current_password,
            new_password=data.new_password,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    return {
        "message":
            "Password updated successfully."
    }