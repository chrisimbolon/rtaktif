"""add pendidikan kewarganegaraan hubungan_dengan_kk to residents

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
Create Date: 2026-06-04

Critical fields for Kelurahan reporting:
  - pendidikan_terakhir  : education level (SD/SMP/SMA/S1/etc)
  - kewarganegaraan      : WNI/WNA (for official letters)
  - hubungan_dengan_kk   : detailed family relationship
"""
from alembic import op
import sqlalchemy as sa

revision      = 'e1f2a3b4c5d6'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column('residents',
        sa.Column('pendidikan_terakhir', sa.String(30), nullable=True))
    op.add_column('residents',
        sa.Column('kewarganegaraan', sa.String(10),
                  nullable=True, server_default='WNI'))
    op.add_column('residents',
        sa.Column('hubungan_dengan_kk', sa.String(30), nullable=True))

    op.create_index(
        'ix_residents_pendidikan', 'residents', ['pendidikan_terakhir']
    )


def downgrade() -> None:
    op.drop_index('ix_residents_pendidikan', table_name='residents')
    op.drop_column('residents', 'pendidikan_terakhir')
    op.drop_column('residents', 'kewarganegaraan')
    op.drop_column('residents', 'hubungan_dengan_kk')
