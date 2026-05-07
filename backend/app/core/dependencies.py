"""
FastAPI shared dependencies — mirrors hr-app/core/dependencies.py.
All modules import from here, never define their own auth deps.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Returns decoded JWT payload: {user_id, role}."""
    try:
        payload = decode_token(credentials.credentials)
        return {"user_id": payload["sub"], "role": payload.get("role", "warga")}
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Blocks non-admin roles. Use on admin-only endpoints."""
    if current_user["role"] not in ("admin_rt", "admin_rw", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
