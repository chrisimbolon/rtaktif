#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# RukunRT — IAM Local Test Suite
# Tests every auth + IAM endpoint against your local running API.
#
# Prerequisites:
#   1. DB seeded:   python scripts/seed_dev.py
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

# ── Check API is running ───────────────────────────────────────────
check_api() {
  if ! curl -sf "http://localhost:8000/health" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: API not running at $BASE${NC}"
    echo "Start it with: uvicorn app.main:app --reload --port 8000"
    exit 1
  fi
}

# ── HTTP helper ────────────────────────────────────────────────────
call() {
  local method="$1" url="$2" data="${3:-}" token="${4:-}"
  local args=(-s -w "\n__STATUS__%{http_code}" -X "$method" "$BASE$url"
              -H "Content-Type: application/json")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data"  ] && args+=(-d "$data")
  curl "${args[@]}"
}

get_body()   { echo "$1" | sed 's/__STATUS__[0-9]*//' | tr -d '\n'; }
get_status() { echo "$1" | grep -o '__STATUS__[0-9]*' | grep -o '[0-9]*'; }
get_field()  { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$2',''))" 2>/dev/null; }

# ══════════════════════════════════════════════════════════════════
echo -e "${BOLD}RukunRT IAM Local Test Suite${NC}"
echo "API: $BASE"
echo "$(date)"
echo "══════════════════════════════════════════════════"

check_api
echo -e "${GREEN}✓ API is running${NC}"

# ── Unique values for this run (prevents phone/email collisions) ───
TS=$(date +%s)
WARGA_EMAIL="warga_${TS}@rtaktif.id"
SHORT_EMAIL="shortpass_${TS}@rtaktif.id"
NAME_EMAIL="shortname_${TS}@rtaktif.id"
# Phones: valid Indonesian format 08xx + last 8 digits of timestamp
P1="0812${TS: -8}"
P2="0813${TS: -8}"
P3="0814${TS: -8}"
P4="0815${TS: -8}"
P5="0816${TS: -8}"


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

# 2a. Register new warga — unique email + unique phone each run
log_step "POST /auth/register — new warga (should succeed, 201)"
PAYLOAD=$(printf '{"full_name":"Siti Warga Test","email":"%s","phone":"%s","password":"warga123"}' "$WARGA_EMAIL" "$P1")
RES=$(call POST /auth/register "$PAYLOAD")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Email: $WARGA_EMAIL  Phone: $P1"
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "201" ] && pass "Register warga → 201 Created ✓" || fail "Register warga failed: $STATUS"
WARGA_STATUS=$(get_field "$BODY" "status")
[ "$WARGA_STATUS" = "pending" ] && pass "New user status = 'pending' ✓" || fail "Expected pending, got: $WARGA_STATUS"
WARGA_ID=$(get_field "$BODY" "id")
echo "  Warga ID: $WARGA_ID"

# 2b. Duplicate email → 409
log_step "POST /auth/register — duplicate email (should fail 409)"
PAYLOAD=$(printf '{"full_name":"Duplicate","email":"%s","phone":"%s","password":"pass123"}' "$WARGA_EMAIL" "$P2")
RES=$(call POST /auth/register "$PAYLOAD")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "409" ] && pass "Duplicate email → 409 Conflict ✓" || fail "Expected 409, got: $STATUS"

# 2c. Duplicate phone → 409
log_step "POST /auth/register — duplicate phone (should fail 409)"
PAYLOAD=$(printf '{"full_name":"Phone Dup","email":"phonedupe_%s@rtaktif.id","phone":"%s","password":"pass123"}' "$TS" "$P1")
RES=$(call POST /auth/register "$PAYLOAD")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "409" ] && pass "Duplicate phone → 409 Conflict ✓" || fail "Expected 409, got: $STATUS"

# 2d. Invalid email format → 422
log_step "POST /auth/register — invalid email (should fail 422)"
PAYLOAD=$(printf '{"full_name":"Bad Email","email":"not-an-email","phone":"%s","password":"pass123"}' "$P3")
RES=$(call POST /auth/register "$PAYLOAD")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "422" ] && pass "Invalid email → 422 Unprocessable ✓" || fail "Expected 422, got: $STATUS"

