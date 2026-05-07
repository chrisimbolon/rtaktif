"""Use case: Authenticate user and return JWT token."""
from app.core.exceptions import UnauthorizedError
from app.core.security import verify_password, create_access_token
from app.modules.iam.domain.repositories import UserRepository


class LoginUser:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(self, email: str, password: str) -> dict:
        user = await self.user_repo.get_by_email(email)

        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Email atau password salah")

        if not user.is_active:
            raise UnauthorizedError("Akun belum diverifikasi atau disuspend")

        token = create_access_token(
            data={"sub": str(user.id), "role": user.role.value}
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": str(user.id),
            "role": user.role.value,
        }
