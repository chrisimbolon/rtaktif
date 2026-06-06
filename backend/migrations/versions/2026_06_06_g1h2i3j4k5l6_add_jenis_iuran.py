"""add jenis_iuran and label_iuran to invoices

Revision ID: g1h2i3j4k5l6
Revises: f1a2b3c4d5e6
Create Date: 2026-06-06

Adds two columns to invoices table:
  - jenis_iuran: category (KEBERSIHAN/KEAMANAN/KAS RT/etc)
  - label_iuran: custom label when jenis = LAINNYA
  
All existing invoices default to 'IURAN KAS RT'.
"""
from alembic import op
import sqlalchemy as sa

revision      = 'g1h2i3j4k5l6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column('invoices',
        sa.Column(
            'jenis_iuran',
            sa.String(50),
            nullable=False,
            server_default='IURAN KAS RT',
        )
    )
    op.add_column('invoices',
        sa.Column(
            'label_iuran',
            sa.String(100),
            nullable=True,
        )
    )
    op.create_index(
        'ix_invoices_jenis_iuran', 'invoices', ['jenis_iuran']
    )


def downgrade() -> None:
    op.drop_index('ix_invoices_jenis_iuran', table_name='invoices')
    op.drop_column('invoices', 'label_iuran')
    op.drop_column('invoices', 'jenis_iuran')
