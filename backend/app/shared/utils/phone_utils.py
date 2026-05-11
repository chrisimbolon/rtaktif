"""Indonesian phone number normalisation."""
import re


def normalise_phone(phone: str) -> str:
    """Normalise to 62xxxxxxxxxx format."""
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)
    if cleaned.startswith("0"):
        cleaned = "62" + cleaned[1:]
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    return cleaned


def is_valid_indonesian_phone(phone: str) -> bool:
    normalised = normalise_phone(phone)
    return bool(re.match(r"^62\d{9,13}$", normalised))
