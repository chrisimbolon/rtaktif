"""
app/modules/warga/application/use_cases/import_residents.py
import_residents.py
═══════════════════
Two-phase Excel import for Tambah Warga bulk flow:

  Phase 1 — parse_excel(file_bytes)
    Reads the .xlsx, validates every row, returns valid + error lists.
    Nothing is written to the database.

  Phase 2 — bulk_create(valid_rows, rt_group_id, added_by_user_id, db)
    Loops Resident.create_by_admin() for each validated row and flushes
    them all in one transaction. Returns (imported_count, failed_rows).

Column mapping (Row 1 = headers, data starts Row 2):
  A  nama_lengkap       *required*
  B  no_whatsapp        *required*
  C  nik
  D  no_kk
  E  tanggal_lahir      YYYY-MM-DD
  F  tempat_lahir
  G  jenis_kelamin      LAKI-LAKI | PEREMPUAN
  H  agama
  I  pekerjaan
  J  status_kawin
  K  status_tinggal
  L  status_keluarga
  M  alamat_ktp
  N  alamat_domisili
  O  pendidikan_terakhir
  P  kewarganegaraan
  Q  hubungan_dengan_kk
"""
from __future__ import annotations

import io
import re
from datetime import date
from typing import Any, Optional
from uuid import UUID

from app.modules.warga.domain.entities import (Agama, HubunganDenganKK,
                                               JenisKelamin, Kewarganegaraan,
                                               OwnershipType, Pekerjaan,
                                               PendidikanTerakhir, Resident,
                                               StatusKawin, StatusKeluarga,
                                               StatusTinggal)
from app.modules.warga.infrastructure.repository import PgResidentRepository
from sqlalchemy.ext.asyncio import AsyncSession

# ── Constants ──────────────────────────────────────────────────────────────────

EXPECTED_HEADERS = [
    "nama_lengkap", "no_whatsapp", "nik", "no_kk", "tanggal_lahir",
    "tempat_lahir", "jenis_kelamin", "agama", "pekerjaan", "status_kawin",
    "status_tinggal", "status_keluarga", "alamat_ktp", "alamat_domisili",
    "pendidikan_terakhir", "kewarganegaraan", "hubungan_dengan_kk",
]

ENUM_MAP: dict[str, type] = {
    "jenis_kelamin":       JenisKelamin,
    "agama":               Agama,
    "pekerjaan":           Pekerjaan,
    "status_kawin":        StatusKawin,
    "status_tinggal":      StatusTinggal,
    "status_keluarga":     StatusKeluarga,
    "pendidikan_terakhir": PendidikanTerakhir,
    "kewarganegaraan":     Kewarganegaraan,
    "hubungan_dengan_kk":  HubunganDenganKK,
}

# ── Types ──────────────────────────────────────────────────────────────────────

class RowError:
    def __init__(self, row: int, field: str, value: str, reason: str):
        self.row    = row
        self.field  = field
        self.value  = value
        self.reason = reason

    def to_dict(self) -> dict:
        return {
            "row":    self.row,
            "field":  self.field,
            "value":  self.value,
            "reason": self.reason,
        }


class ValidRow:
    def __init__(self, row: int, data: dict[str, Any]):
        self.row  = row
        self.data = data

    def to_dict(self) -> dict:
        d = {"row": self.row}
        d.update({
            k: (v.isoformat() if isinstance(v, date) else
                v.value       if hasattr(v, "value") else v)
            for k, v in self.data.items()
        })
        return d


# ── Phone normalisation ────────────────────────────────────────────────────────

def _normalise_phone(raw: str) -> str:
    """Strip spaces/dashes, convert to 62-prefix format."""
    v = re.sub(r"[\s\-]", "", str(raw).strip())
    if v.startswith("0"):
        v = "62" + v[1:]
    elif v.startswith("+"):
        v = v[1:]
    return v


def _validate_phone(raw: str) -> tuple[str | None, str | None]:
    """Returns (normalised, error_reason)."""
    if not raw:
        return None, "Nomor HP wajib diisi"
    v = _normalise_phone(raw)
    digits_after_62 = v[2:] if v.startswith("62") else ""
    if not v.startswith("62") or not digits_after_62.isdigit() or not (8 <= len(digits_after_62) <= 13):
        return None, f"Format tidak valid (contoh: 081234567890)"
    return v, None


