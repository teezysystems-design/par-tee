/**
 * Leagues Screen
 *
 * Shows:
 *   - Active league for the user (standings table + playoff bracket)
 *   - League creation flow
 *   - Available leagues to join
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import type { League, LeagueStanding, BracketMatch } from '@par-tee/shared';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1a7f4b';

// ─── Components ────────────────────────────────────────────────────────────

function StandingsRow({ s, isMe }: { s: LeagueStanding; isMe: boolean }) {
  const form = s.wins + s.draws + s.losses > 0
    ? `${s.wins}W ${s.losses}L${s.draws > 0 ? ` ${s.draws}D` : ''}`
    : '—';
  return (
    <View style={[st.standRow, isMe && st.standRowMe]}>
      <Text style={[st.standRank, isMe && { color: PRIMARY }]}>
        {s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : s.rank}
      </Text>
      <View style={st.standAvatar}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
          {s.userName.charAt(0)}
        </Text>
      </View>
      <Text style={[st.standName, isMe && { color: PRIMARY, fontWeight: '800' }]}>
        {s.userName}
      </Text>
      <Text style={st.standForm}>{form}</Text>
      <Text style={[st.standPoints, isMe && { color: PRIMARY }]}>{s.points}pts</Text>
    </View>
  );
}

function BracketColumn({ title, matches, myUserId }: { title: string; matches: BracketMatch[]; myUserId: string | null }) {
  return (
    <View style={st.bracketCol}>
      <Text style={st.bracketColTitle}>{title}</Text>
      {matches.map((m) => {
        const isMeInMatch = m.player1Id === myUserId || m.player2Id === myUserId;
        return (
          <View key={m.id} style={[st.bracketMatch, isMeInMatch && st.bracketMatchMe]}>
            <BracketPlayer
              name={m.player1Name ?? 'TBD'}
              score={m.score1}
              won={m.winnerId === m.player1Id}
              isMe={m.player1Id === myUserId}
            />
            <View style={st.bracketDivider} />
            <BracketPlayer
              name={m.player2Name ?? 'TBD'}
              score={m.score2}
              won={m.winnerId === m.player2Id}
              isMe={m.player2Id === myUserId}
            />
          </View>
        );
      })}
    </View>
  );
}

function BracketPlayer({ name, score, won, isMe }: { name: string; score: number | null; won: boolean; isMe: boolean }) {
  return (
    <View style={st.bracketPlayer}>
      <Text
        style={[st.bracketPlayerName, won && { fontWeight: '800', color: PRIMARY }, isMe && { color: PRIMARY }]}
        numberOfLines={1}
      >
        {won ? '✓ ' : ''}{name}
      </Text>
      {score != null && <Text style={st.bracketScore}>{score}</Text>}
    </View>
  );
}

// ─── League Card (list view) ────────────────────────────────────────────────

function LeagueCard({ league, onPress }: { league: League & { currentMembers: number }; onPress: () => void }) {
  const statusColor = league.status === 'active' ? '#16a34a' :
    league.status === 'playoffs' ? '#ea580c' :
    league.status === 'recruiting' ? '#2563eb' : '#6b7280';

  return (
    <TouchableOpacity style={st.leagueCard} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={st.leagueCardName}>{league.name}</Text>
        {league.description && <Text style={st.leagueCardDesc} numberOfLines={1}>{league.description}</Text>}
        <Text style={st.leagueCardMeta}>
          {league.currentMembers}/{league.maxMembers} players
        </Text>
      </View>
      <View style={[st.statusPill, { borderColor: statusColor }]}>
        <Text style={[st.statusPillText, { color: statusColor }]}>
          {league.status.charAt(0).toUpperCase() + league.status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Create League Form ────────────────────────────────────────────────────

function CreateLeagueForm({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [maxMembers, setMaxMembers] = useState('8');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your league a name.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/leagues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined, maxMembers: Number(maxMembers) }),
      });
      if (!res.ok) throw new Error('Server error');
      Alert.alert('League created!', `"${name.trim()}" is ready. Invite your friends.`);
      onCreated();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not create league.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={st.modal}>
      <View style={st.modalHandle} />
      <Text style={st.modalTitle}>Create League</Text>

      <Text style={st.label}>League name</Text>
      <TextInput
        style={st.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sunday Scratch League"
        placeholderTextColor="#9ca3af"
        autoCapitalize="words"
      />

      <Text style={st.label}>Description (optional)</Text>
      <TextInput
        style={[st.input, { height: 80, textAlignVertical: 'top' }]}
        value={desc}
        onChangeText={setDesc}
        placeholder="What's this league about?"
        placeholderTextColor="#9ca3af"
        multiline
      />

      <Text style={st.label}>Max members</Text>
      <View style={st.segRow}>
        {['4', '8', '16', '32'].map((n) => (
          <TouchableOpacity
            key={n}
            style={[st.segBtn, maxMembers === n && st.segBtnActive]}
            onPress={() => setMaxMembers(n)}
          >
            <Text style={[st.segBtnText, maxMembers === n && st.segBtnTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={st.primaryBtn} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.primaryBtnText}>Create League</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={st.textBtn} onPress={onClose}>
        <Text style={st.textBtnText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── League Detail ─────────────────────────────────────────────────────────

type DetailView = 'standings' | 'bracket';

function LeagueDetail({
  leagueId,
  token,
  myUserId,
  onBack,
}: {
  leagueId: string;
  token: string;
  myUserId: string | null;
  onBack: () => void;
}) {
  const [activeView, setActiveView] = useState<DetailView>('standings');
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<(League & { standings: LeagueStanding[]; currentMembers: number }) | null>(null);
  const [bracket, setBracket] = useState<BracketMatch[]>([]);

  const fetchLeague = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/leagues/${leagueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { data } = await res.json();
        setLeague(data);
      }
    } finally {
      setLoading(false);
    }
  }, [leagueId, token]);

  const fetchBracket = useCallback(async () => {
    const res = await fetch(`${API_URL}/v1/leagues/${leagueId}/bracket`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { data } = await res.json();
      setBracket(data ?? []);
    }
  }, [leagueId, token]);

  useEffect(() => { fetchLeague(); }, [fetchLeague]);
  useEffect(() => {
    if (activeView === 'bracket') fetchBracket();
  }, [activeView, fetchBracket]);

  const standingsByRound = (round: number) => bracket.filter((m) => m.round === round);
  const rounds = [...new Set(bracket.map((m) => m.round))].sort((a, b) => a - b);
  const roundLabels: Record<number, string> = { 1: 'Quarter-Finals', 2: 'Semi-Finals', 3: 'Final' };

  if (loading) return <ActivityIndicator color={PRIMARY} style={{ marginTop: 48 }} />;
  if (!league) return <Text style={{ textAlign: 'center', marginTop: 48, color: '#9ca3af' }}>League not found.</Text>;

  return (
    <>
      {/* View switcher */}
      <View style={st.tabs}>
        {([
          { id: 'standings' as const, label: '📊 Standings' },
          { id: 'bracket'   as const, label: '🏆 Playoffs' },
        ]).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[st.tabBtn, activeView === t.id && st.tabBtnActive]}
            onPress={() => setActiveView(t.id)}
          >
            <Text style={[st.tabBtnText, activeView === t.id && st.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* League meta */}
      <View style={st.leagueMeta}>
        <View style={st.leagueMetaLeft}>
          <Text style={st.leagueName}>{league.name}</Text>
          <Text style={st.leagueSub}>
            {league.currentMembers ?? league.standings.length}/{league.maxMembers} players
          </Text>
        </View>
        <View style={st.statusBadge}>
          <Text style={st.statusBadgeText}>
            {league.status === 'playoffs' ? '🏁 Playoffs' :
             league.status === 'active' ? '🟢 Active' :
             league.status === 'recruiting' ? '🔵 Recruiting' : '✅ Done'}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {activeView === 'standings' && (
          <View style={st.section}>
            <View style={st.tableHeader}>
              <Text style={[st.tableHeaderText, { width: 28 }]}>#</Text>
              <Text style={[st.tableHeaderText, { width: 36 }]}></Text>
              <Text style={[st.tableHeaderText, { flex: 1 }]}>Player</Text>
              <Text style={[st.tableHeaderText, { width: 80 }]}>Record</Text>
              <Text style={[st.tableHeaderText, { width: 48, textAlign: 'right' }]}>Pts</Text>
            </View>
            {league.standings.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>No standings yet.</Text>
            ) : (
              league.standings.map((s) => (
                <StandingsRow key={s.userId} s={s} isMe={s.userId === myUserId} />
              ))
            )}
          </View>
        )}

        {activeView === 'bracket' && (
          bracket.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Playoff bracket not set up yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.bracket}>
              {rounds.map((round) => (
                <BracketColumn
                  key={round}
                  title={roundLabels[round] ?? `Round ${round}`}
                  matches={standingsByRound(round)}
                  myUserId={myUserId}
                />
              ))}
            </ScrollView>
          )
        )}
      </ScrollView>
    </>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

