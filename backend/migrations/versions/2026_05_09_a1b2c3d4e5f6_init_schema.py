"""Initial schema — all tables

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-05-09

Changes from original scaffold:
  - All timestamps: TIMESTAMPTZ (timezone-aware) instead of naive DateTime
  - All long-form text fields: TEXT instead of VARCHAR(2000)
  - Foreign key constraints on all UUID relationships
  - Unique constraints: uq_users_phone, uq_residents_rt_user,
                        uq_invoices_resident_period, uq_rt_groups_location
  - Composite indexes for common query patterns
  - payments table (separate from invoices — full audit trail)
  - notification_logs table (immutable WA blast audit trail)
  - paid_at on invoices (denormalised for fast queries)
  - verified_at / verified_by on residents
  - resolved_at on laporan_warga
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision:       str                            = "a1b2c3d4e5f6"
down_revision:  Union[str, None]               = None
branch_labels:  Union[str, Sequence[str], None] = None
depends_on:     Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ── rt_groups ─────────────────────────────────────────────────
    # Created before users so users.rt_group_id FK can reference it
    op.create_table(
        "rt_groups",
        sa.Column("id",              UUID(as_uuid=True), primary_key=True),
        sa.Column("rt_number",       sa.String(10),  nullable=False),
        sa.Column("rw_number",       sa.String(10),  nullable=False),
        sa.Column("kelurahan",       sa.String(100), nullable=False),
        sa.Column("kecamatan",       sa.String(100), nullable=False),
        sa.Column("kota",            sa.String(100), nullable=False),
        sa.Column("provinsi",        sa.String(100), server_default="Bengkulu", nullable=False),
        # admin_user_id: no FK here — avoids circular dependency with users
        sa.Column("admin_user_id",   UUID(as_uuid=True), nullable=False),
        sa.Column("monthly_fee_idr", sa.Integer, server_default="30000", nullable=False),
        sa.Column("is_active",       sa.Boolean, server_default="true",  nullable=False),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        # Business rule: RT 05/RW 02 in Kelurahan X, Kota Y must be unique
        sa.UniqueConstraint("rt_number", "rw_number", "kelurahan", "kota",
                            name="uq_rt_groups_location"),
    )

    # ── users ──────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",               UUID(as_uuid=True), primary_key=True),
        sa.Column("email",            sa.String(255), nullable=False),
        sa.Column("phone",            sa.String(20),  nullable=False),
        sa.Column("hashed_password",  sa.String(255), nullable=False),
        sa.Column("full_name",        sa.String(255), nullable=False),
        sa.Column("role",             sa.String(50),  server_default="warga",   nullable=False),
        sa.Column("status",           sa.String(50),  server_default="pending", nullable=False),
        sa.Column("rt_group_id",      UUID(as_uuid=True),
                  sa.ForeignKey("rt_groups.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        # One email per account
        sa.UniqueConstraint("email", name="uq_users_email"),
        # One phone per account (prevents duplicate registrations)
        sa.UniqueConstraint("phone", name="uq_users_phone"),
    )
    op.create_index("ix_users_email",      "users", ["email"],      unique=True)
    op.create_index("ix_users_rt_group_id","users", ["rt_group_id"])
    op.create_index("ix_users_role_status","users", ["role", "status"])

    # ── residents ──────────────────────────────────────────────────
    op.create_table(
        "residents",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True),
        sa.Column("rt_group_id",    UUID(as_uuid=True),
                  sa.ForeignKey("rt_groups.id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("user_id",        UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("full_name",      sa.String(255), nullable=False),
        sa.Column("phone",          sa.String(20),  server_default="", nullable=False),
        sa.Column("nik",            sa.String(16),  nullable=True),
        sa.Column("street",         sa.String(255), server_default="", nullable=False),
        sa.Column("rt_number",      sa.String(10),  server_default="", nullable=False),
        sa.Column("rw_number",      sa.String(10),  server_default="", nullable=False),
        sa.Column("kelurahan",      sa.String(100), server_default="", nullable=False),
        sa.Column("kecamatan",      sa.String(100), server_default="", nullable=False),
        sa.Column("kota",           sa.String(100), server_default="", nullable=False),
        sa.Column("block",          sa.String(20),  server_default="", nullable=False),
        sa.Column("unit_number",    sa.String(20),  server_default="", nullable=False),
        sa.Column("ownership_type", sa.String(20),  server_default="owner",   nullable=False),
        sa.Column("status",         sa.String(20),  server_default="pending", nullable=False),
        sa.Column("member_count",   sa.Integer,     server_default="1",       nullable=False),
        sa.Column("kk_file_url",    sa.String(500), nullable=True),
        sa.Column("ktp_file_url",   sa.String(500), nullable=True),
        sa.Column("verified_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by",    UUID(as_uuid=True),         nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        # A user can only register once per RT group
        sa.UniqueConstraint("rt_group_id", "user_id", name="uq_residents_rt_user"),
    )
    op.create_index("ix_residents_rt_group_id", "residents", ["rt_group_id"])
    op.create_index("ix_residents_user_id",     "residents", ["user_id"])
    op.create_index("ix_residents_status",      "residents", ["status"])
    # Composite: active residents per RT (used by invoice generation + warga list)
    op.create_index("ix_residents_rt_status",   "residents", ["rt_group_id", "status"])

    # ── invoices ───────────────────────────────────────────────────
    op.create_table(
        "invoices",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True),
        sa.Column("resident_id",  UUID(as_uuid=True),
                  sa.ForeignKey("residents.id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("rt_group_id",  UUID(as_uuid=True),
                  sa.ForeignKey("rt_groups.id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("period_year",  sa.Integer, nullable=False),
        sa.Column("period_month", sa.Integer, nullable=False),
        sa.Column("amount_idr",   sa.Integer, nullable=False),
        sa.Column("status",       sa.String(20), server_default="issued", nullable=False),
        # Denormalised for fast "show me all paid invoices in May" query
        sa.Column("paid_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes",    sa.Text, server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        # Core business invariant: one invoice per resident per month
        sa.UniqueConstraint("resident_id", "period_year", "period_month",
                            name="uq_invoices_resident_period"),
    )
    op.create_index("ix_invoices_resident_id", "invoices", ["resident_id"])
    op.create_index("ix_invoices_status",      "invoices", ["status"])
    # Composite: all invoices for RT 05, May 2026 (most common admin query)
    op.create_index("ix_invoices_rt_period",   "invoices", ["rt_group_id", "period_year", "period_month"])
    # Composite: unpaid invoices per RT (overdue checker + reminder blast)
    op.create_index("ix_invoices_rt_status",   "invoices", ["rt_group_id", "status"])

    # ── payments ───────────────────────────────────────────────────
    op.create_table(
        "payments",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id",   UUID(as_uuid=True),
                  sa.ForeignKey("invoices.id",  ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("resident_id",  UUID(as_uuid=True),
                  sa.ForeignKey("residents.id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("amount_idr",   sa.Integer,    nullable=False),
        sa.Column("method",       sa.String(50), server_default="bank_transfer", nullable=False),
        sa.Column("bukti_url",    sa.String(500), nullable=True),
        sa.Column("confirmed_by", UUID(as_uuid=True), nullable=False),
        # The actual moment payment happened — not when the record was created
        sa.Column("paid_at",      sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes",        sa.Text, server_default="", nullable=False),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payments_invoice_id",  "payments", ["invoice_id"])
    op.create_index("ix_payments_resident_id", "payments", ["resident_id"])
    op.create_index("ix_payments_paid_at",     "payments", ["paid_at"])

    # ── announcements ──────────────────────────────────────────────
    op.create_table(
        "announcements",
        sa.Column("id",              UUID(as_uuid=True), primary_key=True),
        sa.Column("rt_group_id",     UUID(as_uuid=True),
                  sa.ForeignKey("rt_groups.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("created_by",      UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("title",           sa.String(255), nullable=False),
        sa.Column("body",            sa.Text,        nullable=False),     # TEXT — no limit
        sa.Column("ann_type",        sa.String(20),  server_default="info",  nullable=False),
        sa.Column("channel",         sa.String(20),  server_default="both",  nullable=False),
        sa.Column("recipient_count", sa.Integer,     server_default="0",     nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Composite: latest announcements per RT (most common query)
    op.create_index("ix_announcements_rt_created", "announcements", ["rt_group_id", "created_at"])

    # ── laporan_warga ──────────────────────────────────────────────
    op.create_table(
        "laporan_warga",
        sa.Column("id",               UUID(as_uuid=True), primary_key=True),
        sa.Column("rt_group_id",      UUID(as_uuid=True),
                  sa.ForeignKey("rt_groups.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("resident_id",      UUID(as_uuid=True),
                  sa.ForeignKey("residents.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("title",            sa.String(255), nullable=False),
        sa.Column("description",      sa.Text, server_default="", nullable=False),  # TEXT
        sa.Column("photo_url",        sa.String(500), nullable=True),
        sa.Column("status",           sa.String(20),  server_default="open", nullable=False),
        sa.Column("resolved_by",      UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at",      sa.DateTime(timezone=True), nullable=True),   # when resolved
        sa.Column("resolution_notes", sa.Text, server_default="", nullable=False),  # TEXT
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_laporan_resident",  "laporan_warga", ["resident_id"])
    op.create_index("ix_laporan_status",    "laporan_warga", ["status"])
    # Composite: open laporan per RT (admin dashboard query)
    op.create_index("ix_laporan_rt_status", "laporan_warga", ["rt_group_id", "status"])

    # ── notification_logs ──────────────────────────────────────────
    op.create_table(
        "notification_logs",
        sa.Column("id",              UUID(as_uuid=True), primary_key=True),
        sa.Column("rt_group_id",     UUID(as_uuid=True),
                  sa.ForeignKey("rt_groups.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("sent_by",         UUID(as_uuid=True), nullable=False),
        sa.Column("trigger_type",    sa.String(50), nullable=False),
        sa.Column("trigger_id",      UUID(as_uuid=True), nullable=True),
        sa.Column("notif_type",      sa.String(20), nullable=False),
        sa.Column("recipient_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("message_preview", sa.String(200), server_default="", nullable=False),
        sa.Column("status",          sa.String(20), server_default="sent", nullable=False),
        sa.Column("failed_count",    sa.Integer, server_default="0", nullable=False),
        sa.Column("error_detail",    sa.Text, nullable=True),
        sa.Column("sent_at",         sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Composite: recent blasts per RT
    op.create_index("ix_notif_rt_sent_at",  "notification_logs", ["rt_group_id", "sent_at"])
    op.create_index("ix_notif_type_status", "notification_logs", ["notif_type", "status"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("notification_logs")
    op.drop_table("laporan_warga")
    op.drop_table("announcements")
    op.drop_table("payments")
    op.drop_table("invoices")
    op.drop_table("residents")
    op.drop_table("users")
    op.drop_table("rt_groups")
