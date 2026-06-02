"""add pending_bukti_url to invoices

Revision ID: c1d2e3f4a5b6
Revises: b7f3a9c2d1e4
Create Date: 2026-06-02

Adds pending_bukti_url column to invoices table.
This stores the warga-uploaded bukti bayar URL before
the treasurer confirms payment. On confirmation, the URL
is copied to payments.bukti_url and the column is cleared.
"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = 'b7f3a9c2d1e4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'invoices',
        sa.Column('pending_bukti_url', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('invoices', 'pending_bukti_url')
