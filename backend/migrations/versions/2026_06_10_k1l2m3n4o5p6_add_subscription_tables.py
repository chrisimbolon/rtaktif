"""add subscription tables

Revision ID: k1l2m3n4o5p6
Revises:     j1k2l3m4n5o6
Create Date: 2026-06-10

Adds two tables:
  rt_subscriptions       — one active subscription per RT group
  subscription_payments  — payment history + bukti bayar uploads

Business rules encoded:
  - Trial: 7 days from RT registration
  - Monthly: Rp 40.000/bulan
  - Annual:  Rp 400.000/tahun (2 bulan gratis)
  - Grace period: 14 days after expiry before full lock
  - Status flow: trial → active → grace → locked

Note on enum columns:
  Using String(20) instead of PostgreSQL ENUM types.
  Values are validated at the Python/Pydantic layer.
  This avoids CREATE TYPE conflicts across environments.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision      = "k1l2m3n4o5p6"
down_revision = "j1k2l3m4n5o6"
branch_labels = None
depends_on    = None


def upgrade() -> None:

    # ── rt_subscriptions ───────────────────────────────────────────────────
    op.create_table(
        "rt_subscriptions",

        sa.Column("id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),

        sa.Column("rt_group_id",
            UUID(as_uuid=True),
            sa.ForeignKey("rt_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),

        # plan: trial | monthly | annual
        sa.Column("plan",
            sa.String(20),
            nullable=False,
            server_default="trial",
        ),

        # status: trial | active | grace | locked | cancelled
        sa.Column("status",
            sa.String(20),
            nullable=False,
            server_default="trial",
        ),

        # Trial window
        sa.Column("trial_ends_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        # Active billing period
        sa.Column("current_period_start",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("current_period_end",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        # Grace window (current_period_end + 14 days)
        sa.Column("grace_ends_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        # When access was fully locked
        sa.Column("locked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column("created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # One active subscription per RT group
    op.create_unique_constraint(
        "uq_rt_subscriptions_rt_group",
        "rt_subscriptions",
        ["rt_group_id"],
    )

    # Fast lookups for status sweeps
    op.create_index("ix_rt_subscriptions_status",     "rt_subscriptions", ["status"])
    op.create_index("ix_rt_subscriptions_trial_ends", "rt_subscriptions", ["trial_ends_at"])
    op.create_index("ix_rt_subscriptions_period_end", "rt_subscriptions", ["current_period_end"])
    op.create_index("ix_rt_subscriptions_grace_ends", "rt_subscriptions", ["grace_ends_at"])

    # ── subscription_payments ──────────────────────────────────────────────
    op.create_table(
        "subscription_payments",

        sa.Column("id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),

        sa.Column("rt_group_id",
            UUID(as_uuid=True),
            sa.ForeignKey("rt_groups.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),

        sa.Column("subscription_id",
            UUID(as_uuid=True),
            sa.ForeignKey("rt_subscriptions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),

        # plan: monthly | annual
        sa.Column("plan",
            sa.String(20),
            nullable=False,
        ),

        # Amount in Rupiah (40000 or 400000)
        sa.Column("amount_idr",
            sa.Integer(),
            nullable=False,
        ),

        # Period this payment covers
        sa.Column("period_start",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("period_end",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        # Bukti bayar upload URL
        sa.Column("bukti_bayar_url",
            sa.Text(),
            nullable=True,
        ),

        # status: pending | confirmed | rejected
        sa.Column("status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),

        # Superadmin review — no FK, survives user deletion
        sa.Column("confirmed_by",
            UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("confirmed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("rejection_reason",
            sa.Text(),
            nullable=True,
        ),

        # Optional notes from Ketua RT
        sa.Column("notes",
            sa.Text(),
            nullable=True,
        ),

        sa.Column("created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # Fast lookups for superadmin payment queue
    op.create_index(
        "ix_sub_payments_status",
        "subscription_payments",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_sub_payments_rt_group",
        "subscription_payments",
        ["rt_group_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_sub_payments_rt_group",        table_name="subscription_payments")
    op.drop_index("ix_sub_payments_status",          table_name="subscription_payments")
    op.drop_table("subscription_payments")

    op.drop_index("ix_rt_subscriptions_grace_ends",  table_name="rt_subscriptions")
    op.drop_index("ix_rt_subscriptions_period_end",  table_name="rt_subscriptions")
    op.drop_index("ix_rt_subscriptions_trial_ends",  table_name="rt_subscriptions")
    op.drop_index("ix_rt_subscriptions_status",      table_name="rt_subscriptions")
    op.drop_constraint("uq_rt_subscriptions_rt_group", "rt_subscriptions", type_="unique")
    op.drop_table("rt_subscriptions")
