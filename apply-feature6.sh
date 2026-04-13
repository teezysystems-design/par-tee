#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# PAR-Tee — Feature 6: Leagues & Tournaments
# Apply script — copies new/updated files into the monorepo
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/feature6-files"

# Verify source files exist
for f in 0017_leagues_tournaments.sql leagues.ts tournaments.ts leagues_index.tsx tournaments_index.tsx; do
  if [[ ! -f "$SRC/$f" ]]; then
    echo "❌ Missing $SRC/$f"; exit 1
  fi
done
echo "✅ All source files found"

# ─── 1. New API routes ──────────────────────────────────────────────────────

echo "📦 Copying API route files..."
cp "$SRC/leagues.ts" apps/api/src/routes/leagues.ts
cp "$SRC/tournaments.ts" apps/api/src/routes/tournaments.ts
echo "   ✅ leagues.ts → apps/api/src/routes/"
echo "   ✅ tournaments.ts → apps/api/src/routes/"

# ─── 2. Migration file ──────────────────────────────────────────────────────

mkdir -p supabase/migrations
cp "$SRC/0017_leagues_tournaments.sql" supabase/migrations/0017_leagues_tournaments.sql
echo "   ✅ 0017_leagues_tournaments.sql → supabase/migrations/"

# ─── 3. Mobile screens ──────────────────────────────────────────────────────

echo "📦 Copying mobile screen files..."
mkdir -p apps/mobile/app/leagues
mkdir -p apps/mobile/app/tournaments
cp "$SRC/leagues_index.tsx" apps/mobile/app/leagues/index.tsx
cp "$SRC/tournaments_index.tsx" apps/mobile/app/tournaments/index.tsx
echo "   ✅ leagues_index.tsx → apps/mobile/app/leagues/index.tsx"
echo "   ✅ tournaments_index.tsx → apps/mobile/app/tournaments/index.tsx"

# ─── 4. Patch: (tabs)/_layout.tsx — fix brand green ─────────────────────────

echo "🔧 Patching (tabs)/_layout.tsx — brand green..."
TABS_LAYOUT="apps/mobile/app/(tabs)/_layout.tsx"
if [[ -f "$TABS_LAYOUT" ]]; then
  # Replace any variant of the old primary green with new brand green
  sed -i '' "s/#1a7f4b/#1B6B3A/g" "$TABS_LAYOUT"
  sed -i '' "s/#1A7F4B/#1B6B3A/g" "$TABS_LAYOUT"
  echo "   ✅ Updated PRIMARY color to #1B6B3A"
else
  echo "   ⚠️  $TABS_LAYOUT not found — apply manually"
fi

# ─── 5. Patch: compete.tsx — fix brand green + default tier ─────────────────

echo "🔧 Patching compete.tsx..."
COMPETE="apps/mobile/app/(tabs)/compete.tsx"
if [[ -f "$COMPETE" ]]; then
  sed -i '' "s/#1a7f4b/#1B6B3A/g" "$COMPETE"
  sed -i '' "s/#1A7F4B/#1B6B3A/g" "$COMPETE"
  # Fix default tier from 'rookie' to 'bronze_1'
  sed -i '' "s/'rookie'/'bronze_1'/g" "$COMPETE"
  echo "   ✅ Updated PRIMARY color + default tier"
else
  echo "   ⚠️  $COMPETE not found — apply manually"
fi

# ─── 6. Patch: _layout.tsx — register new screens ───────────────────────────

echo "🔧 Patching _layout.tsx — registering new screens..."
ROOT_LAYOUT="apps/mobile/app/_layout.tsx"
if [[ -f "$ROOT_LAYOUT" ]]; then
  # Check if leagues screen is already registered
  if grep -q 'leagues/index' "$ROOT_LAYOUT"; then
    echo "   ⏭  Screens already registered"
  else
    # Insert the new screen registrations before the +not-found line
    sed -i '' '/+not-found/i\
        <Stack.Screen name="leagues/index" options={{ headerShown: false }} />\
        <Stack.Screen name="tournaments/index" options={{ headerShown: false }} />\
        <Stack.Screen name="rankup/index" options={{ headerShown: false }} />
' "$ROOT_LAYOUT"
    echo "   ✅ Added leagues/index, tournaments/index, rankup/index screens"
  fi
else
  echo "   ⚠️  $ROOT_LAYOUT not found — apply manually"
fi

# ─── Done ────────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "✅ Feature 6 files applied!"
echo ""
echo "NEXT STEPS:"
echo "  1. Run the SQL migration in Supabase SQL Editor"
echo "  2. git add -A && git commit -m 'feat: leagues & tournaments (Feature 6)'"
echo "  3. git push origin feature/6-leagues-tournaments"
echo "  4. Open PR on GitHub"
echo "══════════════════════════════════════════════════════════════════════"
