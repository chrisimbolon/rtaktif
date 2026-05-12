"""
Use case: Send WhatsApp blast + log it to notification_logs.

Every WA blast now creates an immutable NotificationLog record.
Pak Ketua RT can always ask "did the reminder go out?" and get a real answer.
"""
from datetime import datetime, timezone
from uuid import UUID

import httpx

from app.core.config import settings
from app.modules.komunikasi.domain.entities import (
    NotificationLog, NotifType, TriggerType,
)
from app.modules.komunikasi.domain.repositories import NotificationLogRepository


class SendWABlast:
    def __init__(self, notif_log_repo: NotificationLogRepository):
        self.notif_log_repo = notif_log_repo

    async def execute(
        self,
        rt_group_id: UUID,
        sent_by: UUID,
        phone_numbers: list[str],
        message: str,
        trigger_type: TriggerType = TriggerType.MANUAL_BLAST,
        trigger_id: UUID | None = None,
    ) -> dict:
        sent_at      = datetime.now(timezone.utc)
        status       = "sent"
        failed_count = 0
        error_detail = None
        fonnte_result = {}

        # ── Send via Fonnte ───────────────────────────────────────
        if settings.FONNTE_TOKEN and phone_numbers:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.post(
                        f"{settings.FONNTE_BASE_URL}/send",
                        headers={"Authorization": settings.FONNTE_TOKEN},
                        data={
                            "target":  ",".join(phone_numbers),
                            "message": message,
                        },
                    )
                fonnte_result = res.json() if res.status_code == 200 else {}
                if res.status_code != 200:
                    status       = "failed"
                    failed_count = len(phone_numbers)
                    error_detail = f"Fonnte HTTP {res.status_code}: {res.text[:200]}"
            except Exception as exc:
                status       = "failed"
                failed_count = len(phone_numbers)
                error_detail = str(exc)[:200]
        else:
            # Dev mode — no token configured, log as "sent" for testing
            status = "sent"

        # ── Write immutable audit log ─────────────────────────────
        log = NotificationLog.record(
            rt_group_id=rt_group_id,
            sent_by=sent_by,
            trigger_type=trigger_type,
            trigger_id=trigger_id,
            notif_type=NotifType.WHATSAPP,
            recipient_count=len(phone_numbers),
            message_preview=message,
            sent_at=sent_at,
            status=status,
            failed_count=failed_count,
            error_detail=error_detail,
        )
        await self.notif_log_repo.save(log)

        return {
            "sent_to":     len(phone_numbers),
            "status":      status,
            "failed":      failed_count,
            "log_id":      str(log.id),
            "fonnte":      fonnte_result,
        }
