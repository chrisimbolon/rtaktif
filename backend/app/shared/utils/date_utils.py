"""Date utilities for Indonesian billing cycles."""
from datetime import date, datetime
from app.shared.constants.indonesia import INDONESIAN_MONTHS


def get_billing_period_label(year: int, month: int) -> str:
    return f"{INDONESIAN_MONTHS[month]} {year}"


def is_overdue(due_date: date) -> bool:
    return date.today() > due_date


def current_billing_period() -> tuple[int, int]:
    """Returns (year, month) for the current billing period."""
    now = datetime.utcnow()
    return now.year, now.month
