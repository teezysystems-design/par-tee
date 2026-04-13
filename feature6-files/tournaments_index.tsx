/**
 * Tournaments Screen — Feature 6
 *
 * Browse open/live tournaments, enter, and view live leaderboard.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { router } from 'expo-router';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  courseId: string;
  courseName: string | null;
  courseAddress: string | null;
  format: string;
  status: string;
  startDate: string;
  endDate: string;
  maxEntrants: number;
  currentEntrants: number;
  createdAt: string;
}

interface LeaderboardEntry {
  position: number;
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  totalStrokes: number | null;
  scoreToPar: number | null;
  holesCompleted: number;
  completedAt: string | null;
}

interface TournamentDetail extends Tournament {
  holeCount: number;
  parScore: number;
  createdByUserId: string;
}

interface EntryCheck {
  entered: boolean;
  scoreSubmitted: boolean;
  totalStrokes: number | null;
  scoreToPar: number | null;
  holesCompleted: number;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{(name ?? '?')[0].toUpperCase()}</Text>
    </View>
  );
}

// ─── Score formatter ─────────────────────────────────────────────────────────

function formatScore(scoreToPar: number | null): string {
  if (scoreToPar == null) return '—';
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}

function scoreColor(scoreToPar: number | null): string {
  if (scoreToPar == null) return '#9ca3af';
  if (scoreToPar < 0) return '#dc2626';
  if (scoreToPar === 0) return PRIMARY;
  return '#111';
}

// ─── Date formatter ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Tournament Card ─────────────────────────────────────────────────────────

function TournamentCard({ tournament, onPress }: { tournament: Tournament; onPress: () => void }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    open: { bg: '#dcfce7', text: '#16a34a' },
    live: { bg: '#fef3c7', text: '#d97706' },
    completed: { bg: '#f3f4f6', text: '#6b7280' },
  };
  const sc = statusColors[tournament.status] ?? statusColors.open;
  const spotsLeft = tournament.maxEntrants - tournament.currentEntrants;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.7}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{tournament.name}</Text>
          <View style={s.cardMeta}>
            <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[s.statusBadgeText, { color: sc.text }]}>
                {tournament.status === 'live' ? '🔴 LIVE' : tournament.status}
              </Text>
            </View>
            <View style={s.formatBadge}>
              <Text style={s.formatBadgeText}>{tournament.format.replace(/_/g, ' ')}</Text>
            </View>
          </View>
        </View>
        <View style={s.entrantCount}>
          <Text style={s.entrantNum}>{tournament.currentEntrants}/{tournament.maxEntrants}</Text>
          <Text style={s.entrantLabel}>entered</Text>
        </View>
      </View>

      {tournament.courseName && (
        <Text style={s.courseName}>⛳ {tournament.courseName}</Text>
      )}

      <View style={s.cardFooter}>
        <Text style={s.dateRange}>
          {formatDate(tournament.startDate)} — {formatDate(tournament.endDate)}
        </Text>
        {tournament.status === 'open' && spotsLeft > 0 && spotsLeft <= 5 && (
          <Text style={s.spotsLeft}>{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left!</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Tournament Detail + Leaderboard ─────────────────────────────────────────

function TournamentDetailView({
  tournamentId,
  onBack,
}: {
  tournamentId: string;
  onBack: () => void;
}) {
  const { session } = useAuth();
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [entryCheck, setEntryCheck] = useState<EntryCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const [detailRes, lbRes, entryRes] = await Promise.all([
        fetch(`${API_URL}/v1/tournaments/${tournamentId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_URL}/v1/tournaments/${tournamentId}/leaderboard`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_URL}/v1/tournaments/${tournamentId}/check-entry`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (detailRes.ok) {
        const json = await detailRes.json();
        setDetail(json.data);
      }
      if (lbRes.ok) {
        const json = await lbRes.json();
        setLeaderboard(json.data ?? []);
      }
      if (entryRes.ok) {
        const json = await entryRes.json();
        setEntryCheck(json.data);
      }
    } catch {} finally { setLoading(false); }
  }, [session, tournamentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEnter = async () => {
    if (!session) return;
    setEntering(true);
    try {
      const res = await fetch(`${API_URL}/v1/tournaments/${tournamentId}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (res.ok) {
        Alert.alert('Entered!', `You're in the ${detail?.name ?? 'tournament'}. Good luck!`);
        fetchData();
      } else {
        Alert.alert('Error', json.error?.message ?? 'Could not enter');
      }
    } catch { Alert.alert('Error', 'Failed to enter tournament'); } finally { setEntering(false); }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>;
  if (!detail) return <View style={s.centered}><Text>Tournament not found</Text></View>;

  const spotsLeft = detail.maxEntrants - detail.currentEntrants;
  const canEnter = ['open', 'live'].includes(detail.status) && !entryCheck?.entered && spotsLeft > 0;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={td.header}>
        <TouchableOpacity onPress={onBack}><Text style={td.back}>← Back</Text></TouchableOpacity>
        <Text style={td.title}>{detail.name}</Text>
      </View>

      {/* Info card */}
      <View style={td.infoCard}>
        <View style={td.infoRow}>
          <Text style={td.infoLabel}>Course</Text>
          <Text style={td.infoValue}>{detail.courseName ?? 'TBA'}</Text>
        </View>
        <View style={td.infoRow}>
          <Text style={td.infoLabel}>Format</Text>
          <Text style={td.infoValue}>{detail.format.replace(/_/g, ' ')}</Text>
        </View>
        <View style={td.infoRow}>
          <Text style={td.infoLabel}>Holes / Par</Text>
          <Text style={td.infoValue}>{detail.holeCount} holes · Par {detail.parScore}</Text>
        </View>
        <View style={td.infoRow}>
          <Text style={td.infoLabel}>Dates</Text>
          <Text style={td.infoValue}>{formatDate(detail.startDate)} — {formatDate(detail.endDate)}</Text>
        </View>
        <View style={[td.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={td.infoLabel}>Entrants</Text>
          <Text style={td.infoValue}>{detail.currentEntrants} / {detail.maxEntrants}</Text>
        </View>

        {detail.description && (
          <Text style={td.description}>{detail.description}</Text>
        )}
      </View>

      {/* Entry / Status bar */}
      <View style={td.entrySection}>
        {canEnter ? (
          <TouchableOpacity style={td.enterBtn} onPress={handleEnter} disabled={entering} activeOpacity={0.8}>
            {entering
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={td.enterBtnText}>Enter Tournament</Text>
            }
          </TouchableOpacity>
        ) : entryCheck?.entered ? (
          <View style={td.enteredBadge}>
            <Text style={td.enteredText}>
              {entryCheck.scoreSubmitted
                ? `✅ Score submitted · ${formatScore(entryCheck.scoreToPar)} (${entryCheck.totalStrokes} strokes)`
                : '✅ You're entered — play your round to submit a score'}
            </Text>
          </View>
        ) : detail.status === 'completed' ? (
          <View style={td.completedBadge}>
            <Text style={td.completedText}>🏁 Tournament completed</Text>
          </View>
        ) : spotsLeft <= 0 ? (
          <View style={td.fullBadge}>
            <Text style={td.fullText}>Tournament is full</Text>
          </View>
        ) : null}
      </View>

      {/* Leaderboard */}
      <View style={td.section}>
        <Text style={td.sectionTitle}>
          {detail.status === 'live' ? '🔴 Live Leaderboard' : 'Leaderboard'}
        </Text>

        {leaderboard.length === 0 ? (
          <Text style={td.empty}>No scores submitted yet</Text>
        ) : (
          <>
            {/* Column headers */}
            <View style={td.lbHeader}>
              <Text style={[td.lbHeaderText, { width: 32 }]}>Pos</Text>
              <Text style={[td.lbHeaderText, { flex: 1 }]}>Player</Text>
              <Text style={[td.lbHeaderText, { width: 48, textAlign: 'right' }]}>Score</Text>
              <Text style={[td.lbHeaderText, { width: 48, textAlign: 'right' }]}>Total</Text>
              <Text style={[td.lbHeaderText, { width: 36, textAlign: 'right' }]}>Thru</Text>
            </View>

            {leaderboard.map((entry) => (
              <View key={entry.userId} style={td.lbRow}>
                <Text style={td.lbPos}>
                  {entry.position <= 3 ? ['🥇', '🥈', '🥉'][entry.position - 1] : `${entry.position}`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                  <Avatar name={entry.displayName} size={28} />
                  <Text style={td.lbName} numberOfLines={1}>{entry.displayName}</Text>
                </View>
                <Text style={[td.lbScore, { color: scoreColor(entry.scoreToPar) }]}>
                  {formatScore(entry.scoreToPar)}
                </Text>
                <Text style={td.lbTotal}>
                  {entry.totalStrokes ?? '—'}
                </Text>
                <Text style={td.lbThru}>
                  {entry.completedAt ? 'F' : entry.holesCompleted}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const td = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { fontSize: 15, color: PRIMARY, fontWeight: '600' },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#111' },
  infoCard: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#111', fontWeight: '600', textTransform: 'capitalize' },
  description: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  entrySection: { paddingHorizontal: 16, marginBottom: 8 },
  enterBtn: { backgroundColor: PRIMARY, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  enterBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  enteredBadge: { backgroundColor: '#dcfce7', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  enteredText: { fontSize: 14, color: '#16a34a', fontWeight: '600', textAlign: 'center' },
  completedBadge: { backgroundColor: '#f3f4f6', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  completedText: { fontSize: 14, color: '#6b7280', fontWeight: '600', textAlign: 'center' },
  fullBadge: { backgroundColor: '#fef2f2', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  fullText: { fontSize: 14, color: '#dc2626', fontWeight: '600', textAlign: 'center' },
  section: { marginHorizontal: 16, marginTop: 8, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 12 },
  empty: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  lbHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#e5e7eb' },
  lbHeaderText: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  lbPos: { width: 32, fontSize: 14, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  lbName: { fontSize: 14, fontWeight: '600', color: '#111', flexShrink: 1 },
  lbScore: { width: 48, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  lbTotal: { width: 48, fontSize: 14, fontWeight: '600', color: '#6b7280', textAlign: 'right' },
  lbThru: { width: 36, fontSize: 13, fontWeight: '600', color: '#9ca3af', textAlign: 'right' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function TournamentsScreen() {
  const { session } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchTournaments = useCallback(async (silent = false) => {
    if (!session) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/tournaments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setTournaments(json.data ?? []);
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [session]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  if (selectedId) {
    return <TournamentDetailView tournamentId={selectedId} onBack={() => { setSelectedId(null); fetchTournaments(true); }} />;
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 15, color: PRIMARY, fontWeight: '600' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Tournaments</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : tournaments.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyEmoji}>🏆</Text>
          <Text style={s.emptyTitle}>No tournaments</Text>
          <Text style={s.emptySub}>Tournaments are created by courses and clubs. Check back soon for upcoming events!</Text>
        </View>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TournamentCard tournament={item} onPress={() => setSelectedId(item.id)} />}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTournaments(true); }} tintColor={PRIMARY} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: '#111', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  cardMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  formatBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  formatBadgeText: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'capitalize' },
  entrantCount: { alignItems: 'center' },
  entrantNum: { fontSize: 18, fontWeight: '800', color: '#111' },
  entrantLabel: { fontSize: 11, color: '#9ca3af' },
  courseName: { fontSize: 13, color: '#6b7280', marginTop: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  dateRange: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  spotsLeft: { fontSize: 12, color: '#dc2626', fontWeight: '700' },
});
