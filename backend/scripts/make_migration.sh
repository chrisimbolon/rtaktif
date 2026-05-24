#!/bin/bash
# Usage: ./scripts/make_migration.sh "add_phone_to_residents"
set -e
MSG=${1:-"migration"}
DATE=$(date +%Y_%m_%d)
COUNT=$(ls migrations/versions/*.py 2>/dev/null | wc -l | tr -d ' ')
PADDED=$(printf "%03d" $((COUNT + 1)))
alembic revision --autogenerate -m "${DATE}_${PADDED}_${MSG}"
echo "✅ Migration created."
