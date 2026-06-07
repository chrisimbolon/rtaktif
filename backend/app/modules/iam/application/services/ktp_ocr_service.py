"""
KTP OCR Service — Google Vision API + structured field extraction.

DROP INTO: app/modules/iam/application/services/ktp_ocr_service.py
CREATE:     app/modules/iam/application/services/__init__.py  (empty)

Pipeline:
  1. Receive image bytes
  2. POST to Google Vision TEXT_DETECTION (Indonesian language hint)
  3. Parse raw text → KTPData dataclass
  4. Validate NIK 16-digit format + embedded birth date
  5. Cross-check extracted fields vs registration data
  6. Return KTPOCRResult with confidence + flags

Phase 2 stub: validate_nik_with_dukcapil() — swap for Verihubs post-funding.

Zero infrastructure imports — no SQLAlchemy, no FastAPI, no app.core.*.
Raises only built-in exceptions; callers handle HTTP mapping.
"""

from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# ─── Domain types ─────────────────────────────────────────────────────────────

class KTPVerificationFlag(str, Enum):
    NIK_FORMAT_INVALID      = "nik_format_invalid"
    NIK_BIRTH_DATE_MISMATCH = "nik_birth_date_mismatch"
    NAME_MISMATCH           = "name_mismatch"
    ADDRESS_RT_MISMATCH     = "address_rt_mismatch"
    LOW_OCR_CONFIDENCE      = "low_ocr_confidence"
    IMAGE_UNREADABLE        = "image_unreadable"
    EXPIRED_KTP             = "expired_ktp"


@dataclass
class KTPData:
    """Structured fields extracted from a KTP image."""
    nik:            Optional[str]  = None
    nama:           Optional[str]  = None
    tempat_lahir:   Optional[str]  = None
    tanggal_lahir:  Optional[date] = None
    jenis_kelamin:  Optional[str]  = None   # "LAKI-LAKI" | "PEREMPUAN"
    alamat:         Optional[str]  = None
    rt_rw:          Optional[str]  = None   # "005/003"
    kelurahan:      Optional[str]  = None
    kecamatan:      Optional[str]  = None
    kota:           Optional[str]  = None
    provinsi:       Optional[str]  = None
    agama:          Optional[str]  = None
    masa_berlaku:   Optional[str]  = None   # "SEUMUR HIDUP" or date string
    raw_ocr_text:   str            = ""


@dataclass
class KTPOCRResult:
    success:          bool
    ktp_data:         Optional[KTPData]          = None
    flags:            list[KTPVerificationFlag]  = field(default_factory=list)
    confidence_score: float                      = 0.0
    error_message:    Optional[str]              = None

    @property
    def has_critical_flags(self) -> bool:
        return bool({
            KTPVerificationFlag.NIK_FORMAT_INVALID,
            KTPVerificationFlag.IMAGE_UNREADABLE,
        }.intersection(self.flags))

    @property
    def suggested_action(self) -> str:
        if not self.success or self.has_critical_flags:
            return "reject_reupload"
        if self.flags:
            return "manual_review"
        return "auto_approve_ktp"

    def to_ocr_data_dict(self) -> Optional[dict]:
        """Serialize ktp_data to a JSON-safe dict for JSONB storage."""
        if not self.ktp_data:
            return None
        kd = self.ktp_data
        return {
            "nik":           kd.nik,
            "nama":          kd.nama,
            "tempat_lahir":  kd.tempat_lahir,
            "tanggal_lahir": kd.tanggal_lahir.isoformat() if kd.tanggal_lahir else None,
            "jenis_kelamin": kd.jenis_kelamin,
            "alamat":        kd.alamat,
            "rt_rw":         kd.rt_rw,
            "kelurahan":     kd.kelurahan,
            "kecamatan":     kd.kecamatan,
            "kota":          kd.kota,
            "provinsi":      kd.provinsi,
            "agama":         kd.agama,
            "masa_berlaku":  kd.masa_berlaku,
        }


# ─── NIK utilities ────────────────────────────────────────────────────────────