# ── Row validator ──────────────────────────────────────────────────────────────

def _validate_row(row_num: int, raw: dict[str, str]) -> tuple[ValidRow | None, list[RowError]]:
    errors: list[RowError] = []
    data:   dict[str, Any] = {}

    # ── nama_lengkap (required) ───────────────────────────────────────────────
    name = (raw.get("nama_lengkap") or "").strip()
    if len(name) < 3:
        errors.append(RowError(row_num, "nama_lengkap", name,
                               "Nama lengkap minimal 3 karakter"))
    else:
        data["full_name"] = name

    # ── no_whatsapp (required) ────────────────────────────────────────────────
    phone_raw = (raw.get("no_whatsapp") or "").strip()
    phone, phone_err = _validate_phone(phone_raw)
    if phone_err:
        errors.append(RowError(row_num, "no_whatsapp", phone_raw, phone_err))
    else:
        data["phone"] = phone

    # ── nik (optional, must be 16 digits if present) ─────────────────────────
    nik = (raw.get("nik") or "").strip()
    if nik:
        if not nik.isdigit() or len(nik) != 16:
            errors.append(RowError(row_num, "nik", nik, "Harus 16 digit angka"))
        else:
            data["nik"] = nik

    # ── no_kk (optional, must be 16 digits if present) ───────────────────────
    no_kk = (raw.get("no_kk") or "").strip()
    if no_kk:
        if not no_kk.isdigit() or len(no_kk) != 16:
            errors.append(RowError(row_num, "no_kk", no_kk, "Harus 16 digit angka"))
        else:
            data["no_kk"] = no_kk

    # ── tanggal_lahir (optional) ──────────────────────────────────────────
    # Accepts DD-MM-YYYY, DD/MM/YYYY, and YYYY-MM-DD — covers the natural
    # Indonesian format (dash or slash) plus ISO format for exported data.
    tgl = (raw.get("tanggal_lahir") or "").strip()
    if tgl:
        parsed_date = None
        for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
            try:
                from datetime import datetime as _dt
                parsed_date = _dt.strptime(tgl, fmt).date()
                break
            except ValueError:
                continue
        if parsed_date:
            data["tanggal_lahir"] = parsed_date
        else:
            errors.append(RowError(row_num, "tanggal_lahir", tgl,
                                   "Format harus DD-MM-YYYY (cth: 21-05-1990)"))

    # ── Simple optional string fields ─────────────────────────────────────────
    for field in ("tempat_lahir", "alamat_ktp", "alamat_domisili"):
        val = (raw.get(field) or "").strip()
        if val:
            data[field] = val

    # ── Enum fields (optional, validated against domain enums) ───────────────
    for field, enum_cls in ENUM_MAP.items():
        val = (raw.get(field) or "").strip().upper()
        if not val:
            continue
        valid_values = [e.value for e in enum_cls]
        if val not in valid_values:
            errors.append(RowError(
                row_num, field, val,
                f"Nilai tidak valid. Pilihan: {', '.join(valid_values)}"
            ))
        else:
            data[field] = enum_cls(val)

    if errors:
        return None, errors
    return ValidRow(row_num, data), []


# ── Phase 1 — Parse ───────────────────────────────────────────────────────────

