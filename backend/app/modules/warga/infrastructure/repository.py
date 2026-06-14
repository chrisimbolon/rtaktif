"""PostgreSQL implementation of ResidentRepository — updated for new schema."""
from typing import Optional
from uuid import UUID

from app.modules.warga.domain.entities import (Agama, HubunganDenganKK,
                                               JenisKelamin, Kewarganegaraan,
                                               OwnershipType, Pekerjaan,
                                               PendidikanTerakhir, Resident,
                                               ResidentStatus, StatusKawin,
                                               StatusKeluarga, StatusTinggal)
from app.modules.warga.domain.repositories import ResidentRepository
from app.modules.warga.infrastructure.models import ResidentModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class PgResidentRepository(ResidentRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> Optional[Resident]:
        row = await self.session.get(ResidentModel, entity_id)
        return self._to_entity(row) if row else None

    async def get_by_user_id(self, user_id: UUID) -> Optional[Resident]:
        """Fetch the resident record for a given user_id."""
        result = await self.session.execute(
            select(ResidentModel).where(ResidentModel.user_id == user_id)
        )
        row = result.scalar_one_or_none()
        return self._to_entity(row) if row else None

    async def get_by_rt_group(
        self, rt_group_id: UUID, status: Optional[ResidentStatus] = None
    ) -> list[Resident]:
        q = select(ResidentModel).where(ResidentModel.rt_group_id == rt_group_id)
        if status:
            q = q.where(ResidentModel.status == status.value)
        q = q.order_by(ResidentModel.full_name)
        result = await self.session.execute(q)
        return [self._to_entity(r) for r in result.scalars().all()]

    async def count_active_by_rt(self, rt_group_id: UUID) -> int:
        rows = await self.get_by_rt_group(rt_group_id, ResidentStatus.ACTIVE)
        return len(rows)

    async def save(self, entity: Resident) -> Resident:
        existing = await self.session.get(ResidentModel, entity.id)
        if existing:
            existing.status          = entity.status.value
            existing.full_name       = entity.full_name
            existing.phone           = entity.phone
            existing.kk_file_url     = entity.kk_file_url
            existing.ktp_file_url    = entity.ktp_file_url
            existing.member_count    = entity.member_count
            existing.verified_at      = entity.verified_at
            existing.verified_by      = entity.verified_by
            existing.is_anggota_kk    = entity.is_anggota_kk
            existing.added_by_user_id = entity.added_by_user_id
            # Rich profile fields
            existing.nik             = entity.nik
            existing.no_kk           = entity.no_kk
            existing.tanggal_lahir   = entity.tanggal_lahir
            existing.tempat_lahir    = entity.tempat_lahir
            existing.jenis_kelamin   = entity.jenis_kelamin.value   if entity.jenis_kelamin   else None
            existing.agama           = entity.agama.value            if entity.agama           else None
            existing.pekerjaan       = entity.pekerjaan.value        if entity.pekerjaan       else None
            existing.status_kawin    = entity.status_kawin.value     if entity.status_kawin    else None
            existing.status_tinggal  = entity.status_tinggal.value   if entity.status_tinggal  else "TETAP"
            existing.status_keluarga = entity.status_keluarga.value  if entity.status_keluarga else None
            existing.kepala_keluarga = entity.kepala_keluarga
            existing.alamat_ktp      = entity.alamat_ktp
            existing.alamat_domisili = entity.alamat_domisili  # === ADDED ===
            existing.pendidikan_terakhir = entity.pendidikan_terakhir.value if entity.pendidikan_terakhir else None
            existing.kewarganegaraan     = entity.kewarganegaraan.value if entity.kewarganegaraan else "WNI"
            existing.hubungan_dengan_kk  = entity.hubungan_dengan_kk.value if entity.hubungan_dengan_kk else None
        else:
            # === UPDATED — added fields required for create_by_admin() / ===
            # === Tambah Warga "ghost" residents (no_kk, status_keluarga,  ===
            # === alamat_ktp, alamat_domisili, status_tinggal,             ===
            # === kewarganegaraan, is_anggota_kk, added_by_user_id)        ===
            self.session.add(ResidentModel(
                id               = entity.id,
                rt_group_id      = entity.rt_group_id,
                user_id          = entity.user_id,
                full_name        = entity.full_name,
                phone            = entity.phone,
                nik              = entity.nik,
                no_kk            = entity.no_kk,
                street           = entity.street,
                rt_number        = entity.rt_number,
                rw_number        = entity.rw_number,
                kelurahan        = entity.kelurahan,
                kecamatan        = entity.kecamatan,
                kota             = entity.kota,
                block            = entity.block,
                unit_number      = entity.unit_number,
                ownership_type   = entity.ownership_type.value,
                status           = entity.status.value,
                status_tinggal   = entity.status_tinggal.value if entity.status_tinggal else "TETAP",
                status_keluarga  = entity.status_keluarga.value if entity.status_keluarga else None,
                kepala_keluarga  = entity.kepala_keluarga,
                alamat_ktp       = entity.alamat_ktp,
                alamat_domisili  = entity.alamat_domisili,
                kewarganegaraan  = entity.kewarganegaraan.value if entity.kewarganegaraan else "WNI",
                member_count     = entity.member_count,
                verified_at      = entity.verified_at,
                verified_by      = entity.verified_by,
                is_anggota_kk    = entity.is_anggota_kk,
                added_by_user_id = entity.added_by_user_id,
                created_at       = entity.created_at,
                updated_at       = entity.updated_at,
            ))
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> None:
        row = await self.session.get(ResidentModel, entity_id)
        if row:
            await self.session.delete(row)

    async def list_all(self) -> list[Resident]:
        result = await self.session.execute(select(ResidentModel))
        return [self._to_entity(r) for r in result.scalars().all()]

    def _to_entity(self, row: ResidentModel) -> Resident:
        return Resident(
            id             = row.id,
            rt_group_id    = row.rt_group_id,
            user_id        = row.user_id,
            full_name      = row.full_name,
            phone          = row.phone,
            nik            = row.nik,
            street         = row.street,
            rt_number      = row.rt_number,
            rw_number      = row.rw_number,
            kelurahan      = row.kelurahan,
            kecamatan      = row.kecamatan,
            kota           = row.kota,
            block          = row.block,
            unit_number    = row.unit_number,
            ownership_type = OwnershipType(row.ownership_type),
            status         = ResidentStatus(row.status),
            member_count   = row.member_count,
            kk_file_url    = row.kk_file_url,
            ktp_file_url   = row.ktp_file_url,
            verified_at      = row.verified_at,
            verified_by      = row.verified_by,
            is_anggota_kk    = row.is_anggota_kk or False,
            added_by_user_id = row.added_by_user_id,
            created_at     = row.created_at,
            updated_at     = row.updated_at,
            # Rich profile fields
            no_kk           = row.no_kk,
            tanggal_lahir   = row.tanggal_lahir,
            tempat_lahir    = row.tempat_lahir,
            jenis_kelamin   = JenisKelamin(row.jenis_kelamin)    if row.jenis_kelamin   else None,
            agama           = Agama(row.agama)                    if row.agama           else None,
            pekerjaan       = Pekerjaan(row.pekerjaan)            if row.pekerjaan       else None,
            status_kawin    = StatusKawin(row.status_kawin)       if row.status_kawin    else None,
            status_tinggal  = StatusTinggal(row.status_tinggal)   if row.status_tinggal  else StatusTinggal.TETAP,
            status_keluarga = StatusKeluarga(row.status_keluarga) if row.status_keluarga else None,
            kepala_keluarga = row.kepala_keluarga or False,
            alamat_ktp      = row.alamat_ktp,
            alamat_domisili = row.alamat_domisili,  # === ADDED ===
            pendidikan_terakhir = PendidikanTerakhir(row.pendidikan_terakhir) if row.pendidikan_terakhir else None,
            kewarganegaraan     = Kewarganegaraan(row.kewarganegaraan) if row.kewarganegaraan else Kewarganegaraan.WNI,
            hubungan_dengan_kk  = HubunganDenganKK(row.hubungan_dengan_kk) if row.hubungan_dengan_kk else None,
        )