def validate_nik_format(nik: str) -> tuple[bool, Optional[date], Optional[str]]:
    """
    Validate NIK and decode embedded birth date + gender.

    NIK structure (16 digits):
      [0:6]  region code (province + city + district)
      [6:8]  birth day (women: day + 40)
      [8:10] birth month
      [10:12] birth year (2-digit)
      [12:16] sequence

    Returns: (is_valid, birth_date | None, gender | None)
    """
    if not nik or not re.fullmatch(r"\d{16}", nik):
        return False, None, None
    try:
        day_raw = int(nik[6:8])
        month   = int(nik[8:10])
        year_2d = int(nik[10:12])
        gender  = "PEREMPUAN" if day_raw > 40 else "LAKI-LAKI"
        day     = day_raw - 40 if day_raw > 40 else day_raw
        year    = 2000 + year_2d if year_2d <= 24 else 1900 + year_2d
        if not (1 <= month <= 12 and 1 <= day <= 31):
            return False, None, None
        return True, date(year, month, day), gender
    except (ValueError, TypeError):
        return False, None, None


def _normalize_name(name: str) -> str:
    titles = ["dr.", "ir.", "h.", "hj.", "drs.", "prof.", "s.e", "s.t", "m.m", "m.t"]
    n = name.lower().strip()
    for t in titles:
        n = n.replace(t, "")
    return re.sub(r"\s+", " ", n).strip()