def parse_excel(file_bytes: bytes) -> dict:
    """
    Parse an uploaded .xlsx file and validate every data row.

    Returns:
        {
            "valid":       [ValidRow.to_dict(), ...],
            "errors":      [RowError.to_dict(), ...],
            "total_rows":  int,
            "valid_count": int,
            "error_count": int,
        }

    Raises ValueError if the file is not a valid .xlsx or headers are wrong.
    """
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    except Exception:
        raise ValueError("File tidak dapat dibaca — pastikan format .xlsx")

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    if not rows:
        raise ValueError("File kosong")

    # ── Header row validation ─────────────────────────────────────────────────
    headers = [str(h).strip().lower() if h else "" for h in rows[0]]
    # Only check first 2 required headers — rest are optional and order-matched
    if len(headers) < 2 or headers[0] != "nama_lengkap" or headers[1] != "no_whatsapp":
        raise ValueError(
            "Header tidak sesuai template. "
            "Kolom A harus 'nama_lengkap', Kolom B harus 'no_whatsapp'. "
            "Download template terbaru dan coba lagi."
        )

    valid_rows:  list[dict] = []
    error_rows:  list[dict] = []

    for i, row in enumerate(rows[1:], start=2):   # row 2 onwards
        # Skip completely empty rows
        if all(cell is None or str(cell).strip() == "" for cell in row):
            continue

        # Map cells to header names (use only known headers)
        raw: dict[str, str] = {}
        for col_idx, header in enumerate(headers):
            if header in EXPECTED_HEADERS and col_idx < len(row):
                cell = row[col_idx]
                raw[header] = str(cell).strip() if cell is not None else ""

        valid_row, errors = _validate_row(i, raw)
        if valid_row:
            valid_rows.append(valid_row.to_dict())
        else:
            for e in errors:
                error_rows.append(e.to_dict())

    wb.close()

    return {
        "valid":       valid_rows,
        "errors":      error_rows,
        "total_rows":  len(valid_rows) + len({e["row"] for e in error_rows}),
        "valid_count": len(valid_rows),
        "error_count": len({e["row"] for e in error_rows}),
    }


# ── Phase 2 — Bulk Create ─────────────────────────────────────────────────────

async def bulk_create(
    valid_rows:       list[dict],
    rt_group_id:      UUID,
    added_by_user_id: UUID,
    db:               AsyncSession,
) -> dict:
    """
    Bulk-insert validated rows as ghost residents via Resident.create_by_admin().

    Returns:
        { "imported": int, "failed": int, "failed_rows": [...] }
    """
    from app.modules.warga.domain.entities import StatusKeluarga
    from sqlalchemy.exc import IntegrityError

    repo = PgResidentRepository(db)
    imported   = 0
    failed     = 0
    failed_rows: list[dict] = []

    for row_data in valid_rows:
        row_num = row_data.get("row", "?")
        try:
            # Re-coerce enum fields from string (they were serialised to .value in to_dict)
            coerced: dict = {}
            for k, v in row_data.items():
                if k == "row":
                    continue
                if k in ENUM_MAP and v:
                    try:
                        coerced[k] = ENUM_MAP[k](v)
                    except ValueError:
                        coerced[k] = None
                
                elif k == "tanggal_lahir" and v:
                    coerced[k] = None
                    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
                        try:
                            from datetime import datetime as _dt
                            coerced[k] = _dt.strptime(v, fmt).date()
                            break
                        except ValueError:
                            continue
                else:
                    coerced[k] = v or None

            resident = Resident.create_by_admin(
                rt_group_id=rt_group_id,
                full_name=coerced.pop("full_name"),
                phone=coerced.pop("phone"),
                added_by_user_id=added_by_user_id,
                nik=coerced.pop("nik", None),
                no_kk=coerced.pop("no_kk", None),
                status_keluarga=coerced.pop("status_keluarga", None),
                alamat_ktp=coerced.pop("alamat_ktp", None),
                alamat_domisili=coerced.pop("alamat_domisili", None),
                # === ADDED — pass through the full profile, previously
                # === silently discarded by the old 5-field signature ===
                tanggal_lahir=coerced.pop("tanggal_lahir", None),
                tempat_lahir=coerced.pop("tempat_lahir", None),
                jenis_kelamin=coerced.pop("jenis_kelamin", None),
                agama=coerced.pop("agama", None),
                pekerjaan=coerced.pop("pekerjaan", None),
                status_kawin=coerced.pop("status_kawin", None),
                status_tinggal=coerced.pop("status_tinggal", None),
                pendidikan_terakhir=coerced.pop("pendidikan_terakhir", None),
                kewarganegaraan=coerced.pop("kewarganegaraan", None),
                hubungan_dengan_kk=coerced.pop("hubungan_dengan_kk", None),
            )
            await repo.save(resident)
            imported += 1

        except IntegrityError:
            await db.rollback()
            failed += 1
            failed_rows.append({"row": row_num, "reason": "Data duplikat"})
        except Exception as e:
            failed += 1
            failed_rows.append({"row": row_num, "reason": str(e)})

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return {"imported": 0, "failed": len(valid_rows),
                "failed_rows": [{"row": "all", "reason": "Transaksi gagal — data duplikat"}]}

    return {
        "imported":    imported,
        "failed":      failed,
        "failed_rows": failed_rows,
    }
