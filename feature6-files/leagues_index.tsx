/**
 * Leagues Screen — Feature 6
 *
 * Shows user's leagues + create button.
 * Tapping a league navigates to detail view with standings + matches.
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
  TextInput,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { router } from 'expo-router';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

interface League {
  id: string;
  name: string;
  description: string | null;
  leagueType: '1v1' | '2v2';
  scoringFormat: string;
  status: string;
  maxMembers: number;
  currentMembers: number;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  currentRound: number;
  courseName: string | null;
  createdAt: string;
}

interface Standing {
  rank: number;
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  eloRating: number;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winRate: number;
}

interface Match {
  id: string;
  round: number;
  isPlayoff: boolean;
  status: string;
  score1: number | null;
  score2: number | null;
  playedAt: string | null;
  player1Name: string;
  player2Name: string;
  winnerName: string | null;
}

interface LeagueDetail extends League {
  allowRematches: boolean;
  partnerConfig: string;
  playoffFormat: string;
  playoffSize: number;
  createdByUserId: string;
  members: Standing[];
  matches: Match[];
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{(name ?? '?')[0].toUpperCase()}</Text>
    </View>
  );
}

// ─── League List ─────────────────────────────────────────────────────────────

function LeagueCard({ league, onPress }: { league: League; onPress: () => void }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    recruiting: { bg: '#dbeafe', text: '#2563eb' },
    active: { bg: '#dcfce7', text: '#16a34a' },
    playoffs: { bg: '#fef3c7', text: '#d97706' },
    completed: { bg: '#f3f4f6', text: '#6b7280' },
  };
  const sc = statusColors[league.status] ?? statusColors.recruiting;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.7}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{league.name}</Text>
          <View style={s.cardMeta}>
            <View style={[s.typeBadge, { backgroundColor: league.leagueType === '1v1' ? '#eff6ff' : '#faf5ff' }]}>
              <Text style={[s.typeBadgeText, { color: league.leagueType === '1v1' ? '#2563eb' : '#7c3aed' }]}>
                {league.leagueType === '1v1' ? '⚔️ 1v1' : '🤝 2v2'}
              </Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[s.statusBadgeText, { color: sc.text }]}>{league.status}</Text>
            </View>
          </View>
        </View>
        <View style={s.memberCount}>
          <Text style={s.memberNum}>{league.currentMembers}/{league.maxMembers}</Text>
          <Text style={s.memberLabel}>players</Text>
        </View>
      </View>
      {league.courseName && (
        <Text style={s.courseName}>⛳ {league.courseName}</Text>
      )}
      {league.status === 'active' && (
        <Text style={s.roundInfo}>Round {league.currentRound}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Create League Modal ─────────────────────────────────────────────────────

function CreateLeagueModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState('');
  const [leagueType, setLeagueType] = useState<'1v1' | '2v2'>('1v1');
  const [format, setFormat] = useState('stroke_play');
  const [maxMembers, setMaxMembers] = useState('8');

  const handleCreate = () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    onCreate({
      name: name.trim(),
      leagueType,
      scoringFormat: format,
      maxMembers: Number(maxMembers) || 8,
    });
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={m.container}>
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}><Text style={m.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={m.title}>New League</Text>
          <TouchableOpacity onPress={handleCreate}><Text style={m.create}>Create</Text></TouchableOpacity>
        </View>

        <ScrollView style={m.body}>
          <Text style={m.label}>League Name</Text>
          <TextInput
            style={m.input}
            placeholder="e.g. Weekend Warriors"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#9ca3af"
          />

          <Text style={m.label}>Type</Text>
          <View style={m.segmented}>
            {(['1v1', '2v2'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[m.segment, leagueType === t && m.segmentActive]}
                onPress={() => setLeagueType(t)}
              >
                <Text style={[m.segmentText, leagueType === t && m.segmentTextActive]}>
                  {t === '1v1' ? '⚔️ 1v1' : '🤝 2v2'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Scoring Format</Text>
          <View style={m.segmented}>
            {[
              { key: 'stroke_play', label: 'Stroke' },
              { key: 'net_stroke_play', label: 'Net Stroke' },
              { key: 'match_play', label: 'Match Play' },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[m.segment, format === f.key && m.segmentActive]}
                onPress={() => setFormat(f.key)}
              >
                <Text style={[m.segmentText, format === f.key && m.segmentTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Max Members</Text>
          <TextInput
            style={m.input}
            placeholder="8"
            value={maxMembers}
            onChangeText={setMaxMembers}
            keyboardType="number-pad"
            placeholderTextColor="#9ca3af"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  cancel: { fontSize: 15, color: '#6b7280' },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  create: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  body: { padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111', backgroundColor: '#fff' },
  segmented: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3 },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  segmentTextActive: { color: '#111' },
});

// ─── League Detail Screen ────────────────────────────────────────────────────

function LeagueDetailView({
  leagueId,
  onBack,
}: {
  leagueId: string;
  onBack: () => void;
}) {
  const { session } = useAuth();
  const [detail, setDetail] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/v1/leagues/${leagueId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setDetail(json.data);
      }
    } catch {} finally { setLoading(false); }
  }, [session, leagueId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleInvite = async () => {
    const username = inviteUsername.trim().toLowerCase().replace(/^@/, '');
    if (!username || !session) return;
    setInviting(true);
    try {
      const res = await fetch(`${API_URL}/v1/leagues/${leagueId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ username }),
      });
      const json = await res.json();
      if (res.ok) {
        Alert.alert('Sent!', json.data?.message ?? 'Invite sent');
        setInviteUsername('');
      } else {
        Alert.alert('Error', json.error?.message ?? 'Could not invite');
      }
    } catch { Alert.alert('Error', 'Failed to invite'); } finally { setInviting(false); }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>;
  if (!detail) return <View style={s.centered}><Text>League not found</Text></View>;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={d.header}>
        <TouchableOpacity onPress={onBack}><Text style={d.back}>← Back</Text></TouchableOpacity>
        <Text style={d.title}>{detail.name}</Text>
        <View style={[s.typeBadge, { backgroundColor: detail.leagueType === '1v1' ? '#eff6ff' : '#faf5ff' }]}>
          <Text style={[s.typeBadgeText, { color: detail.leagueType === '1v1' ? '#2563eb' : '#7c3aed' }]}>
            {detail.leagueType}
          </Text>
        </View>
      </View>

      {/* Info bar */}
      <View style={d.infoBar}>
        <View style={d.infoPill}><Text style={d.infoText}>{detail.scoringFormat.replace(/_/g, ' ')}</Text></View>
        <View style={d.infoPill}><Text style={d.infoText}>{detail.status}</Text></View>
        {detail.status === 'active' && <View style={d.infoPill}><Text style={d.infoText}>Round {detail.currentRound}</Text></View>}
      </View>

      {/* Invite */}
      {detail.status === 'recruiting' && (
        <View style={d.inviteBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16, color: '#9ca3af', fontWeight: '600' }}>@</Text>
            <TextInput
              style={d.inviteInput}
              placeholder="invite by username"
              value={inviteUsername}
              onChangeText={setInviteUsername}
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              style={[d.inviteBtn, !inviteUsername.trim() && { opacity: 0.5 }]}
              onPress={handleInvite}
              disabled={!inviteUsername.trim() || inviting}
            >
              {inviting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={d.inviteBtnText}>Invite</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Standings */}
      <View style={d.section}>
        <Text style={d.sectionTitle}>Standings</Text>
        {detail.members.length === 0 ? (
          <Text style={d.empty}>No members yet</Text>
        ) : (
          detail.members.map((m) => (
            <View key={m.userId} style={d.standingRow}>
              <Text style={d.standingRank}>{m.rank <= 3 ? ['🥇', '🥈', '🥉'][m.rank - 1] : `#${m.rank}`}</Text>
              <Avatar name={m.displayName} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={d.standingName}>{m.displayName}</Text>
                <Text style={d.standingSub}>{m.wins}W {m.losses}L · ELO {m.eloRating}</Text>
              </View>
              <Text style={d.standingWr}>{m.winRate}%</Text>
            </View>
          ))
        )}
      </View>

      {/* Recent Matches */}
      <View style={d.section}>
        <Text style={d.sectionTitle}>Recent Matches</Text>
        {detail.matches.length === 0 ? (
          <Text style={d.empty}>No matches played yet</Text>
        ) : (
          detail.matches.slice(0, 10).map((match) => (
            <View key={match.id} style={d.matchRow}>
              <View style={{ flex: 1 }}>
                <Text style={d.matchPlayers}>
                  {match.player1Name} vs {match.player2Name}
                </Text>
                <Text style={d.matchScore}>
                  {match.status === 'completed'
                    ? `${match.score1} - ${match.score2}`
                    : match.status}
                </Text>
              </View>
              {match.winnerName && <Text style={d.matchWinner}>{match.winnerName} won</Text>}
              {match.isPlayoff && <View style={d.playoffTag}><Text style={d.playoffTagText}>Playoff</Text></View>}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const d = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { fontSize: 15, color: PRIMARY, fontWeight: '600' },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#111' },
  infoBar: { flexDirection: 'row', gap: 8, padding: 16 },
  infoPill: { backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  infoText: { fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'capitalize' },
  inviteBox: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  inviteInput: { flex: 1, fontSize: 14, color: '#111', paddingVertical: 6 },
  inviteBtn: { backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  section: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 12 },
  empty: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  standingRank: { width: 28, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#6b7280' },
  standingName: { fontSize: 14, fontWeight: '600', color: '#111' },
  standingSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  standingWr: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 8 },
  matchPlayers: { fontSize: 14, fontWeight: '600', color: '#111' },
  matchScore: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  matchWinner: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  playoffTag: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  playoffTagText: { fontSize: 10, fontWeight: '700', color: '#d97706' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function LeaguesScreen() {
  const { session } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);

  const fetchLeagues = useCallback(async (silent = false) => {
    if (!session) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/leagues?mine=true`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setLeagues(json.data ?? []);
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [session]);

  useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

  const handleCreate = async (data: Record<string, unknown>) => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/v1/leagues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        Alert.alert('Created!', 'Your league is ready. Invite players to join.');
        fetchLeagues(true);
      } else {
        const json = await res.json();
        Alert.alert('Error', json.error?.message ?? 'Could not create league');
      }
    } catch { Alert.alert('Error', 'Failed to create league'); }
  };

  if (selectedLeagueId) {
    return <LeagueDetailView leagueId={selectedLeagueId} onBack={() => { setSelectedLeagueId(null); fetchLeagues(true); }} />;
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ fontSize: 15, color: PRIMARY, fontWeight: '600' }}>← Back</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Leagues</Text>
        <TouchableOpacity style={s.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={s.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : leagues.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyEmoji}>🏅</Text>
          <Text style={s.emptyTitle}>No leagues yet</Text>
          <Text style={s.emptySub}>Create a league and invite friends for structured competitive play.</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
            <Text style={s.emptyBtnText}>Create League</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LeagueCard league={item} onPress={() => setSelectedLeagueId(item.id)} />}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeagues(true); }} tintColor={PRIMARY} />}
        />
      )}

      <CreateLeagueModal visible={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  createBtn: { backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: '#111', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  emptyBtn: { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  cardMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  memberCount: { alignItems: 'center' },
  memberNum: { fontSize: 18, fontWeight: '800', color: '#111' },
  memberLabel: { fontSize: 11, color: '#9ca3af' },
  courseName: { fontSize: 13, color: '#6b7280', marginTop: 8 },
  roundInfo: { fontSize: 12, color: PRIMARY, fontWeight: '600', marginTop: 4 },
});
