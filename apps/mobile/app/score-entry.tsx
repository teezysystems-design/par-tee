/**
 * Score Entry Screen — hole-by-hole score input.
 *
 * Flow:
 *   1. User taps "+ Log Score" on the Compete tab.
 *   2. They step through 18 (or 9) holes entering strokes per hole.
 *   3. A round summary card is shown at the end with share + save options.
 */
import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import type { HoleScore } from '@par-tee/shared';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1a7f4b';

// Default course pars for a standard 18-hole round.
// In production this comes from the selected course's par data.
const DEFAULT_PARS_18 = [4,4,3,5,4,3,4,5,4, 4,3,5,4,4,3,5,4,4];
const DEFAULT_PARS_9  = [4,4,3,5,4,3,4,5,4];

function strokeLabel(strokes: number | null, par: number): { label: string; color: string; bg: string } {
  if (strokes == null) return { label: '-', color: '#9ca3af', bg: '#f3f4f6' };
  const diff = strokes - par;
  if (diff <= -2) return { label: `${diff}`, color: '#7c3aed', bg: '#ede9fe' }; // Eagle+
  if (diff === -1) return { label: '-1', color: '#1a7f4b', bg: '#dcfce7' };      // Birdie
  if (diff === 0)  return { label: 'PAR', color: '#374151', bg: '#f3f4f6' };    // Par
  if (diff === 1)  return { label: '+1', color: '#d97706', bg: '#fef3c7' };     // Bogey
  if (diff === 2)  return { label: '+2', color: '#dc2626', bg: '#fee2e2' };     // Double
  return { label: `+${diff}`, color: '#7f1d1d', bg: '#fca5a5' };               // Triple+
}

