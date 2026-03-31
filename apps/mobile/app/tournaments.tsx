/**
 * Tournaments Screen
 *
 * Shows:
 *   - List of upcoming / active / completed tournaments
 *   - Opt-in flow per tournament
 *   - Live leaderboard for active tournaments
 *   - Tournament results card
 */
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import type { Tournament, TournamentLeaderboardEntry } from '@teezy/shared/types';

const PRIMARY = '#1a7f4b';

// ─── Mock data ─────────────────────────────────────────────────────────────

const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: 't1',
    name: 'Spring Classic Open',
    courseId: 'c1',
    courseName: 'Pebble Creek Golf Club',
    format: 'stroke_play',
    status: 'live',
    startDate: new Date('2026-03-29'),
    endDate: new Date('2026-03-31'),
    maxEntrants: 64,
    currentEntrants: 51,
    entryFeeInCents: 0,
    prizePoolInCents: 50000,
    isOptedIn: true,
    createdAt: new Date(),
  },
  {
    id: 't2',
    name: 'Weekend Warrior Cup',
    courseId: 'c2',
    courseName: 'Lakeside Links',
    format: 'stableford',
    status: 'registration',
    startDate: new Date('2026-04-05'),
    endDate: new Date('2026-04-06'),
    maxEntrants: 32,
    currentEntrants: 18,
    entryFeeInCents: 1000,
    prizePoolInCents: 20000,
    isOptedIn: false,
    createdAt: new Date(),
  },
  {
    id: 't3',
    name: 'Club Championship',
    courseId: 'c3',
    courseName: 'Highland Golf Course',
    format: 'match_play',
    status: 'upcoming',
    startDate: new Date('2026-04-19'),
    endDate: new Date('2026-04-20'),
    maxEntrants: 16,
    currentEntrants: 4,
    entryFeeInCents: 0,
    prizePoolInCents: 0,
    isOptedIn: false,
    createdAt: new Date(),
  },
  {
    id: 't4',
    name: 'March Madness Golf',
    courseId: 'c4',
    courseName: 'Fairway Hills',
    format: 'stroke_play',
    status: 'completed',
    startDate: new Date('2026-03-15'),
    endDate: new Date('2026-03-16'),
    maxEntrants: 32,
    currentEntrants: 30,
    entryFeeInCents: 500,
    prizePoolInCents: 15000,
    isOptedIn: true,
    createdAt: new Date(),
  },
];