# 2e. Short password → 422
log_step "POST /auth/register — short password (should fail 422)"
PAYLOAD=$(printf '{"full_name":"Short Pass","email":"%s","phone":"%s","password":"123"}' "$SHORT_EMAIL" "$P4")
RES=$(call POST /auth/register "$PAYLOAD")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "422" ] && pass "Short password → 422 Unprocessable ✓" || fail "Expected 422, got: $STATUS"

# 2f. Short full_name → 422
log_step "POST /auth/register — short full_name (should fail 422)"
PAYLOAD=$(printf '{"full_name":"AB","email":"%s","phone":"%s","password":"validpass123"}' "$NAME_EMAIL" "$P5")
RES=$(call POST /auth/register "$PAYLOAD")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "422" ] && pass "Short full_name → 422 Unprocessable ✓" || fail "Expected 422, got: $STATUS"


# ── SECTION 3: Login — Pending user blocked ────────────────────────
log_section "3. Login — Pending User (must be blocked)"

log_step "POST /auth/login — pending user (should fail 401)"
PAYLOAD=$(printf '{"email":"%s","password":"warga123"}' "$WARGA_EMAIL")
RES=$(call POST /auth/login "$PAYLOAD")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "401" ] && pass "Pending user blocked → 401 ✓" || fail "Expected 401, got: $STATUS"


# ── SECTION 4: Admin Login ─────────────────────────────────────────
log_section "4. Admin Login (seeded account)"

log_step "POST /auth/login — admin@rukunrt.id (should succeed 200)"
RES=$(call POST /auth/login '{"email":"admin@rukunrt.id","password":"admin123"}')
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Admin login → 200 OK ✓" || fail "Admin login failed: $STATUS — did you run seed_dev.py?"
ADMIN_TOKEN=$(get_field "$BODY" "access_token")
[ -n "$ADMIN_TOKEN" ] && pass "JWT token received ✓" || fail "No access_token in response"
echo "  Token (first 60 chars): ${ADMIN_TOKEN:0:60}..."


# ── SECTION 5: JWT Decode ──────────────────────────────────────────
log_section "5. JWT Token Verification"

