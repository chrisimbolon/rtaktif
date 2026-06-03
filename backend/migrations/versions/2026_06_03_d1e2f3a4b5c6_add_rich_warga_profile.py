"""add rich warga profile fields to residents

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-06-03

Adds Indonesian RT-specific fields inspired by real-world RT management:
  - no_kk           : Nomor Kartu Keluarga (household ID)
  - tanggal_lahir   : Date of birth
  - tempat_lahir    : Place of birth
  - jenis_kelamin   : Gender (LAKI-LAKI / PEREMPUAN)
  - agama           : Religion (6 official Indonesian religions)
  - pekerjaan       : Occupation
  - status_kawin    : Marital status
  - status_tinggal  : Residency type (TETAP/KONTRAK/KOST/PINDAH/MENINGGAL)
  - status_keluarga : Family role (SUAMI/ISTRI/ANAK/etc)
  - kepala_keluarga : Boolean — is this person the KK head?
  - alamat_ktp      : KTP address (may differ from actual address)
"""
from alembic import op
import sqlalchemy as sa

revision    = 'd1e2f3a4b5c6'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column('residents', sa.Column('no_kk',           sa.String(16),  nullable=True))
    op.add_column('residents', sa.Column('tanggal_lahir',   sa.Date(),      nullable=True))
    op.add_column('residents', sa.Column('tempat_lahir',    sa.String(100), nullable=True))
    op.add_column('residents', sa.Column('jenis_kelamin',   sa.String(20),  nullable=True))
    op.add_column('residents', sa.Column('agama',           sa.String(20),  nullable=True))
    op.add_column('residents', sa.Column('pekerjaan',       sa.String(50),  nullable=True))
    op.add_column('residents', sa.Column('status_kawin',    sa.String(20),  nullable=True))
    op.add_column('residents', sa.Column('status_tinggal',  sa.String(20),  nullable=True, server_default='TETAP'))
    op.add_column('residents', sa.Column('status_keluarga', sa.String(20),  nullable=True))
    op.add_column('residents', sa.Column('kepala_keluarga', sa.Boolean(),   nullable=True, server_default='false'))
    op.add_column('residents', sa.Column('alamat_ktp',      sa.Text(),      nullable=True))

    # Index for common queries: find all warga by status_tinggal, gender, etc.
    op.create_index('ix_residents_status_tinggal', 'residents', ['status_tinggal'])
    op.create_index('ix_residents_no_kk',          'residents', ['no_kk'])


def downgrade() -> None:
    op.drop_index('ix_residents_status_tinggal', table_name='residents')
    op.drop_index('ix_residents_no_kk',          table_name='residents')

    for col in [
        'no_kk', 'tanggal_lahir', 'tempat_lahir', 'jenis_kelamin',
        'agama', 'pekerjaan', 'status_kawin', 'status_tinggal',
        'status_keluarga', 'kepala_keluarga', 'alamat_ktp',
    ]:
        op.drop_column('residents', col)