def name_similarity(a: str, b: str) -> float:
    """Token overlap score — handles OCR typos and middle name differences."""
    if not a or not b:
        return 0.0
    ta = set(_normalize_name(a).split())
    tb = set(_normalize_name(b).split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


# ─── OCR text parser ──────────────────────────────────────────────────────────

_PATTERNS = {
    "nik":           r"NIK\s*[:\-]?\s*(\d{16})",
    "nama":          r"Nama\s*[:\-]?\s*([A-Z][A-Z\s\.]+)",
    "tempat_lahir":  r"Tempat.*?Lahir\s*[:\-]?\s*([A-Z][A-Z\s]+)",
    "tanggal_lahir": r"Tanggal.*?Lahir\s*[:\-]?\s*(\d{2}-\d{2}-\d{4})",
    "jenis_kelamin": r"Jenis\s*Kelamin\s*[:\-]?\s*(LAKI-LAKI|PEREMPUAN)",
    "alamat":        r"Alamat\s*[:\-]?\s*([^\n]+)",
    "rt_rw":         r"RT[/\.]RW\s*[:\-]?\s*(\d{3}/\d{3})",
    "kelurahan":     r"Kel[/\.]Desa\s*[:\-]?\s*([A-Z][A-Z\s]+)",
    "kecamatan":     r"Kecamatan\s*[:\-]?\s*([A-Z][A-Z\s]+)",
    "agama":         r"Agama\s*[:\-]?\s*([A-Z]+)",
    "masa_berlaku":  r"Berlaku.*?[:\-]?\s*(SEUMUR\s*HIDUP|\d{2}-\d{2}-\d{4})",
}


def parse_ktp_text(raw_text: str) -> KTPData:
    text = raw_text.upper()
    data = KTPData(raw_ocr_text=raw_text)

    for field_name, pattern in _PATTERNS.items():
        m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if not m:
            continue
        value = m.group(1).strip()
        if field_name == "tanggal_lahir":
            try:
                d, mo, y = value.split("-")
                object.__setattr__(data, field_name, date(int(y), int(mo), int(d)))
            except ValueError:
                pass
        else:
            object.__setattr__(data, field_name, value)

    # Kota/provinsi from header lines
    for line in [l.strip() for l in raw_text.split("\n") if l.strip()][:4]:
        if "PROVINSI" in line.upper():
            data.provinsi = line.upper().replace("PROVINSI", "").strip()
        elif "KOTA" in line.upper() or "KABUPATEN" in line.upper():
            data.kota = line.strip()

    return data


def compute_confidence(data: KTPData) -> float:
    key_fields = ["nik", "nama", "tanggal_lahir", "alamat", "rt_rw", "kelurahan", "kecamatan"]
    filled = sum(1 for f in key_fields if getattr(data, f) is not None)
    return round(filled / len(key_fields), 2)


# ─── Cross-check ──────────────────────────────────────────────────────────────

def cross_check(
    ktp: KTPData,
    registered_name: str,
    registered_rt: str,
    registered_rw: str,
    registered_kelurahan: str,
) -> list[KTPVerificationFlag]:
    flags: list[KTPVerificationFlag] = []

    nik_valid, nik_dob, _ = validate_nik_format(ktp.nik or "")
    if not nik_valid:
        flags.append(KTPVerificationFlag.NIK_FORMAT_INVALID)
    elif ktp.tanggal_lahir and nik_dob and nik_dob != ktp.tanggal_lahir:
        flags.append(KTPVerificationFlag.NIK_BIRTH_DATE_MISMATCH)

    if ktp.nama and name_similarity(ktp.nama, registered_name) < 0.6:
        flags.append(KTPVerificationFlag.NAME_MISMATCH)

    if ktp.rt_rw:
        parts = (ktp.rt_rw.split("/") + [""])[:2]
        if (parts[0].lstrip("0") != registered_rt.lstrip("0") or
                parts[1].lstrip("0") != registered_rw.lstrip("0")):
            flags.append(KTPVerificationFlag.ADDRESS_RT_MISMATCH)

    if ktp.kelurahan and name_similarity(ktp.kelurahan, registered_kelurahan) < 0.5:
        flags.append(KTPVerificationFlag.ADDRESS_RT_MISMATCH)

    return flags


# ─── Google Vision client ─────────────────────────────────────────────────────

async def _call_google_vision(image_bytes: bytes, api_key: str) -> str:
    """Returns raw OCR text from Vision API. Raises on HTTP error."""
    payload = {
        "requests": [{
            "image": {"content": base64.b64encode(image_bytes).decode()},
            "features": [{"type": "TEXT_DETECTION", "maxResults": 1}],
            "imageContext": {"languageHints": ["id"]},
        }]
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"https://vision.googleapis.com/v1/images:annotate?key={api_key}",
            json=payload,
        )
        r.raise_for_status()
    try:
        return r.json()["responses"][0]["fullTextAnnotation"]["text"]
    except (KeyError, IndexError):
        return ""


# ─── Service ──────────────────────────────────────────────────────────────────

class KTPOCRService:
    """
    Stateless service — inject via FastAPI Depends().

    Usage in route:
        from app.core.config import settings
        from app.modules.iam.application.services.ktp_ocr_service import KTPOCRService

        def get_ktp_service() -> KTPOCRService:
            return KTPOCRService(settings.GOOGLE_VISION_API_KEY)
    """

    def __init__(self, google_vision_api_key: str):
        self._api_key = google_vision_api_key

    async def verify(
        self,
        image_bytes: bytes,
        registered_name: str,
        registered_rt: str,
        registered_rw: str,
        registered_kelurahan: str,
    ) -> KTPOCRResult:
        try:
            raw_text = await _call_google_vision(image_bytes, self._api_key)
        except Exception as exc:
            logger.error("Google Vision error: %s", exc)
            return KTPOCRResult(
                success=False,
                flags=[KTPVerificationFlag.IMAGE_UNREADABLE],
                error_message=str(exc),
            )

        if not raw_text or len(raw_text.strip()) < 30:
            return KTPOCRResult(
                success=False,
                flags=[KTPVerificationFlag.IMAGE_UNREADABLE],
                error_message="OCR returned too little text — image may be blurry or not a KTP",
            )

        ktp_data   = parse_ktp_text(raw_text)
        confidence = compute_confidence(ktp_data)
        flags: list[KTPVerificationFlag] = []

        if confidence < 0.4:
            flags.append(KTPVerificationFlag.LOW_OCR_CONFIDENCE)

        flags.extend(cross_check(
            ktp=ktp_data,
            registered_name=registered_name,
            registered_rt=registered_rt,
            registered_rw=registered_rw,
            registered_kelurahan=registered_kelurahan,
        ))

        return KTPOCRResult(
            success=True,
            ktp_data=ktp_data,
            flags=flags,
            confidence_score=confidence,
        )

    async def validate_nik_with_dukcapil(self, nik: str) -> Optional[bool]:
        """
        Phase 2 stub — replace with Verihubs /v2/document-verification/ktp.
        Returns True (valid) | False (invalid) | None (unavailable).
        """
        logger.info("Dukcapil validation not integrated — NIK %s***", nik[:6])
        return None
