from uuid import UUID

import jwt

from fastapi import (
    Depends,
    HTTPException,
    status
)

from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from sqlalchemy.orm import Session

from app.core.config import settings

from app.db.database import get_db

from app.services.auth_service import (
    get_user_by_id
)


security = HTTPBearer()


# ============================================================
# GET CURRENT USER
# ============================================================

def get_current_user(

    credentials: HTTPAuthorizationCredentials =
        Depends(security),

    db: Session =
        Depends(get_db)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(

            token,

            settings.JWT_SECRET_KEY,

            algorithms=[
                settings.JWT_ALGORITHM
            ]
        )

    except jwt.ExpiredSignatureError:

        raise HTTPException(

            status_code=401,

            detail="Access token expired."
        )

    except jwt.InvalidTokenError:

        raise HTTPException(

            status_code=401,

            detail="Invalid access token."
        )

    if payload.get("type") != "access":

        raise HTTPException(

            status_code=401,

            detail="Invalid token type."
        )

    user_id = payload.get(
        "sub"
    )

    if not user_id:

        raise HTTPException(

            status_code=401,

            detail="Invalid token payload."
        )

    try:

        user_uuid = UUID(
            user_id
        )

    except ValueError:

        raise HTTPException(

            status_code=401,

            detail="Invalid user ID."
        )

    user = get_user_by_id(

        db,

        user_uuid
    )

    if not user:

        raise HTTPException(

            status_code=401,

            detail="User not found."
        )

    if not user.is_active:

        raise HTTPException(

            status_code=403,

            detail="User account is inactive."
        )

    return user