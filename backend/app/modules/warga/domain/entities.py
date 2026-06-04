"""Warga domain entities — enriched with Indonesian RT profile fields."""
from dataclasses import dataclass
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID

from app.core.base_entity import BaseEntity
from app.core.exceptions import InvalidStateTransitionError
from app.modules.warga.domain.events import (ResidentMovedOut,
                                             ResidentRegistered,
                                             ResidentVerified)


class ResidentStatus(str, Enum):
    PENDING   = "pending"
    ACTIVE    = "active"
    MOVED_OUT = "moved_out"


class OwnershipType(str, Enum):
    OWNER  = "owner"
    TENANT = "tenant"


class JenisKelamin(str, Enum):
    LAKI_LAKI = "LAKI-LAKI"
    PEREMPUAN = "PEREMPUAN"


class Agama(str, Enum):
    ISLAM     = "ISLAM"
    KATHOLIK  = "KATHOLIK"
    KRISTEN   = "KRISTEN"
    HINDU     = "HINDU"
    BUDDHA    = "BUDDHA"
    KONGHUCU  = "KONGHUCU"


class Pekerjaan(str, Enum):
    PELAJAR_MAHASISWA     = "PELAJAR/MAHASISWA"
    PNS                   = "PNS"
    KARYAWAN_SWASTA       = "KARYAWAN SWASTA"
    KARYAWAN_BUMN         = "KARYAWAN BUMN"
    TNI                   = "TNI"
    POLRI                 = "POLRI"
    NAKES                 = "NAKES"
    WIRASWASTA            = "WIRASWASTA"
    MENGURUS_RUMAH_TANGGA = "MENGURUS RUMAH TANGGA"
    GURU                  = "GURU"
    OJEK                  = "OJEK"
    LAINNYA               = "LAINNYA"


class StatusKawin(str, Enum):
    BELUM_KAWIN = "BELUM KAWIN"
    KAWIN       = "KAWIN"
    CERAI_HIDUP = "CERAI HIDUP"
    CERAI_MATI  = "CERAI MATI"


class StatusTinggal(str, Enum):
    TETAP     = "TETAP"       # permanent resident
    KONTRAK   = "KONTRAK"     # renting
    KOST      = "KOST"        # boarding house
    PINDAH    = "PINDAH"      # moved out
    MENINGGAL = "MENINGGAL"   # deceased
    LAINNYA   = "LAINNYA"


class StatusKeluarga(str, Enum):
    SUAMI      = "SUAMI"
    ISTRI      = "ISTRI"
    ANAK       = "ANAK"
    ORANG_TUA  = "ORANG TUA"
    SAUDARA    = "SAUDARA"
    LAINNYA    = "LAINNYA"
    NA         = "N/A"

class PendidikanTerakhir(str, Enum):
    TIDAK_SEKOLAH   = "TIDAK SEKOLAH"
    BELUM_SEKOLAH   = "BELUM SEKOLAH"
    SD              = "SD"
    SMP             = "SMP"
    SMA             = "SMA"
    SMK             = "SMK"
    D3              = "D3"
    S1              = "S1"
    S2              = "S2"
    S3              = "S3"
    LAINNYA         = "LAINNYA"


class Kewarganegaraan(str, Enum):
    WNI = "WNI"
    WNA = "WNA"


class HubunganDenganKK(str, Enum):
    KEPALA_KELUARGA = "KEPALA KELUARGA"
    SUAMI           = "SUAMI"
    ISTRI           = "ISTRI"
    ANAK            = "ANAK"
    MENANTU         = "MENANTU"
    CUCU            = "CUCU"
    ORANG_TUA       = "ORANG TUA"
    MERTUA          = "MERTUA"
    SAUDARA         = "SAUDARA"
    PEMBANTU        = "PEMBANTU"
    LAINNYA         = "LAINNYA"

