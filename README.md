# rtmudah.com — Backend API

**RT/RW Neighbourhood Management System**
FastAPI · PostgreSQL · Redis · DDD · Modular Monolith

---

## Architecture

DDD Modular Monolith — mirrors the hr-app convention:

```
app/
├── core/           # Shared: config, database, security, dependencies, events
├── shared/         # Constants, enums, schemas, utils (Indonesian-specific)
└── modules/        # Business domains — each fully self-contained
    ├── iam/        # Identity & Access: User, RTGroup, JWT auth
    │   ├── domain/              # Entities, events, repositories (interfaces), policies
    │   ├── application/         # use_cases/ — one file per use case
    │   ├── infrastructure/      # models.py + repository.py (PG implementation)
    │   └── presentation/api/v1/ # routes.py — FastAPI router
    ├── warga/      # Resident management: register, verify, move-out
    ├── tagihan/    # Billing: invoice lifecycle, payment confirmation, overdue
    └── komunikasi/ # Announcements, WA blast, laporan warga
```

### DDD Layer Rules
| Layer | Can import | Cannot import |
|---|---|---|
| `domain/` | `core/` only | infra, application, other modules |
| `application/use_cases/` | `domain/`, `core/` | infra, HTTP, SQLAlchemy |
| `infrastructure/` | `domain/`, `core/database` | application layer |
| `presentation/` | `application/`, `core/dependencies` | domain directly |

---

## Quick Start

```bash
# 1. Clone and setup
cp .env.example .env          # fill in SECRET_KEY, JWT_SECRET_KEY

# 2. Start everything
./scripts/start_dev.sh        # starts DB + Redis, runs migrations, starts API

# 3. Seed dev data
python scripts/seed_dev.py

# 4. Open API docs
open http://localhost:8000/api/v1/docs
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | — | Register user |
| POST | `/api/v1/auth/login` | — | Login → JWT |
| GET  | `/api/v1/users/me` | 🔐 | Current user profile |
| PATCH | `/api/v1/users/{id}/verify` | 👑 Admin | Verify user |
| PATCH | `/api/v1/users/{id}/role` | 👑 Admin | Assign role |
| POST | `/api/v1/rt-groups` | 👑 Admin | Create RT group |
| GET  | `/api/v1/rt-groups/{id}/members` | 👑 Admin | List RT members |
| POST | `/api/v1/warga` | 🔐 | Register as resident |
| GET  | `/api/v1/warga/rt/{rt_id}` | 👑 Admin | List warga |
| GET  | `/api/v1/warga/{id}` | 👑 Admin | Resident detail |
| PATCH | `/api/v1/warga/{id}/verify` | 👑 Admin | Verify resident |
| POST | `/api/v1/tagihan/generate-bulk` | 👑 Admin | Generate monthly invoices |
| GET  | `/api/v1/tagihan/rt/{rt_id}` | 👑 Admin | Invoices by period |
| GET  | `/api/v1/tagihan/unpaid/{rt_id}` | 👑 Admin | Unpaid invoices |
| PATCH | `/api/v1/tagihan/{id}/confirm-payment` | 👑 Admin | Confirm payment |
| POST | `/api/v1/tagihan/mark-overdue/{rt_id}` | 👑 Admin | Mark overdue |
| POST | `/api/v1/komunikasi/announcements` | 👑 Admin | Publish announcement |
| GET  | `/api/v1/komunikasi/announcements/{rt_id}` | 🔐 | List announcements |
| POST | `/api/v1/komunikasi/laporan` | 🔐 | Submit laporan |
| GET  | `/api/v1/komunikasi/laporan/{rt_id}` | 👑 Admin | List laporan |
| PATCH | `/api/v1/komunikasi/laporan/{id}/resolve` | 👑 Admin | Resolve laporan |
| POST | `/api/v1/komunikasi/wa/blast` | 👑 Admin | WA blast via Fonnte |

---

## Development

```bash
# Run unit tests
pytest tests/unit -v --cov=app

# Lint
ruff check app tests

# Create new migration
./scripts/make_migration.sh "add_nik_index"

# Run migrations
./scripts/migrate.sh
```

## Stack
| Layer | Tech |
|---|---|
| Framework | FastAPI 0.115 + Uvicorn |
| ORM | SQLAlchemy 2.0 async |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Cache | Redis async |
| WA | Fonnte API via httpx |
| Storage | DigitalOcean Spaces (S3) |
| Deploy | Docker + Caddy + GitHub Actions → DigitalOcean |
