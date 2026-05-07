"""Use case: Send WhatsApp blast to multiple residents via Fonnte."""
import httpx
from app.core.config import settings


class SendWABlast:
    async def execute(self, phone_numbers: list[str], message: str) -> dict:
        target = ",".join(phone_numbers)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.FONNTE_BASE_URL}/send",
                headers={"Authorization": settings.FONNTE_TOKEN},
                data={"target": target, "message": message},
                timeout=15.0,
            )
        return {
            "sent_to": len(phone_numbers),
            "status": response.status_code,
            "result": response.json() if response.status_code == 200 else {},
        }
