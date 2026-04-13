#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# PAR-Tee — Feature 7: Course Dashboard (Web)
# Apply script — copies new/updated files into the monorepo
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/feature7-files"

# Verify source files exist
REQUIRED_FILES=(
  layout.tsx
  dashboard_page.tsx
  bookings_page.tsx
  course_page.tsx
  tournaments_page.tsx
  billing_page.tsx
  settings_page.tsx
  login_page.tsx
  dashboard_api.ts
)

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$SRC/$f" ]]; then
    echo "❌ Missing $SRC/$f"; exit 1
  fi
done
echo "✅ All source files found (${#REQUIRED_FILES[@]} files)"

# ─── 1. Dashboard layout ────────────────────────────────────────────────────

echo "📦 Setting up web dashboard pages..."

# Create directories
mkdir -p apps/web/src/app/dashboard/bookings
mkdir -p apps/web/src/app/dashboard/course
mkdir -p apps/web/src/app/dashboard/tournaments
mkdir -p apps/web/src/app/dashboard/billing
mkdir -p apps/web/src/app/dashboard/settings
mkdir -p apps/web/src/app/dashboard/login

# Layout (wraps all /dashboard/* pages)
cp "$SRC/layout.tsx" apps/web/src/app/dashboard/layout.tsx
echo "   ✅ layout.tsx → apps/web/src/app/dashboard/layout.tsx"

# Overview page (dashboard home)
cp "$SRC/dashboard_page.tsx" apps/web/src/app/dashboard/page.tsx
echo "   ✅ dashboard_page.tsx → apps/web/src/app/dashboard/page.tsx"

# Bookings management
cp "$SRC/bookings_page.tsx" apps/web/src/app/dashboard/bookings/page.tsx
echo "   ✅ bookings_page.tsx → apps/web/src/app/dashboard/bookings/page.tsx"

# Course profile editor
cp "$SRC/course_page.tsx" apps/web/src/app/dashboard/course/page.tsx
echo "   ✅ course_page.tsx → apps/web/src/app/dashboard/course/page.tsx"

# Tournament management
cp "$SRC/tournaments_page.tsx" apps/web/src/app/dashboard/tournaments/page.tsx
echo "   ✅ tournaments_page.tsx → apps/web/src/app/dashboard/tournaments/page.tsx"

# Billing & invoicing
cp "$SRC/billing_page.tsx" apps/web/src/app/dashboard/billing/page.tsx
echo "   ✅ billing_page.tsx → apps/web/src/app/dashboard/billing/page.tsx"

# Settings
cp "$SRC/settings_page.tsx" apps/web/src/app/dashboard/settings/page.tsx
echo "   ✅ settings_page.tsx → apps/web/src/app/dashboard/settings/page.tsx"

# Login
cp "$SRC/login_page.tsx" apps/web/src/app/dashboard/login/page.tsx
echo "   ✅ login_page.tsx → apps/web/src/app/dashboard/login/page.tsx"

# ─── 2. API route ────────────────────────────────────────────────────────────

echo "📦 Copying API route..."
cp "$SRC/dashboard_api.ts" apps/api/src/routes/dashboard.ts
echo "   ✅ dashboard_api.ts → apps/api/src/routes/dashboard.ts"

# ─── 3. Register dashboard API route in index.ts ─────────────────────────────

echo "🔧 Patching API index.ts to register dashboard route..."
API_INDEX="apps/api/api/index.ts"
if [[ -f "$API_INDEX" ]]; then
  if grep -q 'dashboardRouter' "$API_INDEX"; then
    echo "   ⏭  Dashboard route already registered"
  else
    # Add import
    sed -i '' '/^import.*from.*routes/a\
import dashboardRouter from '"'"'../src/routes/dashboard'"'"';
' "$API_INDEX"

    # Add route registration — look for the last .route() call and add after it
    sed -i '' '/\.route.*courses/a\
  .route('"'"'/courses'"'"', dashboardRouter)
' "$API_INDEX"

    echo "   ✅ Registered dashboardRouter in API index"
    echo "   ⚠️  VERIFY: open apps/api/api/index.ts and confirm the import and .route() are correct"
  fi
else
  echo "   ⚠️  $API_INDEX not found — register manually:"
  echo "       import dashboardRouter from '../src/routes/dashboard';"
  echo "       .route('/courses', dashboardRouter)"
fi

# ─── Done ────────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "✅ Feature 7 files applied!"
echo ""
echo "IMPORTANT: The dashboard API route uses /courses/:courseId/dashboard/*"
echo "endpoints, which are sub-routes under the existing courses route."
echo ""
echo "VERIFY apps/api/api/index.ts has the dashboard route registered."
echo "The dashboard API needs the 'courses' route to be its parent, so"
echo "the import should look like:"
echo ""
echo "  import dashboardRouter from '../src/routes/dashboard';"
echo "  // then mount it: .route('/courses', dashboardRouter)"
echo ""
echo "NEXT STEPS:"
echo "  1. Verify apps/api/api/index.ts is correct"
echo "  2. git add -A && git commit -m 'feat: course dashboard web (Feature 7)'"
echo "  3. git push origin feature/7-course-dashboard"
echo "  4. Open PR on GitHub"
echo "══════════════════════════════════════════════════════════════════════"