const MOCK_LEADERBOARD: TournamentLeaderboardEntry[] = [
  { rank: 1,  userId: 'u1', userName: 'Jordan T.',  avatarUrl: null, totalScore: 139, holesCompleted: 36, scoreToPar: -5,  roundScores: [70, 69] },
  { rank: 2,  userId: 'u2', userName: 'Riley C.',   avatarUrl: null, totalScore: 141, holesCompleted: 36, scoreToPar: -3,  roundScores: [71, 70] },
  { rank: 3,  userId: 'me', userName: 'You',        avatarUrl: null, totalScore: 143, holesCompleted: 27, scoreToPar: -1,  roundScores: [73, 70] },
  { rank: 4,  userId: 'u4', userName: 'Alex P.',    avatarUrl: null, totalScore: 144, holesCompleted: 36, scoreToPar: 0,   roundScores: [72, 72] },
  { rank: 5,  userId: 'u5', userName: 'Casey L.',   avatarUrl: null, totalScore: 146, holesCompleted: 36, scoreToPar: 2,   roundScores: [74, 72] },
  { rank: 6,  userId: 'u6', userName: 'Morgan K.',  avatarUrl: null, totalScore: 148, holesCompleted: 36, scoreToPar: 4,   roundScores: [75, 73] },
  { rank: 7,  userId: 'u7', userName: 'Drew F.',    avatarUrl: null, totalScore: 150, holesCompleted: 36, scoreToPar: 6,   roundScores: [76, 74] },
  { rank: 8,  userId: 'u8', userName: 'Quinn B.',   avatarUrl: null, totalScore: 153, holesCompleted: 36, scoreToPar: 9,   roundScores: [77, 76] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusLabel(status: Tournament['status']): { label: string; color: string; bg: string } {
  switch (status) {
    case 'live':         return { label: '🔴 Live',         color: '#991b1b', bg: '#fee2e2' };
    case 'registration': return { label: '📋 Registering',  color: '#92400e', bg: '#fef3c7' };
    case 'upcoming':     return { label: '📅 Upcoming',     color: '#1e40af', bg: '#dbeafe' };
    case 'completed':    return { label: '✓ Completed',     color: '#374151', bg: '#f3f4f6' };
  }
}

function formatLabel(format: Tournament['format']): string {
  switch (format) {
    case 'stroke_play': return 'Stroke Play';
    case 'match_play':  return 'Match Play';
    case 'stableford':  return 'Stableford';
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCents(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

function scoreDiffStr(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

// ─── Tournament Card ────────────────────────────────────────────────────────

function TournamentCard({
  t,
  onPress,
  onOptIn,
}: {
  t: Tournament;
  onPress: () => void;
  onOptIn: (id: string) => void;
}) {
  const status = statusLabel(t.status);
  const spotsLeft = t.maxEntrants - t.currentEntrants;

  return (
    <TouchableOpacity style={tc.card} onPress={onPress} activeOpacity={0.85}>
      {/* Status banner */}
      <View style={[tc.statusBar, { backgroundColor: status.bg }]}>
        <Text style={[tc.statusText, { color: status.color }]}>{status.label}</Text>
        {t.status === 'live' && (
          <View style={tc.liveDot} />
        )}
      </View>

      <View style={tc.body}>
        <Text style={tc.name}>{t.name}</Text>
        <Text style={tc.course}>📍 {t.courseName}</Text>

        <View style={tc.meta}>
          <View style={tc.metaChip}>
            <Text style={tc.metaText}>{formatLabel(t.format)}</Text>
          </View>
          <View style={tc.metaChip}>
            <Text style={tc.metaText}>
              {formatDate(t.startDate)}
              {t.endDate ? ` – ${formatDate(t.endDate)}` : ''}
            </Text>
          </View>
        </View>

        <View style={tc.footer}>
          <View>
            <Text style={tc.entryLabel}>Entry</Text>
            <Text style={tc.entryValue}>{formatCents(t.entryFeeInCents)}</Text>
          </View>
          {t.prizePoolInCents > 0 && (
            <View>
              <Text style={tc.entryLabel}>Prize Pool</Text>
              <Text style={[tc.entryValue, { color: '#1a7f4b' }]}>
                {formatCents(t.prizePoolInCents)}
              </Text>
            </View>
          )}
          <View>
            <Text style={tc.entryLabel}>Entrants</Text>
            <Text style={tc.entryValue}>
              {t.currentEntrants}/{t.maxEntrants}
            </Text>
          </View>

          {(t.status === 'registration' || t.status === 'upcoming') && !t.isOptedIn && (
            <TouchableOpacity
              style={tc.optInBtn}
              onPress={() => onOptIn(t.id)}
            >
              <Text style={tc.optInBtnText}>Enter</Text>
            </TouchableOpacity>
          )}
          {t.isOptedIn && t.status !== 'completed' && (
            <View style={tc.enteredBadge}>
              <Text style={tc.enteredBadgeText}>✓ Entered</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Leaderboard Sheet ──────────────────────────────────────────────────────

function LiveLeaderboard({ tournament }: { tournament: Tournament }) {
  const entries = MOCK_LEADERBOARD;
  const total = tournament.roundScores?.length ?? 2;

  return (
    <View style={ll.wrap}>
      <View style={ll.header}>
        <Text style={ll.headerTitle}>{tournament.name}</Text>
        <Text style={ll.headerSub}>{tournament.courseName} · {formatLabel(tournament.format)}</Text>
        <View style={[ll.statusBadge, { backgroundColor: statusLabel(tournament.status).bg }]}>
          <Text style={[ll.statusBadgeText, { color: statusLabel(tournament.status).color }]}>
            {statusLabel(tournament.status).label}
          </Text>
        </View>
      </View>

      <View style={ll.tableHeader}>
        <Text style={[ll.th, { width: 32 }]}>#</Text>
        <Text style={[ll.th, { flex: 1 }]}>Player</Text>
        <Text style={[ll.th, { width: 40, textAlign: 'center' }]}>R1</Text>
        <Text style={[ll.th, { width: 40, textAlign: 'center' }]}>R2</Text>
        <Text style={[ll.th, { width: 48, textAlign: 'right' }]}>Total</Text>
        <Text style={[ll.th, { width: 40, textAlign: 'right' }]}>+/-</Text>
      </View>

      {entries.map((e) => {
        const isMe = e.userId === 'me';
        const diffColor = e.scoreToPar < 0 ? '#1a7f4b' : e.scoreToPar === 0 ? '#374151' : '#dc2626';
        return (
          <View key={e.userId} style={[ll.row, isMe && ll.rowMe]}>
            <Text style={[ll.rank, isMe && { color: PRIMARY }]}>
              {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}
            </Text>
            <Text style={[ll.name, isMe && { color: PRIMARY, fontWeight: '800' }]} numberOfLines={1}>
              {e.userName}
            </Text>
            <Text style={ll.r1}>{e.roundScores[0] ?? '—'}</Text>
            <Text style={ll.r2}>{e.roundScores[1] ?? '—'}</Text>
            <Text style={[ll.total, isMe && { color: PRIMARY }]}>{e.totalScore}</Text>
            <Text style={[ll.diff, { color: diffColor }]}>
              {scoreDiffStr(e.scoreToPar)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Results Card ────────────────────────────────────────────────────────────

function ResultsCard({ tournament }: { tournament: Tournament }) {
  const winner = MOCK_LEADERBOARD[0];
  const myEntry = MOCK_LEADERBOARD.find((e) => e.userId === 'me');

  return (
    <View style={rc.wrap}>
      <View style={rc.trophy}>
        <Text style={{ fontSize: 52 }}>🏆</Text>
        <Text style={rc.trophyName}>{tournament.name}</Text>
        <Text style={rc.trophySub}>Final Results</Text>
      </View>

      <View style={rc.winnerCard}>
        <Text style={rc.winnerLabel}>Winner</Text>
        <Text style={rc.winnerName}>{winner.userName}</Text>
        <Text style={rc.winnerScore}>
          {winner.totalScore} ({scoreDiffStr(winner.scoreToPar)})
        </Text>
      </View>

      {myEntry && (
        <View style={rc.myResult}>
          <Text style={rc.myResultLabel}>Your Result</Text>
          <Text style={rc.myResultRank}>#{myEntry.rank}</Text>
          <Text style={rc.myResultScore}>
            {myEntry.totalScore} ({scoreDiffStr(myEntry.scoreToPar)})
          </Text>
        </View>
      )}

      <LiveLeaderboard tournament={tournament} />
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'live' | 'registration' | 'upcoming' | 'completed';

export default function TournamentsScreen() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>(MOCK_TOURNAMENTS);

  const filtered = filter === 'all'
    ? tournaments
    : tournaments.filter((t) => t.status === filter);

  const handleOptIn = (id: string) => {
    Alert.alert(
      'Enter Tournament',
      'Confirm your entry. You\'ll be notified when the tournament begins.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Entry',
          onPress: () => {
            setTournaments((prev) =>
              prev.map((t) => t.id === id ? { ...t, isOptedIn: true, currentEntrants: t.currentEntrants + 1 } : t)
            );
          },
        },
      ]
    );
  };

  if (selected) {
    return (
      <View style={ts.screen}>
        <View style={ts.header}>
          <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={ts.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={ts.headerTitle} numberOfLines={1}>{selected.name}</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {selected.status === 'completed'
            ? <ResultsCard tournament={selected} />
            : <LiveLeaderboard tournament={selected} />
          }
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={ts.screen}>
      <View style={ts.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={ts.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={ts.headerTitle}>Tournaments</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Filter strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ts.filterBar}
        contentContainerStyle={ts.filterContent}
      >
        {[
          { id: 'all'          as const, label: 'All' },
          { id: 'live'         as const, label: '🔴 Live' },
          { id: 'registration' as const, label: '📋 Open' },
          { id: 'upcoming'     as const, label: '📅 Upcoming' },
          { id: 'completed'    as const, label: '✓ Done' },
        ].map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[ts.filterChip, filter === f.id && ts.filterChipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[ts.filterChipText, filter === f.id && ts.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={ts.list}>
        {filtered.length === 0 && (
          <View style={ts.empty}>
            <Text style={ts.emptyIcon}>🎖️</Text>
            <Text style={ts.emptyText}>No tournaments here yet.</Text>
          </View>
        )}
        {filtered.map((t) => (
          <TournamentCard
            key={t.id}
            t={t}
            onPress={() => setSelected(t)}
            onOptIn={handleOptIn}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const tc = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  statusBar: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  body: { padding: 16 },
  name: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 4 },
  course: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  meta: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metaChip: { backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  metaText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  entryLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' },
  entryValue: { fontSize: 15, fontWeight: '800', color: '#111' },
  optInBtn: {
    marginLeft: 'auto',
    backgroundColor: PRIMARY,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
  },
  optInBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  enteredBadge: {
    marginLeft: 'auto',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  enteredBadgeText: { color: '#14532d', fontSize: 13, fontWeight: '700' },
});

const ll = StyleSheet.create({
  wrap: { margin: 16, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  headerSub: { fontSize: 12, color: '#9ca3af', marginTop: 2, marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 4,
  },
  th: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    gap: 4,
  },
  rowMe: { backgroundColor: '#f0fdf4' },
  rank: { width: 32, fontSize: 13, fontWeight: '700', color: '#6b7280' },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111' },
  r1: { width: 40, fontSize: 13, color: '#6b7280', textAlign: 'center' },
  r2: { width: 40, fontSize: 13, color: '#6b7280', textAlign: 'center' },
  total: { width: 48, fontSize: 14, fontWeight: '800', color: '#111', textAlign: 'right' },
  diff: { width: 40, fontSize: 14, fontWeight: '700', textAlign: 'right' },
});

const rc = StyleSheet.create({
  wrap: { padding: 16 },
  trophy: { alignItems: 'center', paddingVertical: 24 },
  trophyName: { fontSize: 20, fontWeight: '800', color: '#111', marginTop: 8 },
  trophySub: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  winnerCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
  },
  winnerLabel: { fontSize: 11, fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  winnerName: { fontSize: 22, fontWeight: '800', color: '#111' },
  winnerScore: { fontSize: 16, color: '#6b7280', marginTop: 4 },
  myResult: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  myResultLabel: { fontSize: 11, fontWeight: '700', color: '#14532d', textTransform: 'uppercase', letterSpacing: 1 },
  myResultRank: { fontSize: 28, fontWeight: '900', color: PRIMARY, marginVertical: 4 },
  myResultScore: { fontSize: 14, color: '#6b7280' },
});

const ts = StyleSheet.create({
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
  backBtn: { fontSize: 15, color: PRIMARY, fontWeight: '600', width: 60 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  filterBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', maxHeight: 54 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  filterChipActive: { backgroundColor: PRIMARY },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#fff' },
  list: { paddingTop: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 64 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9ca3af' },
});
