"""
app.services.auth — Authentication services package.

Re-exports all auth singletons and FastAPI dependencies.
"""

from app.services.auth.local_auth_service import LocalAuthService, local_auth_service
from app.services.auth.google_auth_service import GoogleAuthService, google_auth_service
from app.services.auth.profile_service import ProfileService, profile_service
from app.services.auth.forget_password import ForgetPasswordService, forget_password_service
from app.services.auth.security_deps import oauth2_scheme, get_current_user

__all__ = [
    # Classes
    "LocalAuthService",
    "GoogleAuthService",
    "ProfileService",
    "ForgetPasswordService",
    # Instances
    "local_auth_service",
    "google_auth_service",
    "profile_service",
    "forget_password_service",
    # FastAPI deps
    "oauth2_scheme",
    "get_current_user",
]
