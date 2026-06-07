"""add ktp ocr fields to rt_groups

Revision ID: h1i2j3k4l5m6
Revises:     g1h2i3j4k5l6
Create Date: 2026-06-07

Adds KTP OCR pipeline columns to rt_groups:
  ktp_document_url     TEXT          — DO Spaces URL for KTP image
  ktp_ocr_data         JSONB         — structured KTPData as JSON
  ktp_ocr_flags        TEXT[]        — array of KTPVerificationFlag values
  ktp_ocr_confidence   FLOAT         — 0.0–1.0 score from OCR parser
  ktp_verified         BOOLEAN       — superadmin confirmed KTP fields
  ktp_verified_at      TIMESTAMPTZ
  ktp_verified_by      UUID → users.id (nullable FK, SET NULL on delete)
  sk_notes             TEXT          — superadmin free-text review notes

NOTE: sk_document_url, verified_at, verified_by, rejection_reason
already exist from migration b7f3a9c2d1e4 — no changes to those.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision      = "h1i2j3k4l5m6"
down_revision = "g1h2i3j4k5l6"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # KTP image storage URL
    op.add_column("rt_groups", sa.Column(
        "ktp_document_url", sa.Text(), nullable=True
    ))

    # OCR structured output — JSONB for flexibility, easy to query
    op.add_column("rt_groups", sa.Column(
        "ktp_ocr_data",
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    ))

    # Flag array — easier to filter than parsing JSON
    op.add_column("rt_groups", sa.Column(
        "ktp_ocr_flags",
        postgresql.ARRAY(sa.Text()),
        nullable=True,
        server_default="{}",
    ))

    # Confidence score
    op.add_column("rt_groups", sa.Column(
        "ktp_ocr_confidence", sa.Float(), nullable=True
    ))

    # Superadmin KTP sign-off
    op.add_column("rt_groups", sa.Column(
        "ktp_verified",
        sa.Boolean(),
        nullable=False,
        server_default=sa.false(),
    ))
    op.add_column("rt_groups", sa.Column(
        "ktp_verified_at", sa.DateTime(timezone=True), nullable=True
    ))
    op.add_column("rt_groups", sa.Column(
        "ktp_verified_by",
        postgresql.UUID(as_uuid=True),
        nullable=True,
    ))
    op.create_foreign_key(
        "fk_rt_groups_ktp_verified_by",
        "rt_groups", "users",
        ["ktp_verified_by"], ["id"],
        ondelete="SET NULL",
    )

    # Reviewer notes on SK document
    op.add_column("rt_groups", sa.Column(
        "sk_notes", sa.Text(), nullable=True
    ))


def downgrade() -> None:
    op.drop_constraint("fk_rt_groups_ktp_verified_by", "rt_groups", type_="foreignkey")
    op.drop_column("rt_groups", "sk_notes")
    op.drop_column("rt_groups", "ktp_verified_by")
    op.drop_column("rt_groups", "ktp_verified_at")
    op.drop_column("rt_groups", "ktp_verified")
    op.drop_column("rt_groups", "ktp_ocr_confidence")
    op.drop_column("rt_groups", "ktp_ocr_flags")
    op.drop_column("rt_groups", "ktp_ocr_data")
    op.drop_column("rt_groups", "ktp_document_url")
