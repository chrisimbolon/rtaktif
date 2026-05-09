from app.modules.warga.domain.entities import Resident, ResidentStatus


class ResidentPolicy:
    @staticmethod
    def can_receive_invoice(resident: Resident) -> bool:
        return resident.status == ResidentStatus.ACTIVE

    @staticmethod
    def can_submit_laporan(resident: Resident) -> bool:
        return resident.status == ResidentStatus.ACTIVE
