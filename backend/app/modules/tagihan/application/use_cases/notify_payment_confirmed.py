# backend/app/modules/tagihan/application/use_cases/notify_payment_confirmed.py
"""
WA notification handler for PaymentConfirmed event.

Subscribed to PaymentConfirmed in app startup.
Sends a WhatsApp message to the warga via Fonnte after
treasurer confirms payment (invoice → Lunas).

Message format:
  ✅ Pembayaran iuran RT Anda untuk [periode] telah dikonfirmasi.
  Nominal: Rp [amount]
  Status: LUNAS
  Terima kasih! 🙏

Architecture note:
  This is a domain event handler — fire-and-forget.
  WA send failure does NOT rollback the payment confirmation.
  The payment is already committed to DB before this runs.
"""
import httpx
import logging
import os
from app.modules.tagihan.domain.events import PaymentConfirmed

logger = logging.getLogger(__name__)

FONNTE_TOKEN    = os.getenv("FONNTE_TOKEN", "")
FONNTE_BASE_URL = os.getenv("FONNTE_BASE_URL", "https://api.fonnte.com")

INDONESIAN_MONTHS = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]


def _format_rupiah(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


async def _get_warga_phone(resident_id, db_session) -> str | None:
    """Fetch warga phone number from users table via resident → user join."""
    try:
        from sqlalchemy import select, text
        result = await db_session.execute(
            text("""
                SELECT u.phone
                FROM users u
                JOIN residents r ON r.user_id = u.id
                WHERE r.id = :resident_id
                LIMIT 1
            """),
            {"resident_id": str(resident_id)}
        )
        row = result.fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.warning(f"[WA] Could not fetch phone for resident {resident_id}: {e}")
        return None


async def send_wa_payment_confirmed(
    phone: str,
    period_label: str,
    amount_idr: int,
    invoice_id: str,
) -> bool:
    """
    Sends WA message via Fonnte API.
    Returns True on success, False on failure (non-blocking).
    """
    if not FONNTE_TOKEN:
        logger.info("[WA] FONNTE_TOKEN not set — skipping WA notification")
        return False

    message = (
        f"✅ *Pembayaran Iuran RT Dikonfirmasi*\n\n"
        f"Halo! Pembayaran iuran Anda telah dikonfirmasi oleh Ketua RT.\n\n"
        f"📅 Periode  : {period_label}\n"
        f"💰 Nominal  : {_format_rupiah(amount_idr)}\n"
        f"🏷️ Status   : *LUNAS*\n\n"
        f"Terima kasih atas pembayaran tepat waktu Anda! 🙏\n"
        f"_RTMudah — Sistem Manajemen RT Digital_"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{FONNTE_BASE_URL}/send",
                headers={"Authorization": FONNTE_TOKEN},
                data={
                    "target":  phone,
                    "message": message,
                    "delay":   "2",
                },
            )
            result = resp.json()
            if result.get("status"):
                logger.info(f"[WA] Payment confirmed notification sent to {phone[:6]}***")
                return True
            else:
                logger.warning(f"[WA] Fonnte returned error: {result}")
                return False
    except Exception as e:
        logger.error(f"[WA] Failed to send WA notification: {e}")
        return False


class NotifyPaymentConfirmed:
    """
    Event handler — wired to PaymentConfirmed in app/main.py startup.

    Usage in main.py:
        from app.modules.tagihan.application.use_cases.notify_payment_confirmed import (
            NotifyPaymentConfirmed
        )
        from app.modules.tagihan.domain.events import PaymentConfirmed
        from app.core.events import event_bus

        notifier = NotifyPaymentConfirmed()
        event_bus.subscribe(PaymentConfirmed, notifier.handle)
    """

    async def handle(self, event: PaymentConfirmed) -> None:
        """
        Handles PaymentConfirmed domain event.

        Fetches warga phone via DB, sends WA message.
        All errors are caught and logged — never raises,
        so payment transaction is never rolled back.
        """
        try:
            from app.core.database import AsyncSessionLocal
            from sqlalchemy import select, text

            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    text("""
                        SELECT u.phone, u.full_name,
                               i.period_month, i.period_year
                        FROM users u
                        JOIN residents r ON r.user_id = u.id
                        JOIN invoices i  ON i.id = :invoice_id
                        WHERE r.id = :resident_id
                        LIMIT 1
                    """),
                    {
                        "invoice_id":  str(event.invoice_id),
                        "resident_id": str(event.resident_id),
                    }
                )
                row = result.fetchone()

            if not row:
                logger.warning(
                    f"[WA] No phone found for resident {event.resident_id}"
                )
                return

            phone, full_name, period_month, period_year = row

            if not phone:
                logger.info(f"[WA] Warga {full_name} has no phone — skipping")
                return

            wa_phone = phone.replace("+", "").replace("-", "").replace(" ", "")
            if wa_phone.startswith("0"):
                wa_phone = "62" + wa_phone[1:]

            period_label = (
                f"{INDONESIAN_MONTHS[period_month]} {period_year}"
                if period_month else "periode ini"
            )

            await send_wa_payment_confirmed(
                phone=wa_phone,
                period_label=period_label,
                amount_idr=event.amount_idr,
                invoice_id=str(event.invoice_id),
            )

        except Exception as e:
            logger.error(f"[WA] NotifyPaymentConfirmed.handle error: {e}", exc_info=True)
