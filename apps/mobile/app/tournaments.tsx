/**
 * Tournaments Screen
 *
 * Shows:
 *   - List of upcoming / active / completed tournaments
 *   - Opt-in flow per tournament
 *   - Live leaderboard for active tournaments
 *   - Tournament results card
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import type { Tournament, TournamentLeaderboardEntry } from '@par-tee/shared';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1a7f4b';

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

function formatDate(d: Date | string | null): string {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  onWithdraw,
  actionLoading,
}: {
  t: Tournament;
  onPress: () => void;
  onOptIn: (id: string) => void;
  onWithdraw: (id: string) => void;
  actionLoading: boolean;
}) {
  const status = statusLabel(t.status);

  return (
    <TouchableOpacity style={tc.card} onPress={onPress} activeOpacity={0.85}>
      {/* Status banner */}
      <View style={[tc.statusBar, { backgroundColor: status.bg }]}>
        <Text style={[tc.statusText, { color: status.color }]}>{status.label}</Text>
        {t.status === 'live' && <View style={tc.liveDot} />}
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
              <Text style={[tc.entryValue, { color: PRIMARY }]}>
                {formatCents(t.prizePoolInCents)}
              </Text>
            </View>
          )}
          <View>
            <Text style={tc.entryLabel}>Entrants</Text>
            <Text style={tc.entryValue}>{t.currentEntrants}/{t.maxEntrants}</Text>
          </View>

          {(t.status === 'registration' || t.status === 'upcoming') && !t.isOptedIn && (
            <TouchableOpacity
              style={tc.optInBtn}
              onPress={() => onOptIn(t.id)}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={tc.optInBtnText}>Enter</Text>
              }
            </TouchableOpacity>
          )}
          {t.isOptedIn && (t.status === 'registration' || t.status === 'upcoming') && (
            <TouchableOpacity
              style={tc.withdrawBtn}
              onPress={() => onWithdraw(t.id)}
              disabled={actionLoading}
            >
              <Text style={tc.withdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          )}
          {t.isOptedIn && t.status === 'live' && (
            <View style={tc.enteredBadge}>
              <Text style={tc.enteredBadgeText}>✓ Playing</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Leaderboard Sheet ──────────────────────────────────────────────────────

function TournamentDetail({
  tournamentId,
  token,
  myUserId,
}: {
  tournamentId: string;
  token: string;
  myUserId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<(Tournament & { leaderboard: TournamentLeaderboardEntry[]; currentEntrants: number }) | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/tournaments/${tournamentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const { data } = await res.json(); setDetail(data); }
    } finally {
      setLoading(false);
    }
  }, [tournamentId, token]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  if (loading) return <ActivityIndicator color={PRIMARY} style={{ marginTop: 48 }} />;
  if (!detail) return <Text style={{ textAlign: 'center', marginTop: 48, color: '#9ca3af' }}>Tournament not found.</Text>;

  const entries = detail.leaderboard ?? [];
  const status = statusLabel(detail.status);

  return (
    <View style={ll.wrap}>
      <View style={ll.header}>
        <Text style={ll.headerTitle}>{detail.name}</Text>
        <Text style={ll.headerSub}>{detail.courseName} · {formatLabel(detail.format)}</Text>
        <View style={[ll.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[ll.statusBadgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {entries.length === 0 ? (
        <Text style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>No scores submitted yet.</Text>
      ) : (
        <>
          <View style={ll.tableHeader}>
            <Text style={[ll.th, { width: 32 }]}>#</Text>
            <Text style={[ll.th, { flex: 1 }]}>Player</Text>
            <Text style={[ll.th, { width: 40, textAlign: 'center' }]}>R1</Text>
            <Text style={[ll.th, { width: 40, textAlign: 'center' }]}>R2</Text>
            <Text style={[ll.th, { width: 48, textAlign: 'right' }]}>Total</Text>
            <Text style={[ll.th, { width: 40, textAlign: 'right' }]}>+/-</Text>
          </View>

          {entries.map((e) => {
            const isMe = e.userId === myUserId;
            const diffColor = e.scoreToPar < 0 ? PRIMARY : e.scoreToPar === 0 ? '#374151' : '#dc2626';
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
                <Text style={[ll.diff, { color: diffColor }]}>{scoreDiffStr(e.scoreToPar)}</Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'live' | 'registration' | 'upcoming' | 'completed';

export default function TournamentsScreen() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const myUserId = session?.user?.id ?? null;

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const statusQuery: Record<FilterStatus, string> = {
    all: 'upcoming,registration,live,completed',
    live: 'live',
    registration: 'registration',
    upcoming: 'upcoming',
    completed: 'completed',
  };

  const fetchTournaments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/tournaments?status=${statusQuery[filter]}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const { data } = await res.json(); setTournaments(data ?? []); }
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTournaments();
    setRefreshing(false);
  }, [fetchTournaments]);

  const handleOptIn = async (id: string) => {
    const t = tournaments.find((x) => x.id === id);
    Alert.alert(
      'Enter Tournament',
      `Confirm your entry for "${t?.name ?? 'this tournament'}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Entry',
          onPress: async () => {
            setActionLoading(id);
            try {
              const res = await fetch(`${API_URL}/v1/tournaments/${id}/enter`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                setTournaments((prev) =>
                  prev.map((x) => x.id === id ? { ...x, isOptedIn: true, currentEntrants: x.currentEntrants + 1 } : x)
                );
              } else {
                const body = await res.json();
                Alert.alert('Error', body?.error?.message ?? 'Could not enter tournament.');
              }
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleWithdraw = async (id: string) => {
    const t = tournaments.find((x) => x.id === id);
    Alert.alert(
      'Withdraw',
      `Remove yourself from "${t?.name ?? 'this tournament'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(id);
            try {
              const res = await fetch(`${API_URL}/v1/tournaments/${id}/enter`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                setTournaments((prev) =>
                  prev.map((x) => x.id === id ? { ...x, isOptedIn: false, currentEntrants: Math.max(0, x.currentEntrants - 1) } : x)
                );
              }
            } finally {
              setActionLoading(null);
            }
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
          <Text style={ts.headerTitle} numberOfLines={1}>
            {tournaments.find((t) => t.id === selected)?.name ?? 'Tournament'}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <TournamentDetail tournamentId={selected} token={token} myUserId={myUserId} />
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

      <ScrollView
        contentContainerStyle={ts.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 48 }} />
        ) : tournaments.length === 0 ? (
          <View style={ts.empty}>
            <Text style={ts.emptyIcon}>🎖️</Text>
            <Text style={ts.emptyText}>No tournaments here yet.</Text>
          </View>
        ) : (
          tournaments.map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              onPress={() => setSelected(t.id)}
              onOptIn={handleOptIn}
              onWithdraw={handleWithdraw}
              actionLoading={actionLoading === t.id}
            />
          ))
        )}
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
  withdrawBtn: {
    marginLeft: 'auto',
    borderColor: '#e5e7eb',
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  withdrawBtnText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
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
