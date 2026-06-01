"""RT group verification — onboarding trust layer

Adds the full Ketua RT verification system to rt_groups:
  - rt_verification_status  ENUM  (pending_verification | active | rejected | expired)
  - sk_document_url          TEXT  — uploaded Surat Keputusan scan
  - sk_valid_until           DATE  — term expiry from the SK document
  - verified_at              TIMESTAMPTZ
  - verified_by              UUID  FK → users.id  (the RTMudah superadmin who approved)
  - rejection_reason         TEXT  — filled when status = rejected

Also tightens the existing location uniqueness constraint to include
kecamatan (previously only rt_number + rw_number + kelurahan + kota),
which was technically ambiguous for cities with duplicate kelurahan
names across kecamatan (e.g. Jakarta has two "Kebon Sirih" in different
kecamatan).  The old constraint uq_rt_groups_location is dropped and
replaced with uq_rt_groups_identity which is the true canonical key.

Revision ID  : b7f3a9c2d1e4
Revises      : a1b2c3d4e5f6
Create Date  : 2026-05-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# ─── revision chain ───────────────────────────────────────────────────────────
revision: str = "b7f3a9c2d1e4"
down_revision: str = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

# ─── enum name (must match models.py exactly) ─────────────────────────────────
_ENUM_NAME = "rt_verification_status"
_ENUM_VALUES = ("pending_verification", "active", "rejected", "expired")


def upgrade() -> None:
    # 1. Create the ENUM type in PostgreSQL
    #    checkfirst=True so re-running upgrade() in tests never explodes.
    rt_verification_status = postgresql.ENUM(
        *_ENUM_VALUES,
        name=_ENUM_NAME,
        create_type=False,  # we create it manually below for idempotency
    )
    rt_verification_status.create(op.get_bind(), checkfirst=True)

    # 2. Add new columns to rt_groups
    with op.batch_alter_table("rt_groups", schema=None) as batch_op:

        # ── Verification state machine ─────────────────────────────────────
        batch_op.add_column(
            sa.Column(
                "verification_status",
                sa.Enum(*_ENUM_VALUES, name=_ENUM_NAME),
                # Every existing RT group created during dev/seed gets
                # active status so nothing breaks when you run this on
                # a seeded dev DB.  Production has no rows yet → moot.
                server_default="active",
                nullable=False,
            )
        )

        # ── Surat Keputusan document ───────────────────────────────────────
        batch_op.add_column(
            sa.Column(
                "sk_document_url",
                sa.Text,
                nullable=True,
                comment="GCS / DO Spaces URL of the uploaded SK scan",
            )
        )
        batch_op.add_column(
            sa.Column(
                "sk_valid_until",
                sa.Date,
                nullable=True,
                comment="Term expiry date as written on the SK document",
            )
        )

        # ── Audit trail ───────────────────────────────────────────────────
        batch_op.add_column(
            sa.Column(
                "verified_at",
                sa.DateTime(timezone=True),
                nullable=True,
                comment="UTC timestamp of the approve/reject action",
            )
        )
        batch_op.add_column(
            sa.Column(
                "verified_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_rt_groups_verified_by"),
                nullable=True,
                comment="Superadmin user who took the verification action",
            )
        )
        batch_op.add_column(
            sa.Column(
                "rejection_reason",
                sa.Text,
                nullable=True,
                comment="Human-readable reason; required when status = rejected",
            )
        )

        # 3. Drop the old looser uniqueness constraint (missing kecamatan)
        #    and replace it with the proper 5-tuple canonical identity.
        #
        #    NOTE: if the old constraint doesn't exist on your DB (fresh
        #    install), op.drop_constraint raises.  The try/except makes this
        #    migration re-runnable and safe against both states.
        try:
            batch_op.drop_constraint("uq_rt_groups_location", type_="unique")
        except Exception:
            pass  # already absent — no-op

        batch_op.create_unique_constraint(
            "uq_rt_groups_identity",
            ["rt_number", "rw_number", "kelurahan", "kecamatan", "kota"],
        )

        # 4. Index on verification_status so the superadmin queue query
        #    (WHERE verification_status = 'pending_verification') is instant.
        batch_op.create_index(
            "ix_rt_groups_verification_status",
            ["verification_status"],
        )

        # 5. Composite index for SK expiry sweep (scheduled job will
        #    query WHERE sk_valid_until <= :cutoff AND verification_status = 'active')
        batch_op.create_index(
            "ix_rt_groups_sk_expiry",
            ["sk_valid_until", "verification_status"],
        )


def downgrade() -> None:
    with op.batch_alter_table("rt_groups", schema=None) as batch_op:
        batch_op.drop_index("ix_rt_groups_sk_expiry")
        batch_op.drop_index("ix_rt_groups_verification_status")

        # Restore the old (looser) uniqueness constraint
        batch_op.drop_constraint("uq_rt_groups_identity", type_="unique")
        batch_op.create_unique_constraint(
            "uq_rt_groups_location",
            ["rt_number", "rw_number", "kelurahan", "kota"],
        )

        batch_op.drop_constraint("fk_rt_groups_verified_by", type_="foreignkey")
        batch_op.drop_column("rejection_reason")
        batch_op.drop_column("verified_by")
        batch_op.drop_column("verified_at")
        batch_op.drop_column("sk_valid_until")
        batch_op.drop_column("sk_document_url")
        batch_op.drop_column("verification_status")

    # Drop the enum type last (after the column referencing it is gone)
    postgresql.ENUM(*_ENUM_VALUES, name=_ENUM_NAME).drop(op.get_bind(), checkfirst=True)
