"""allow anggota kk without user account

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-06-05

Changes to support anggota KK (family members without login accounts):
  1. user_id becomes nullable — anggota KK don't need accounts
  2. Drop uq_residents_rt_user — only one registered warga per RT,
     but multiple anggota KK can have NULL user_id
  3. Add partial unique index — only enforce uniqueness when user_id IS NOT NULL
  4. Add is_anggota_kk flag — distinguishes registered warga from added family members
  5. Add added_by_user_id — tracks who added this anggota (the Kepala KK)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision      = 'f1a2b3c4d5e6'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # 1. Make user_id nullable
    op.alter_column(
        'residents', 'user_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    # 2. Drop the old unique constraint (blocks multiple NULL user_ids)
    op.drop_constraint('uq_residents_rt_user', 'residents', type_='unique')

    # 3. Add partial unique index — only enforce when user_id IS NOT NULL
    op.execute("""
        CREATE UNIQUE INDEX uq_residents_rt_user_partial
        ON residents (rt_group_id, user_id)
        WHERE user_id IS NOT NULL
    """)

    # 4. Add is_anggota_kk flag
    op.add_column('residents',
        sa.Column('is_anggota_kk', sa.Boolean(),
                  nullable=False, server_default='false'))

    # 5. Add added_by_user_id — who added this anggota
    op.add_column('residents',
        sa.Column('added_by_user_id', postgresql.UUID(as_uuid=True),
                  nullable=True))

    # Index for fast KK member lookup
    op.create_index('ix_residents_added_by', 'residents', ['added_by_user_id'])


def downgrade() -> None:
    op.drop_index('ix_residents_added_by', table_name='residents')
    op.drop_column('residents', 'added_by_user_id')
    op.drop_column('residents', 'is_anggota_kk')

    op.execute("DROP INDEX IF EXISTS uq_residents_rt_user_partial")

    op.create_unique_constraint(
        'uq_residents_rt_user', 'residents', ['rt_group_id', 'user_id']
    )

    op.alter_column(
        'residents', 'user_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )
