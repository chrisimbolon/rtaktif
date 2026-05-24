#!/bin/bash
set -e
echo "🚀 Starting RukunRT dev environment..."

# Copy env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📋 Created .env from .env.example — please fill in your values"
fi

# Start DB + Redis
docker compose up -d db redis
echo "⏳ Waiting for DB to be ready..."
sleep 4

# Run migrations
echo "🗄️  Running migrations..."
alembic upgrade head

# Start API
echo "✅ Starting FastAPI server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
