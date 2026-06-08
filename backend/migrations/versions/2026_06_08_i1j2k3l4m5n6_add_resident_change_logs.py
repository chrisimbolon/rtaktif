"""add resident change logs

Revision ID: i1j2k3l4m5n6
Revises:     h1i2j3k4l5m6
Create Date: 2026-06-08

Adds resident_change_logs table for full audit trail of
all profile edits made by Ketua RT or warga.

Design decisions:
  - Immutable append-only table — no updates, no deletes
  - field_name + old_value + new_value as TEXT — flexible,
    works for any field without schema changes
  - changed_by_role stored denormalised — fast query, survives
    role changes on the user record
  - rt_group_id denormalised — fast superadmin audit queries
    without joining through residents
  - No FK from resident_change_logs → users for changed_by
    because a superadmin could delete a user but we still
    want the log entry to survive
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision      = "i1j2k3l4m5n6"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        "resident_change_logs",

        sa.Column("id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),

        # Which resident was changed
        sa.Column("resident_id",
            UUID(as_uuid=True),
            sa.ForeignKey("residents.id", ondelete="CASCADE"),
            nullable=False,
        ),

        # Denormalised RT context — survives resident RT transfers
        sa.Column("rt_group_id",
            UUID(as_uuid=True),
            nullable=False,
        ),

        # Who made the change — no FK so log survives user deletion
        sa.Column("changed_by",
            UUID(as_uuid=True),
            nullable=False,
        ),

        # Denormalised role at time of change
        sa.Column("changed_by_role",
            sa.String(30),
            nullable=False,   # "ketua_rt" | "warga" | "superadmin"
        ),

        # Resident's name at time of change — survives name updates
        sa.Column("resident_name",
            sa.String(255),
            nullable=False,
            server_default="",
        ),

        # What changed
        sa.Column("field_name",
            sa.String(50),
            nullable=False,
        ),
        sa.Column("old_value",
            sa.Text(),
            nullable=True,   # null = field was empty before
        ),
        sa.Column("new_value",
            sa.Text(),
            nullable=True,   # null = field was cleared
        ),

        # Human-readable label for UI display (e.g. "Nomor HP")
        sa.Column("field_label",
            sa.String(100),
            nullable=False,
            server_default="",
        ),

        sa.Column("changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # Fast lookups:
    # 1. All changes to a specific resident (modal change log tab)
    op.create_index(
        "ix_change_logs_resident_id",
        "resident_change_logs",
        ["resident_id", "changed_at"],
    )
    # 2. All changes in an RT group (superadmin audit)
    op.create_index(
        "ix_change_logs_rt_group",
        "resident_change_logs",
        ["rt_group_id", "changed_at"],
    )
    # 3. All changes by a specific user (accountability query)
    op.create_index(
        "ix_change_logs_changed_by",
        "resident_change_logs",
        ["changed_by"],
    )


def downgrade() -> None:
    op.drop_index("ix_change_logs_changed_by",  table_name="resident_change_logs")
    op.drop_index("ix_change_logs_rt_group",     table_name="resident_change_logs")
    op.drop_index("ix_change_logs_resident_id",  table_name="resident_change_logs")
    op.drop_table("resident_change_logs")