@dataclass
class Resident(BaseEntity):
    """
    Aggregate Root — a household member registered in an RT.

    Enriched with Indonesian RT-specific fields:
    - NIK + no_kk for official letter generation
    - status_tinggal for accurate census data
    - kepala_keluarga for household billing
    - agama + pekerjaan for RT administrative needs
    """
    rt_group_id:    Optional[UUID]              = None
    user_id:        Optional[UUID]              = None
    full_name:      str                         = ""
    phone:          str                         = ""

    # ── Identity fields (from KTP) ────────────────────────────────
    nik:            Optional[str]               = None
    no_kk:          Optional[str]               = None
    tanggal_lahir:  Optional[date]              = None
    tempat_lahir:   Optional[str]               = None
    jenis_kelamin:  Optional[JenisKelamin]      = None
    agama:          Optional[Agama]             = None
    alamat_ktp:     Optional[str]               = None

    pendidikan_terakhir: Optional[PendidikanTerakhir] = None
    kewarganegaraan:     Kewarganegaraan               = Kewarganegaraan.WNI
    hubungan_dengan_kk:  Optional[HubunganDenganKK]   = None



    # ── Socioeconomic fields ──────────────────────────────────────
    pekerjaan:      Optional[Pekerjaan]         = None
    status_kawin:   Optional[StatusKawin]       = None

    # ── RT-specific fields ────────────────────────────────────────
    status_tinggal: StatusTinggal               = StatusTinggal.TETAP
    status_keluarga: Optional[StatusKeluarga]   = None
    kepala_keluarga: bool                       = False

    # ── Address fields ─────────────────────────────────────────────
    street:         str                         = ""
    rt_number:      str                         = ""
    rw_number:      str                         = ""
    kelurahan:      str                         = ""
    kecamatan:      str                         = ""
    kota:           str                         = ""
    block:          str                         = ""
    unit_number:    str                         = ""

    # ── Ownership + status ────────────────────────────────────────
    ownership_type: OwnershipType               = OwnershipType.OWNER
    status:         ResidentStatus              = ResidentStatus.PENDING
    member_count:   int                         = 1

    # ── Document URLs ─────────────────────────────────────────────
    kk_file_url:    Optional[str]               = None
    ktp_file_url:   Optional[str]               = None

    # ── Verification ─────────────────────────────────────────────
    verified_at:    Optional[datetime]          = None
    verified_by:    Optional[UUID]              = None

    @classmethod
    def register(
        cls,
        rt_group_id: UUID, user_id: UUID, full_name: str, phone: str,
        street: str, rt_number: str, rw_number: str,
        kelurahan: str, kecamatan: str, kota: str,
        block: str, unit_number: str,
        ownership_type: OwnershipType = OwnershipType.OWNER,
        member_count: int = 1,
    ) -> "Resident":
        r = cls(
            rt_group_id=rt_group_id, user_id=user_id,
            full_name=full_name, phone=phone,
            street=street, rt_number=rt_number, rw_number=rw_number,
            kelurahan=kelurahan, kecamatan=kecamatan, kota=kota,
            block=block, unit_number=unit_number,
            ownership_type=ownership_type, member_count=member_count,
        )
        r.add_event(ResidentRegistered(
            resident_id=r.id, rt_group_id=rt_group_id, full_name=full_name,
        ))
        return r

    def update_profile(
        self,
        full_name:       Optional[str]           = None,
        phone:           Optional[str]           = None,
        nik:             Optional[str]           = None,
        no_kk:           Optional[str]           = None,
        tanggal_lahir:   Optional[date]          = None,
        tempat_lahir:    Optional[str]           = None,
        jenis_kelamin:   Optional[JenisKelamin]  = None,
        agama:           Optional[Agama]         = None,
        pekerjaan:       Optional[Pekerjaan]     = None,
        status_kawin:    Optional[StatusKawin]   = None,
        status_tinggal:  Optional[StatusTinggal] = None,
        status_keluarga: Optional[StatusKeluarga]= None,
        kepala_keluarga: Optional[bool]          = None,
        alamat_ktp:          Optional[str]             = None,
        pendidikan_terakhir: Optional[PendidikanTerakhir] = None,
        kewarganegaraan:     Optional[Kewarganegaraan]    = None,
        hubungan_dengan_kk:  Optional[HubunganDenganKK]  = None,
    ) -> None:
        """Update mutable profile fields. None values are ignored (partial update)."""
        if full_name       is not None: self.full_name       = full_name.strip()
        if phone           is not None: self.phone           = phone
        if nik             is not None: self.nik             = nik
        if no_kk           is not None: self.no_kk           = no_kk
        if tanggal_lahir   is not None: self.tanggal_lahir   = tanggal_lahir
        if tempat_lahir    is not None: self.tempat_lahir    = tempat_lahir.strip()
        if jenis_kelamin   is not None: self.jenis_kelamin   = jenis_kelamin
        if agama           is not None: self.agama           = agama
        if pekerjaan       is not None: self.pekerjaan       = pekerjaan
        if status_kawin    is not None: self.status_kawin    = status_kawin
        if status_tinggal  is not None: self.status_tinggal  = status_tinggal
        if status_keluarga is not None: self.status_keluarga = status_keluarga
        if kepala_keluarga is not None: self.kepala_keluarga = kepala_keluarga
        if alamat_ktp            is not None: self.alamat_ktp            = alamat_ktp.strip()
        if pendidikan_terakhir   is not None: self.pendidikan_terakhir   = pendidikan_terakhir
        if kewarganegaraan       is not None: self.kewarganegaraan       = kewarganegaraan
        if hubungan_dengan_kk    is not None: self.hubungan_dengan_kk    = hubungan_dengan_kk

    def verify(self, verified_by: UUID) -> None:
        if self.status != ResidentStatus.PENDING:
            raise InvalidStateTransitionError(
                f"Tidak bisa verifikasi status: {self.status}"
            )
        self.status      = ResidentStatus.ACTIVE
        self.verified_at = datetime.now(timezone.utc)
        self.verified_by = verified_by
        self.add_event(ResidentVerified(
            resident_id=self.id, verified_by=verified_by
        ))

    def move_out(self) -> None:
        if self.status == ResidentStatus.MOVED_OUT:
            raise InvalidStateTransitionError("Warga sudah pindah")
        self.status        = ResidentStatus.MOVED_OUT
        self.status_tinggal = StatusTinggal.PINDAH
        self.add_event(ResidentMovedOut(
            resident_id=self.id, rt_group_id=self.rt_group_id
        ))

    def upload_kk(self,  url: str) -> None: self.kk_file_url  = url
    def upload_ktp(self, url: str) -> None: self.ktp_file_url = url

    @property
    def is_active(self) -> bool:
        return self.status == ResidentStatus.ACTIVE

    @property
    def block_unit_display(self) -> str:
        return f"Blok {self.block} No. {self.unit_number}"