function ScorePill({ strokes, par }: { strokes: number | null; par: number }) {
  const { label, color, bg } = strokeLabel(strokes, par);
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Summary Card ──────────────────────────────────────────────────────────

function SummaryCard({
  scoreCard,
  onSave,
  onShare,
  saving,
}: {
  scoreCard: HoleScore[];
  onSave: () => void;
  onShare: () => void;
  saving: boolean;
}) {
  const total = scoreCard.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
  const totalPar = scoreCard.reduce((sum, h) => sum + h.par, 0);
  const diff = total - totalPar;
  const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  const diffColor = diff < 0 ? '#1a7f4b' : diff === 0 ? '#374151' : '#dc2626';

  const eagles = scoreCard.filter((h) => h.strokes != null && h.strokes <= h.par - 2).length;
  const birdies = scoreCard.filter((h) => h.strokes != null && h.strokes === h.par - 1).length;
  const pars    = scoreCard.filter((h) => h.strokes === h.par).length;
  const bogeys  = scoreCard.filter((h) => h.strokes != null && h.strokes === h.par + 1).length;
  const doubles = scoreCard.filter((h) => h.strokes != null && h.strokes >= h.par + 2).length;

  return (
    <ScrollView contentContainerStyle={s.summaryWrap}>
      <Text style={s.summaryTitle}>Round Complete 🏁</Text>

      {/* Score banner */}
      <View style={s.scoreBanner}>
        <Text style={s.scoreTotal}>{total}</Text>
        <Text style={[s.scoreDiff, { color: diffColor }]}>{diffStr}</Text>
        <Text style={s.scorePar}>Par {totalPar}</Text>
      </View>

      {/* Breakdown */}
      <View style={s.breakdown}>
        {[
          { label: 'Eagle+', count: eagles,  color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Birdie', count: birdies, color: '#1a7f4b', bg: '#dcfce7' },
          { label: 'Par',    count: pars,    color: '#374151', bg: '#f3f4f6' },
          { label: 'Bogey',  count: bogeys,  color: '#d97706', bg: '#fef3c7' },
          { label: 'Double+',count: doubles, color: '#dc2626', bg: '#fee2e2' },
        ].map(({ label, count, color, bg }) => (
          <View key={label} style={[s.breakdownChip, { backgroundColor: bg }]}>
            <Text style={[s.breakdownCount, { color }]}>{count}</Text>
            <Text style={[s.breakdownLabel, { color }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Hole-by-hole grid */}
      <View style={s.cardGrid}>
        {scoreCard.map((h) => {
          const { color, bg } = strokeLabel(h.strokes, h.par);
          return (
            <View key={h.hole} style={[s.cardCell, { backgroundColor: bg }]}>
              <Text style={s.cardHole}>{h.hole}</Text>
              <Text style={[s.cardStroke, { color }]}>{h.strokes ?? '—'}</Text>
              <Text style={s.cardPar}>P{h.par}</Text>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View style={s.actionRow}>
        <TouchableOpacity style={s.shareBtn} onPress={onShare}>
          <Text style={s.shareBtnText}>Share 📤</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={onSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>Save Round</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function ScoreEntryScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ courseId?: string; holes?: string }>();

  const holeCount = params.holes === '9' ? 9 : 18;
  const pars = holeCount === 9 ? DEFAULT_PARS_9 : DEFAULT_PARS_18;

  const [scoreCard, setScoreCard] = useState<HoleScore[]>(
    pars.map((par, i) => ({ hole: i + 1, par, strokes: null }))
  );
  const [currentHole, setCurrentHole] = useState(0); // 0-indexed
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const current = scoreCard[currentHole];

  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    callback();
  };

  const setStrokes = (n: number) => {
    setScoreCard((prev) => {
      const next = [...prev];
      next[currentHole] = { ...next[currentHole], strokes: Math.max(1, n) };
      return next;
    });
  };

  const increment = () => setStrokes((current.strokes ?? current.par) + 1);
  const decrement = () => setStrokes((current.strokes ?? current.par) - 1);

  const goNext = () => {
    if (current.strokes == null) {
      Alert.alert('Enter score', 'Please enter your score for this hole before continuing.');
      return;
    }
    if (currentHole < holeCount - 1) {
      animateTransition(() => setCurrentHole((h) => h + 1));
    } else {
      setDone(true);
    }
  };

  const goPrev = () => {
    if (currentHole > 0) animateTransition(() => setCurrentHole((h) => h - 1));
  };

  const saveRound = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const total = scoreCard.reduce((s, h) => s + (h.strokes ?? 0), 0);
      const res = await fetch(`${API_URL}/v1/scorecards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          courseId: params.courseId ?? null,
          holeScores: scoreCard,
          totalStrokes: total,
          playedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      router.replace('/(tabs)/compete');
    } catch {
      Alert.alert('Error', 'Could not save your round. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const shareRound = () => {
    Alert.alert('Share', 'Sharing to your social feed coming soon!');
  };

  if (done) {
    return (
      <SummaryCard
        scoreCard={scoreCard}
        onSave={saveRound}
        onShare={shareRound}
        saving={saving}
      />
    );
  }

  const progress = ((currentHole) / holeCount) * 100;

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.backBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Score Entry</Text>
        <Text style={s.headerSub}>
          {currentHole + 1} / {holeCount}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progress}%` as `${number}%` }]} />
      </View>

      {/* Scorecard mini-strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.strip}
        contentContainerStyle={s.stripContent}
      >
        {scoreCard.map((h, i) => {
          const isActive = i === currentHole;
          const { color, bg } = strokeLabel(h.strokes, h.par);
          return (
            <TouchableOpacity
              key={h.hole}
              style={[
                s.stripCell,
                { backgroundColor: isActive ? PRIMARY : bg },
                isActive && { transform: [{ scale: 1.1 }] },
              ]}
              onPress={() => animateTransition(() => setCurrentHole(i))}
            >
              <Text style={[s.stripHole, { color: isActive ? '#fff' : '#9ca3af' }]}>
                {h.hole}
              </Text>
              <Text style={[s.stripScore, { color: isActive ? '#fff' : color }]}>
                {h.strokes ?? '·'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Hole entry card */}
      <Animated.View style={[s.card, { opacity: fadeAnim }]}>
        <View style={s.holeInfo}>
          <View style={s.holeBadge}>
            <Text style={s.holeBadgeLabel}>HOLE</Text>
            <Text style={s.holeBadgeNum}>{current.hole}</Text>
          </View>
          <View style={s.parBadge}>
            <Text style={s.parBadgeLabel}>PAR</Text>
            <Text style={s.parBadgeNum}>{current.par}</Text>
          </View>
        </View>

        {/* Stroke counter */}
        <View style={s.counter}>
          <TouchableOpacity
            style={[s.counterBtn, s.counterBtnMinus]}
            onPress={decrement}
            disabled={(current.strokes ?? current.par) <= 1}
          >
            <Text style={s.counterBtnText}>−</Text>
          </TouchableOpacity>

          <View style={s.counterDisplay}>
            <Text style={s.counterValue}>{current.strokes ?? '—'}</Text>
            {current.strokes != null && (
              <ScorePill strokes={current.strokes} par={current.par} />
            )}
          </View>

          <TouchableOpacity style={[s.counterBtn, s.counterBtnPlus]} onPress={increment}>
            <Text style={s.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Quick-tap pars */}
        <View style={s.quickTap}>
          {[current.par - 2, current.par - 1, current.par, current.par + 1, current.par + 2].map((n) => (
            n > 0 && (
              <TouchableOpacity
                key={n}
                style={[
                  s.quickBtn,
                  current.strokes === n && { backgroundColor: PRIMARY, borderColor: PRIMARY },
                ]}
                onPress={() => setStrokes(n)}
              >
                <Text
                  style={[
                    s.quickBtnText,
                    current.strokes === n && { color: '#fff' },
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            )
          ))}
        </View>
      </Animated.View>

      {/* Navigation */}
      <View style={s.nav}>
        <TouchableOpacity
          style={[s.navBtn, currentHole === 0 && s.navBtnDisabled]}
          onPress={goPrev}
          disabled={currentHole === 0}
        >
          <Text style={[s.navBtnText, currentHole === 0 && { color: '#d1d5db' }]}>← Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navBtnPrimary} onPress={goNext}>
          <Text style={s.navBtnPrimaryText}>
            {currentHole < holeCount - 1 ? 'Next →' : 'Finish 🏁'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { fontSize: 18, color: '#6b7280', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  headerSub: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },

  progressTrack: { height: 4, backgroundColor: '#e5e7eb' },
  progressFill: { height: 4, backgroundColor: PRIMARY },

  // Scorecard strip
  strip: { maxHeight: 70, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  stripContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 6, flexDirection: 'row' },
  stripCell: {
    width: 38,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  stripHole: { fontSize: 9, fontWeight: '700', color: '#9ca3af' },
  stripScore: { fontSize: 15, fontWeight: '800', color: '#111' },

  // Hole card
  card: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 3,
    alignItems: 'center',
  },
  holeInfo: { flexDirection: 'row', gap: 20, marginBottom: 28 },
  holeBadge: {
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  holeBadgeLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  holeBadgeNum: { fontSize: 28, fontWeight: '900', color: '#fff' },
  parBadge: {
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  parBadgeLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', letterSpacing: 1 },
  parBadgeNum: { fontSize: 28, fontWeight: '900', color: '#374151' },

  // Counter
  counter: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 24 },
  counterBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnMinus: { backgroundColor: '#fee2e2' },
  counterBtnPlus: { backgroundColor: '#dcfce7' },
  counterBtnText: { fontSize: 28, fontWeight: '700' },
  counterDisplay: { alignItems: 'center', minWidth: 80 },
  counterValue: { fontSize: 56, fontWeight: '900', color: '#111', lineHeight: 60 },

  // Score pill
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 4 },
  pillText: { fontSize: 13, fontWeight: '700' },

  // Quick-tap
  quickTap: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnText: { fontSize: 16, fontWeight: '700', color: '#374151' },

  // Nav
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  navBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: PRIMARY,
  },
  navBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Summary
  summaryWrap: { padding: 24, paddingBottom: 48, backgroundColor: '#f9fafb' },
  summaryTitle: { fontSize: 24, fontWeight: '800', color: '#111', textAlign: 'center', marginTop: 32, marginBottom: 20 },
  scoreBanner: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  scoreTotal: { fontSize: 64, fontWeight: '900', color: '#111', lineHeight: 68 },
  scoreDiff: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  scorePar: { fontSize: 15, color: '#9ca3af', marginTop: 4 },
  breakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  breakdownChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  breakdownCount: { fontSize: 20, fontWeight: '900' },
  breakdownLabel: { fontSize: 11, fontWeight: '600' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 24 },
  cardCell: { width: 46, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  cardHole: { fontSize: 9, color: '#9ca3af', fontWeight: '600' },
  cardStroke: { fontSize: 18, fontWeight: '800' },
  cardPar: { fontSize: 9, color: '#9ca3af' },
  actionRow: { flexDirection: 'row', gap: 12 },
  shareBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: PRIMARY,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
