"""add alamat_domisili to residents — Tambah Warga feature

Revision ID: m1n2o3p4q5r6
Revises: l1m2n3o4p5q6
Create Date: 2026-06-14

Adds alamat_domisili (Text, nullable) — separate from alamat_ktp.
Used by Resident.create_by_admin() (Tambah Warga manual entry) and
the self-edit/admin-edit profile forms.
"""
import sqlalchemy as sa
from alembic import op

revision = "m1n2o3p4q5r6"
down_revision = "l1m2n3o4p5q6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "residents",
        sa.Column("alamat_domisili", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("residents", "alamat_domisili")
