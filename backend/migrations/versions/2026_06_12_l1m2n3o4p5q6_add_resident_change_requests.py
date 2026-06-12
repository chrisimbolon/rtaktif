"""add resident change requests table — warga self-edit approval flow

Revision ID: l1m2n3o4p5q6
Revises:     k1l2m3n4o5p6
Create Date: 2026-06-12

Adds resident_change_requests:
  - Warga proposes field changes via PATCH self-edit
  - Each changed field = one row, status pending
  - Ketua RT approves/rejects per request
  - On approve: applied to ResidentModel + logged to resident_change_logs
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision      = "l1m2n3o4p5q6"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        "resident_change_requests",

        sa.Column("id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),

        sa.Column("resident_id",
            UUID(as_uuid=True),
            sa.ForeignKey("residents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rt_group_id",
            UUID(as_uuid=True),
            nullable=False,
        ),

        # Who proposed the change (warga's user_id)
        sa.Column("requested_by",
            UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("requested_by_name",
            sa.String(255),
            nullable=False,
            server_default="",
        ),

        # Field-level change
        sa.Column("field_name",  sa.String(50),  nullable=False),
        sa.Column("field_label", sa.String(100), nullable=False, server_default=""),
        sa.Column("old_value",   sa.Text(), nullable=True),
        sa.Column("new_value",   sa.Text(), nullable=True),

        # status: pending | approved | rejected
        sa.Column("status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),

        # Review
        sa.Column("reviewed_by",     UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_by_name", sa.String(255), nullable=True),
        sa.Column("reviewed_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),

        sa.Column("created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # Fast lookups: Ketua RT queue (rt_group_id + status)
    op.create_index(
        "ix_change_requests_rt_status",
        "resident_change_requests",
        ["rt_group_id", "status"],
    )
    # Fast lookups: warga's own request history
    op.create_index(
        "ix_change_requests_resident",
        "resident_change_requests",
        ["resident_id", "created_at"],
    )
    # Fast lookups: by requester (warga's own user_id)
    op.create_index(
        "ix_change_requests_requested_by",
        "resident_change_requests",
        ["requested_by", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_change_requests_requested_by", table_name="resident_change_requests")
    op.drop_index("ix_change_requests_resident",      table_name="resident_change_requests")
    op.drop_index("ix_change_requests_rt_status",     table_name="resident_change_requests")
    op.drop_table("resident_change_requests")
