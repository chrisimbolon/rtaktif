"""Use case: Register a new warga or admin account."""
from app.core.events import event_bus
from app.core.exceptions import DuplicateEntityError
from app.core.security import hash_password
from app.modules.iam.domain.entities import User
from app.modules.iam.domain.repositories import UserRepository
from app.shared.utils.phone_utils import normalise_phone, is_valid_indonesian_phone
from app.core.exceptions import ValidationError


class RegisterUser:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(
        self,
        email: str,
        phone: str,
        password: str,
        full_name: str,
        rt_group_id=None,
    ) -> User:
        if await self.user_repo.get_by_email(email) is not None:
            raise DuplicateEntityError(f"Email sudah terdaftar: {email}")

        if not is_valid_indonesian_phone(phone):
            raise ValidationError(f"Nomor telepon tidak valid: {phone}")

        user = User.create(
            email=email,
            phone=normalise_phone(phone),
            hashed_password=hash_password(password),
            full_name=full_name,
        )
        if rt_group_id:
            user.assign_rt_group(rt_group_id)

        saved = await self.user_repo.save(user)
        for event in saved.pull_events():
            await event_bus.publish(event)
        return saved
