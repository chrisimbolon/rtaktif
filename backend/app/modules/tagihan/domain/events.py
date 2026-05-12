from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from app.core.events import DomainEvent


@dataclass
class InvoiceGenerated(DomainEvent):
    invoice_id:   UUID     = None
    resident_id:  UUID     = None
    rt_group_id:  UUID     = None
    amount_idr:   int      = 0
    period_year:  int      = 0
    period_month: int      = 0
    occurred_at:  datetime = field(default_factory=datetime.utcnow)


@dataclass
class PaymentConfirmed(DomainEvent):
    invoice_id:  UUID              = None
    resident_id: UUID              = None
    amount_idr:  int               = 0
    method:      str               = ""
    paid_at:     datetime          = field(default_factory=datetime.utcnow)
    occurred_at: datetime          = field(default_factory=datetime.utcnow)


@dataclass
class InvoiceMarkedOverdue(DomainEvent):
    invoice_id:  UUID     = None
    resident_id: UUID     = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)
