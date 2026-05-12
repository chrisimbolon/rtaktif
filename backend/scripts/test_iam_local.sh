#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# RukunRT — IAM Local Test Suite
# Tests every auth + IAM endpoint against your local running API.
#
# Prerequisites:
#   1. DB seeded:  python scripts/seed_dev.py
#   2. API running: uvicorn app.main:app --reload --port 8000
#
# Usage:
#   chmod +x scripts/test_iam_local.sh
#   ./scripts/test_iam_local.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

BASE="http://localhost:8000/api/v1"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

PASS=0; FAIL=0

# ── Helpers ────────────────────────────────────────────────────────
log_section() { echo -e "\n${BOLD}${BLUE}━━━ $1 ━━━${NC}"; }
log_step()    { echo -e "\n${YELLOW}▶ $1${NC}"; }
pass()        { echo -e "  ${GREEN}✓ $1${NC}"; PASS=$((PASS+1)); }
fail()        { echo -e "  ${RED}✗ $1${NC}"; FAIL=$((FAIL+1)); }
show_json()   { echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"; }

# Check API is running
check_api() {
  # if ! curl -sf "$BASE/../health" > /dev/null 2>&1; then
    if ! curl -sf "http://localhost:8000/health" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: API not running at $BASE${NC}"
    echo "Start it with: uvicorn app.main:app --reload --port 8000"
    exit 1
  fi
}

# HTTP call with status code capture
call() {
  local method="$1" url="$2" data="${3:-}" token="${4:-}"
  local headers=(-H "Content-Type: application/json")
  [ -n "$token" ] && headers+=(-H "Authorization: Bearer $token")

  if [ -n "$data" ]; then
    curl -s -w "\n__STATUS__%{http_code}" -X "$method" "$BASE$url" \
      "${headers[@]}" -d "$data"
  else
    curl -s -w "\n__STATUS__%{http_code}" -X "$method" "$BASE$url" \
      "${headers[@]}"
  fi
}

# Extract body + status
get_body()   { echo "$1" | sed 's/__STATUS__[0-9]*//' | tr -d '\n'; }
get_status() { echo "$1" | grep -o '__STATUS__[0-9]*' | grep -o '[0-9]*'; }
get_field()  { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$2',''))" 2>/dev/null; }

# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}RukunRT IAM Local Test Suite${NC}"
echo "API: $BASE"
echo "$(date)"
echo "══════════════════════════════════════════════════"

check_api
echo -e "${GREEN}✓ API is running${NC}"


# ── SECTION 1: Health ──────────────────────────────────────────────
log_section "1. Health Check"

log_step "GET /health"
RES=$(curl -s -w "\n__STATUS__%{http_code}" http://localhost:8000/health)
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Health check returns 200" || fail "Health check failed: $STATUS"


# ── SECTION 2: Register ────────────────────────────────────────────
log_section "2. User Registration"

# 2a. Register new warga
log_step "POST /auth/register — new warga (should succeed)"
WARGA_EMAIL="warga_test_$(date +%s)@rtaktif.id"
RES=$(call POST /auth/register "{
  \"full_name\": \"Siti Warga Test\",
  \"email\": \"$WARGA_EMAIL\",
  \"phone\": \"081234567891\",
  \"password\": \"warga123\"
}")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "201" ] && pass "Register warga → 201 Created" || fail "Register warga failed: $STATUS"
WARGA_STATUS=$(get_field "$BODY" "status")
[ "$WARGA_STATUS" = "pending" ] && pass "New user status = 'pending' ✓" || fail "Expected pending, got: $WARGA_STATUS"
WARGA_ID=$(get_field "$BODY" "id")
echo "  Warga ID: $WARGA_ID"

# 2b. Duplicate email must fail
log_step "POST /auth/register — duplicate email (should fail 409)"
RES=$(call POST /auth/register "{
  \"full_name\": \"Duplicate User\",
  \"email\": \"$WARGA_EMAIL\",
  \"phone\": \"081234567892\",
  \"password\": \"pass123\"
}")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "409" ] && pass "Duplicate email → 409 Conflict ✓" || fail "Expected 409, got: $STATUS"

# 2c. Invalid email format
log_step "POST /auth/register — invalid email (should fail 422)"
RES=$(call POST /auth/register "{
  \"full_name\": \"Bad Email\",
  \"email\": \"not-an-email\",
  \"phone\": \"081234567893\",
  \"password\": \"pass123\"
}")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "422" ] && pass "Invalid email → 422 Unprocessable ✓" || fail "Expected 422, got: $STATUS"

# 2d. Short password
log_step "POST /auth/register — short password (should fail 422)"
RES=$(call POST /auth/register "{
  \"full_name\": \"Short Pass\",
  \"email\": \"short@test.com\",
  \"phone\": \"081234567894\",
  \"password\": \"123\"
}")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "422" ] && pass "Short password → 422 Unprocessable ✓" || fail "Expected 422, got: $STATUS"


# ── SECTION 3: Login — Pending user blocked ────────────────────────
log_section "3. Login — Pending User (must be blocked)"

log_step "POST /auth/login — pending user (should fail 401)"
RES=$(call POST /auth/login "{
  \"email\": \"$WARGA_EMAIL\",
  \"password\": \"warga123\"
}")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "401" ] && pass "Pending user login → 401 Unauthorized ✓" || fail "Expected 401, got: $STATUS"


# ── SECTION 4: Admin login ─────────────────────────────────────────
log_section "4. Admin Login (seeded account)"

log_step "POST /auth/login — admin@rukunrt.id (should succeed)"
RES=$(call POST /auth/login "{
  \"email\": \"admin@rukunrt.id\",
  \"password\": \"admin123\"
}")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Admin login → 200 OK ✓" || fail "Admin login failed: $STATUS — did you run seed_dev.py?"
ADMIN_TOKEN=$(get_field "$BODY" "access_token")
[ -n "$ADMIN_TOKEN" ] && pass "JWT token received ✓" || fail "No access_token in response"
echo "  Token (first 60 chars): ${ADMIN_TOKEN:0:60}..."


# ── SECTION 5: JWT Decode ──────────────────────────────────────────
log_section "5. JWT Token Verification"

log_step "Decode JWT payload (without signature verification)"
PAYLOAD=$(echo "$ADMIN_TOKEN" | cut -d'.' -f2)
# Add padding
PADDED="${PAYLOAD}$(python3 -c "print('='*((4-len('$PAYLOAD')%4)%4))")"
DECODED=$(echo "$PADDED" | base64 -d 2>/dev/null | python3 -m json.tool 2>/dev/null)
echo "  JWT Payload:"
echo "$DECODED" | sed 's/^/  /'

# Verify fields
JWT_ROLE=$(echo "$DECODED" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('role',''))" 2>/dev/null)
JWT_SUB=$(echo "$DECODED" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sub',''))" 2>/dev/null)
JWT_EXP=$(echo "$DECODED" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('exp',''))" 2>/dev/null)

[ -n "$JWT_SUB" ]  && pass "JWT contains 'sub' (user_id) ✓" || fail "JWT missing 'sub'"
[ -n "$JWT_ROLE" ] && pass "JWT contains 'role' = $JWT_ROLE ✓" || fail "JWT missing 'role'"
[ -n "$JWT_EXP" ]  && pass "JWT contains 'exp' (expiry) ✓" || fail "JWT missing 'exp'"

# Check expiry is in the future
NOW=$(date +%s)
[ "$JWT_EXP" -gt "$NOW" ] && pass "JWT not expired (exp=$(date -d @$JWT_EXP 2>/dev/null || date -r $JWT_EXP)) ✓" \
                           || fail "JWT already expired!"


# ── SECTION 6: Protected Routes ────────────────────────────────────
log_section "6. Protected Routes"

# 6a. GET /users/me with valid token
log_step "GET /users/me — valid admin token (should succeed)"
RES=$(call GET /users/me "" "$ADMIN_TOKEN")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "GET /users/me → 200 OK ✓" || fail "GET /users/me failed: $STATUS"
ME_ROLE=$(get_field "$BODY" "role")
[ "$ME_ROLE" = "admin_rt" ] && pass "User role = admin_rt ✓" || fail "Expected admin_rt, got: $ME_ROLE"
ME_STATUS=$(get_field "$BODY" "status")
[ "$ME_STATUS" = "active" ] && pass "User status = active ✓" || fail "Expected active, got: $ME_STATUS"

# 6b. GET /users/me with NO token
log_step "GET /users/me — no token (should fail 403)"
RES=$(curl -s -w "\n__STATUS__%{http_code}" -X GET "$BASE/users/me")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "No token → 403 Forbidden ✓" || fail "Expected 403, got: $STATUS"

# 6c. GET /users/me with INVALID token
log_step "GET /users/me — garbage token (should fail 403/401)"
RES=$(curl -s -w "\n__STATUS__%{http_code}" -X GET "$BASE/users/me" \
  -H "Authorization: Bearer this.is.garbage")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] && pass "Invalid token → $STATUS ✓" || fail "Expected 401/403, got: $STATUS"


# ── SECTION 7: Verify Pending Warga ───────────────────────────────
log_section "7. Admin Verifies Pending Warga"

log_step "PATCH /users/$WARGA_ID/verify — admin token (should succeed)"
RES=$(call PATCH "/users/$WARGA_ID/verify" "" "$ADMIN_TOKEN")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Verify user → 200 OK ✓" || fail "Verify user failed: $STATUS"
NEW_STATUS=$(get_field "$BODY" "status")
[ "$NEW_STATUS" = "active" ] && pass "User status changed to 'active' ✓" || fail "Expected active, got: $NEW_STATUS"


# ── SECTION 8: Verified Warga Can Now Login ────────────────────────
log_section "8. Verified Warga Login"

log_step "POST /auth/login — now verified warga (should succeed)"
RES=$(call POST /auth/login "{
  \"email\": \"$WARGA_EMAIL\",
  \"password\": \"warga123\"
}")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Verified warga login → 200 OK ✓" || fail "Warga login failed: $STATUS"
WARGA_TOKEN=$(get_field "$BODY" "access_token")
[ -n "$WARGA_TOKEN" ] && pass "Warga JWT token received ✓" || fail "No token for warga"


# ── SECTION 9: Role Guards ─────────────────────────────────────────
log_section "9. Role-Based Access Control"

# 9a. Warga hits admin-only endpoint
log_step "GET /warga/rt/... — warga token hits admin endpoint (should fail 403)"
FAKE_RT_ID="00000000-0000-0000-0000-000000000001"
RES=$(call GET "/warga/rt/$FAKE_RT_ID" "" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga token on admin endpoint → 403 Forbidden ✓" || fail "Expected 403, got: $STATUS"

# 9b. Warga tries to generate invoices
log_step "POST /tagihan/generate-bulk — warga token (should fail 403)"
RES=$(call POST /tagihan/generate-bulk "{
  \"rt_group_id\": \"$FAKE_RT_ID\",
  \"year\": 2026, \"month\": 5, \"amount_idr\": 30000
}" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga cannot generate invoices → 403 ✓" || fail "Expected 403, got: $STATUS"

# 9c. Warga tries to verify another user
log_step "PATCH /users/{id}/verify — warga token (should fail 403)"
RES=$(call PATCH "/users/$WARGA_ID/verify" "" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga cannot verify users → 403 ✓" || fail "Expected 403, got: $STATUS"


# ── SECTION 10: Wrong Password ─────────────────────────────────────
log_section "10. Wrong Password"

log_step "POST /auth/login — wrong password (should fail 401)"
RES=$(call POST /auth/login "{
  \"email\": \"admin@rukunrt.id\",
  \"password\": \"wrongpassword\"
}")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "401" ] && pass "Wrong password → 401 Unauthorized ✓" || fail "Expected 401, got: $STATUS"

log_step "POST /auth/login — nonexistent email (should fail 401)"
RES=$(call POST /auth/login "{
  \"email\": \"ghost@nowhere.com\",
  \"password\": \"pass123\"
}")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "401" ] && pass "Nonexistent email → 401 Unauthorized ✓" || fail "Expected 401, got: $STATUS"


# ── SECTION 11: Assign Role ────────────────────────────────────────
log_section "11. Role Assignment (Admin Only)"

log_step "PATCH /users/$WARGA_ID/role?role=admin_rt — admin token"
RES=$(call PATCH "/users/$WARGA_ID/role?role=admin_rt" "" "$ADMIN_TOKEN")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Assign role → 200 OK ✓" || fail "Assign role failed: $STATUS"


# ── SECTION 12: RT Group ───────────────────────────────────────────
log_section "12. RT Group Operations"

log_step "POST /rt-groups — create RT group (admin only)"
RES=$(call POST /rt-groups "{
  \"rt_number\": \"05\",
  \"rw_number\": \"02\",
  \"kelurahan\": \"Padang Harapan\",
  \"kecamatan\": \"Gading Cempaka\",
  \"kota\": \"Bengkulu\",
  \"provinsi\": \"Bengkulu\",
  \"monthly_fee_idr\": 30000
}" "$ADMIN_TOKEN")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
# 201 = created, 409 = already exists from seed (both ok)
[ "$STATUS" = "201" ] || [ "$STATUS" = "409" ] && \
  pass "Create RT group → $STATUS ✓" || fail "Create RT group failed: $STATUS"

log_step "POST /rt-groups — warga token (should fail 403)"
RES=$(call POST /rt-groups "{
  \"rt_number\": \"99\",
  \"rw_number\": \"99\",
  \"kelurahan\": \"Test\",
  \"kecamatan\": \"Test\",
  \"kota\": \"Test\",
  \"provinsi\": \"Test\",
  \"monthly_fee_idr\": 30000
}" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga cannot create RT group → 403 ✓" || fail "Expected 403, got: $STATUS"


# ── SECTION 13: DB State After Tests ──────────────────────────────
log_section "13. Database State After Tests"

echo "  Running final DB row counts..."
python3 -c "
import asyncio, asyncpg, os

async def counts():
    url = os.environ.get('DATABASE_URL','').replace('+asyncpg','')
    conn = await asyncpg.connect(url)
    tables = ['users','residents','rt_groups','invoices','payments',
              'announcements','laporan_warga','notification_logs']
    for t in tables:
        count = await conn.fetchval(f'SELECT COUNT(*) FROM {t}')
        print(f'  📊 {t:<25} {count} rows')
    await conn.close()

asyncio.run(counts())
" 2>/dev/null || echo "  (set DATABASE_URL to see counts)"


# ── SUMMARY ────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
printf "${BOLD}Results: ${GREEN}%d passed${NC} / ${RED}%d failed${NC}\n" $PASS $FAIL
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}${BOLD}🎉 ALL IAM TESTS PASSED!"
  echo -e "Your auth system is solid mate. Ready for DigitalOcean! 🚀${NC}"
else
  echo -e "${RED}${BOLD}❌ $FAIL test(s) failed — check output above${NC}"
  echo ""
  echo "Common fixes:"
  echo "  • API not running?  → uvicorn app.main:app --reload --port 8000"
  echo "  • Seed not run?     → python scripts/seed_dev.py"
  echo "  • Wrong .env?       → check DATABASE_URL, JWT_SECRET_KEY, SECRET_KEY"
fi
echo ""
