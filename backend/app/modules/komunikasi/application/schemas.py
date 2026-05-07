from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from app.modules.komunikasi.domain.entities import AnnouncementType, DeliveryChannel


class PublishAnnouncementRequest(BaseModel):
    rt_group_id: UUID
    title: str
    body: str
    ann_type: AnnouncementType = AnnouncementType.INFO
    channel: DeliveryChannel = DeliveryChannel.BOTH


class SubmitLaporanRequest(BaseModel):
    rt_group_id: UUID
    title: str
    description: str
    photo_url: Optional[str] = None


class ResolveLaporanRequest(BaseModel):
    notes: str = ""


class SendWABlastRequest(BaseModel):
    rt_group_id: UUID
    phone_numbers: list[str]
    message: str