log_step "Decode JWT payload (no signature check)"
PAYLOAD_B64=$(echo "$ADMIN_TOKEN" | cut -d'.' -f2)
PAD=$((4 - ${#PAYLOAD_B64} % 4))
[ $PAD -ne 4 ] && PAYLOAD_B64="${PAYLOAD_B64}$(python3 -c "print('='*$PAD)")"
DECODED=$(echo "$PAYLOAD_B64" | base64 -d 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "{}")
echo "  JWT Payload:"
echo "$DECODED" | sed 's/^/    /'

JWT_SUB=$(echo "$DECODED"  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sub',''))"  2>/dev/null || echo "")
JWT_ROLE=$(echo "$DECODED" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('role',''))" 2>/dev/null || echo "")
JWT_EXP=$(echo "$DECODED"  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('exp',''))"  2>/dev/null || echo "")

[ -n "$JWT_SUB"  ] && pass "JWT has 'sub' (user_id) = ${JWT_SUB:0:8}... ✓"  || fail "JWT missing 'sub'"
[ -n "$JWT_ROLE" ] && pass "JWT has 'role' = $JWT_ROLE ✓"                    || fail "JWT missing 'role'"
[ -n "$JWT_EXP"  ] && pass "JWT has 'exp' (expiry) ✓"                        || fail "JWT missing 'exp'"

NOW=$(date +%s)
if [ -n "$JWT_EXP" ] && [ "$JWT_EXP" -gt "$NOW" ] 2>/dev/null; then
  EXPIRY=$(python3 -c "from datetime import datetime,timezone; print(datetime.fromtimestamp($JWT_EXP, tz=timezone.utc).strftime('%Y-%m-%d %H:%M UTC'))" 2>/dev/null || echo "$JWT_EXP")
  pass "JWT not expired (expires: $EXPIRY) ✓"
else
  fail "JWT expired or exp missing!"
fi


# ── SECTION 6: Protected Routes ────────────────────────────────────
log_section "6. Protected Routes"

# 6a. Valid token
log_step "GET /users/me — valid admin token (should succeed 200)"
RES=$(call GET /users/me "" "$ADMIN_TOKEN")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "GET /users/me → 200 OK ✓" || fail "GET /users/me failed: $STATUS"
ME_ROLE=$(get_field "$BODY" "role")
[ "$ME_ROLE" = "admin_rt" ] && pass "Role = admin_rt ✓" || fail "Expected admin_rt, got: $ME_ROLE"
ME_STATUS=$(get_field "$BODY" "status")
[ "$ME_STATUS" = "active" ] && pass "Status = active ✓" || fail "Expected active, got: $ME_STATUS"

# 6b. No token
log_step "GET /users/me — no token (should fail 403)"
RES=$(curl -s -w "\n__STATUS__%{http_code}" "$BASE/users/me")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "No token → 403 Forbidden ✓" || fail "Expected 403, got: $STATUS"

# 6c. Invalid token
log_step "GET /users/me — garbage token (should fail 401/403)"
RES=$(curl -s -w "\n__STATUS__%{http_code}" "$BASE/users/me" -H "Authorization: Bearer garbage.token.here")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
{ [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; } && pass "Garbage token → $STATUS ✓" || fail "Expected 401/403, got: $STATUS"


# ── SECTION 7: Verify Pending Warga ───────────────────────────────
log_section "7. Admin Verifies Pending Warga"

log_step "PATCH /users/$WARGA_ID/verify — admin token (should succeed 200)"
RES=$(call PATCH "/users/$WARGA_ID/verify" "" "$ADMIN_TOKEN")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Verify user → 200 OK ✓" || fail "Verify user failed: $STATUS"
NEW_STATUS=$(get_field "$BODY" "status")
[ "$NEW_STATUS" = "active" ] && pass "Status changed → 'active' ✓" || fail "Expected active, got: $NEW_STATUS"


# ── SECTION 8: Verified Warga Can Login ───────────────────────────
log_section "8. Verified Warga Login"

log_step "POST /auth/login — verified warga (should succeed 200)"
PAYLOAD=$(printf '{"email":"%s","password":"warga123"}' "$WARGA_EMAIL")
RES=$(call POST /auth/login "$PAYLOAD")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Verified warga login → 200 OK ✓" || fail "Warga login failed: $STATUS"
WARGA_TOKEN=$(get_field "$BODY" "access_token")
[ -n "$WARGA_TOKEN" ] && pass "Warga JWT received ✓" || fail "No token for warga"


# ── SECTION 9: Role Guards (RBAC) ─────────────────────────────────
log_section "9. Role-Based Access Control"

FAKE_RT="00000000-0000-0000-0000-000000000001"

log_step "GET /warga/rt/{id} — warga token on admin endpoint (should fail 403)"
RES=$(call GET "/warga/rt/$FAKE_RT" "" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga on admin endpoint → 403 ✓" || fail "Expected 403, got: $STATUS"

log_step "POST /tagihan/generate-bulk — warga token (should fail 403)"
PAYLOAD=$(printf '{"rt_group_id":"%s","year":2026,"month":5,"amount_idr":30000}' "$FAKE_RT")
RES=$(call POST /tagihan/generate-bulk "$PAYLOAD" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga cannot generate invoices → 403 ✓" || fail "Expected 403, got: $STATUS"

log_step "PATCH /users/{id}/verify — warga token (should fail 403)"
RES=$(call PATCH "/users/$WARGA_ID/verify" "" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga cannot verify users → 403 ✓" || fail "Expected 403, got: $STATUS"

log_step "POST /komunikasi/announcements — warga token (should fail 403)"
PAYLOAD=$(printf '{"rt_group_id":"%s","title":"Hacked","body":"Unauthorized","ann_type":"info","channel":"app"}' "$FAKE_RT")
RES=$(call POST /komunikasi/announcements "$PAYLOAD" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga cannot create announcements → 403 ✓" || fail "Expected 403, got: $STATUS"


# ── SECTION 10: Wrong Credentials ─────────────────────────────────
log_section "10. Wrong Credentials"

log_step "POST /auth/login — wrong password (should fail 401)"
RES=$(call POST /auth/login '{"email":"admin@rukunrt.id","password":"wrongpassword"}')
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "401" ] && pass "Wrong password → 401 ✓" || fail "Expected 401, got: $STATUS"

log_step "POST /auth/login — nonexistent email (should fail 401)"
RES=$(call POST /auth/login '{"email":"ghost@nowhere.com","password":"pass123"}')
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "401" ] && pass "Nonexistent email → 401 ✓" || fail "Expected 401, got: $STATUS"


# ── SECTION 11: Assign Role ────────────────────────────────────────
log_section "11. Role Assignment (Admin Only)"

log_step "PATCH /users/$WARGA_ID/role?role=admin_rt — admin token"
RES=$(call PATCH "/users/$WARGA_ID/role?role=admin_rt" "" "$ADMIN_TOKEN")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
[ "$STATUS" = "200" ] && pass "Assign role admin_rt → 200 ✓" || fail "Assign role failed: $STATUS"

log_step "PATCH /users/$WARGA_ID/role — warga token (should fail 403)"
RES=$(call PATCH "/users/$WARGA_ID/role?role=warga" "" "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga cannot assign roles → 403 ✓" || fail "Expected 403, got: $STATUS"


# ── SECTION 12: RT Group ───────────────────────────────────────────
log_section "12. RT Group Operations"

log_step "POST /rt-groups — admin token (201 or 409 if exists)"
RES=$(call POST /rt-groups \
  '{"rt_number":"05","rw_number":"02","kelurahan":"Padang Harapan","kecamatan":"Gading Cempaka","kota":"Bengkulu","provinsi":"Bengkulu","monthly_fee_idr":30000}' \
  "$ADMIN_TOKEN")
BODY=$(get_body "$RES"); STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
show_json "$BODY" | sed 's/^/  /'
{ [ "$STATUS" = "201" ] || [ "$STATUS" = "409" ]; } && pass "Create RT group → $STATUS ✓" || fail "Unexpected status: $STATUS"

log_step "POST /rt-groups — warga token (should fail 403)"
RES=$(call POST /rt-groups \
  '{"rt_number":"99","rw_number":"99","kelurahan":"X","kecamatan":"X","kota":"X","provinsi":"X","monthly_fee_idr":30000}' \
  "$WARGA_TOKEN")
STATUS=$(get_status "$RES")
echo "  Status: $STATUS"
[ "$STATUS" = "403" ] && pass "Warga cannot create RT group → 403 ✓" || fail "Expected 403, got: $STATUS"


# ── SECTION 13: DB State ──────────────────────────────────────────
log_section "13. Database State After Tests"

DB_URL="${DATABASE_URL:-}"
if [ -n "$DB_URL" ]; then
  python3 -c "
import asyncio, asyncpg, os

async def counts():
    url = os.environ['DATABASE_URL'].replace('+asyncpg','')
    conn = await asyncpg.connect(url)
    tables = ['users','residents','rt_groups','invoices','payments',
              'announcements','laporan_warga','notification_logs']
    for t in tables:
        n = await conn.fetchval(f'SELECT COUNT(*) FROM {t}')
        print(f'  📊 {t:<25} {n} rows')
    await conn.close()

asyncio.run(counts())
" 2>/dev/null || echo "  (could not connect)"
else
  echo "  (export DATABASE_URL to see row counts)"
fi


# ── SUMMARY ───────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
printf "${BOLD}Results: ${GREEN}%d passed${NC} / ${RED}%d failed${NC}\n" "$PASS" "$FAIL"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}🎉 ALL IAM TESTS PASSED!"
  echo -e "Auth system is solid mate. Ready for DigitalOcean! 🚀${NC}"
else
  echo -e "${RED}${BOLD}❌ $FAIL test(s) failed — check output above${NC}"
  echo ""
  echo "Common fixes:"
  echo "  • API not running?  → uvicorn app.main:app --reload --port 8000"
  echo "  • Seed not run?     → python scripts/seed_dev.py"
  echo "  • Wrong .env?       → check DATABASE_URL, JWT_SECRET_KEY, SECRET_KEY"
fi
echo ""