type ScreenView = 'list' | 'detail' | 'create';

export default function LeaguesScreen() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const myUserId = session?.user?.id ?? null;

  const [view, setView] = useState<ScreenView>('list');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [myLeagues, setMyLeagues] = useState<(League & { currentMembers: number })[]>([]);
  const [openLeagues, setOpenLeagues] = useState<(League & { currentMembers: number })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeagues = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [myRes, openRes] = await Promise.all([
        fetch(`${API_URL}/v1/leagues`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/v1/leagues/open`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (myRes.ok) { const { data } = await myRes.json(); setMyLeagues(data ?? []); }
      if (openRes.ok) { const { data } = await openRes.json(); setOpenLeagues(data ?? []); }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

  const handleJoin = async (leagueId: string) => {
    const res = await fetch(`${API_URL}/v1/leagues/${leagueId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      Alert.alert('Joined!', 'You have joined the league.');
      fetchLeagues();
    } else {
      const body = await res.json();
      Alert.alert('Error', body?.error?.message ?? 'Could not join league.');
    }
  };

  return (
    <View style={st.screen}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity
          onPress={() => view === 'list' ? router.back() : setView('list')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={st.backBtn}>← {view === 'list' ? 'Back' : 'Leagues'}</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>
          {view === 'create' ? 'Create League' : view === 'detail' ? 'League' : 'Leagues'}
        </Text>
        {view === 'list' ? (
          <TouchableOpacity style={st.createBtn} onPress={() => setView('create')}>
            <Text style={st.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {view === 'create' ? (
        <ScrollView>
          <CreateLeagueForm
            token={token}
            onClose={() => setView('list')}
            onCreated={fetchLeagues}
          />
        </ScrollView>
      ) : view === 'detail' && selectedLeagueId ? (
        <LeagueDetail
          leagueId={selectedLeagueId}
          token={token}
          myUserId={myUserId}
          onBack={() => setView('list')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {loading ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 48 }} />
          ) : (
            <>
              {/* My Leagues */}
              <View style={st.listSection}>
                <Text style={st.listSectionTitle}>My Leagues</Text>
                {myLeagues.length === 0 ? (
                  <Text style={st.emptyText}>You're not in any leagues yet.</Text>
                ) : (
                  myLeagues.map((l) => (
                    <LeagueCard
                      key={l.id}
                      league={l}
                      onPress={() => { setSelectedLeagueId(l.id); setView('detail'); }}
                    />
                  ))
                )}
              </View>

              {/* Open Leagues */}
              {openLeagues.length > 0 && (
                <View style={st.listSection}>
                  <Text style={st.listSectionTitle}>Open Leagues</Text>
                  {openLeagues.map((l) => (
                    <View key={l.id} style={st.openLeagueRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.leagueCardName}>{l.name}</Text>
                        <Text style={st.leagueCardMeta}>{l.currentMembers}/{l.maxMembers} players</Text>
                      </View>
                      <TouchableOpacity style={st.joinBtn} onPress={() => handleJoin(l.id)}>
                        <Text style={st.joinBtnText}>Join</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  createBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: PRIMARY },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabBtnTextActive: { color: PRIMARY },

  leagueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  leagueMetaLeft: {},
  leagueName: { fontSize: 16, fontWeight: '800', color: '#111' },
  leagueSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusBadge: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c',
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400e' },

  section: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Standings
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
  },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' },

  standRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  standRowMe: { backgroundColor: '#f0fdf4' },
  standRank: { width: 28, fontSize: 14, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  standAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111' },
  standForm: { width: 80, fontSize: 12, color: '#6b7280', textAlign: 'center' },
  standPoints: { width: 48, fontSize: 14, fontWeight: '700', color: '#374151', textAlign: 'right' },

  // Bracket
  bracket: { flexDirection: 'row', padding: 16, gap: 16, alignItems: 'flex-start' },
  bracketCol: { width: 160, gap: 12 },
  bracketColTitle: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  bracketMatch: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  bracketMatchMe: { borderColor: PRIMARY, shadowColor: PRIMARY, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  bracketDivider: { height: 1, backgroundColor: '#e5e7eb' },
  bracketPlayer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 9 },
  bracketPlayerName: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  bracketScore: { fontSize: 13, fontWeight: '800', color: '#6b7280', marginLeft: 4 },

  // List view
  listSection: { paddingHorizontal: 16, paddingTop: 20 },
  listSectionTitle: { fontSize: 15, fontWeight: '800', color: '#374151', marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },

  leagueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  leagueCardName: { fontSize: 15, fontWeight: '700', color: '#111' },
  leagueCardDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  leagueCardMeta: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  statusPill: {
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  openLeagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  joinBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  joinBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Create form
  modal: { margin: 16, backgroundColor: '#fff', borderRadius: 24, padding: 20 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  segBtnText: { fontSize: 15, fontWeight: '700', color: '#6b7280' },
  segBtnTextActive: { color: '#fff' },
  primaryBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  textBtn: { alignItems: 'center', paddingVertical: 8 },
  textBtnText: { color: PRIMARY, fontSize: 15 },
});
