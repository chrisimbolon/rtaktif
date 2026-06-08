"""add changed_by_name to resident_change_logs

Revision ID: j1k2l3m4n5o6
Revises:     i1j2k3l4m5n6
Create Date: 2026-06-08

The column changed_by_name was in the migration i1j2k3l4m5n6
but the table was created without it due to timing.
This migration adds the missing column.
"""

import sqlalchemy as sa
from alembic import op

revision      = "j1k2l3m4n5o6"
down_revision = "i1j2k3l4m5n6"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column("resident_change_logs",
        sa.Column("changed_by_name", sa.String(255), nullable=False,
                  server_default="")
    )


def downgrade() -> None:
    op.drop_column("resident_change_logs", "changed_by_name")