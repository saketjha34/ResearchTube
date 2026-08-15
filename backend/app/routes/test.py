from fastapi import APIRouter, Depends

from app.db.models import User
from app.services.auth_service import get_current_user


router = APIRouter(
    prefix="/test",
    tags=["Testing"]
)


# ============================================================
# PUBLIC TEST
# ============================================================

@router.get("/public")
def public_test():

    return {
        "status": "success",
        "message": "Public API is working."
    }


# ============================================================
# PROTECTED GET
# ============================================================

@router.get("/protected")
def protected_get(
    current_user: User = Depends(get_current_user)
):

    return {
        "status": "success",
        "message": "JWT authentication is working.",
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "is_verified": current_user.is_verified
        }
    }


# ============================================================
# PROTECTED POST
# ============================================================

@router.post("/protected")
def protected_post(
    current_user: User = Depends(get_current_user)
):

    return {
        "status": "success",
        "message": "Authenticated POST request successful.",
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "username": current_user.username,
            "full_name": current_user.full_name
        }
    }