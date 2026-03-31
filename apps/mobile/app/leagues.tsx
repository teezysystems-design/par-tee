/**
 * Leagues Screen
 *
 * Shows:
 *   - Active league for the user (standings table + playoff bracket)
 *   - League creation flow
 *   - Available leagues to join
 */
import { useState } from 'react';
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
import type { LeagueStanding, BracketMatch } from '@teezy/shared/types';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1a7f4b';

// ─── Mock data ─────────────────────────────────────────────────────────────

const MOCK_STANDINGS: LeagueStanding[] = [
  { rank: 1, userId: 'u1', userName: 'Jordan T.',  avatarUrl: null, wins: 8, losses: 2, draws: 0, points: 24, matchesPlayed: 10 },
  { rank: 2, userId: 'u2', userName: 'Riley C.',   avatarUrl: null, wins: 7, losses: 3, draws: 0, points: 21, matchesPlayed: 10 },
  { rank: 3, userId: 'me', userName: 'You',        avatarUrl: null, wins: 6, losses: 3, draws: 1, points: 19, matchesPlayed: 10 },
  { rank: 4, userId: 'u4', userName: 'Alex P.',    avatarUrl: null, wins: 5, losses: 5, draws: 0, points: 15, matchesPlayed: 10 },
  { rank: 5, userId: 'u5', userName: 'Casey L.',   avatarUrl: null, wins: 4, losses: 6, draws: 0, points: 12, matchesPlayed: 10 },
  { rank: 6, userId: 'u6', userName: 'Morgan K.',  avatarUrl: null, wins: 3, losses: 6, draws: 1, points: 10, matchesPlayed: 10 },
  { rank: 7, userId: 'u7', userName: 'Drew F.',    avatarUrl: null, wins: 2, losses: 7, draws: 1, points: 7,  matchesPlayed: 10 },
  { rank: 8, userId: 'u8', userName: 'Quinn B.',   avatarUrl: null, wins: 1, losses: 9, draws: 0, points: 3,  matchesPlayed: 10 },
];

const MOCK_BRACKET: BracketMatch[] = [
  // QF
  { id: 'qf1', round: 1, matchNumber: 1, player1Id: 'u1', player2Id: 'u8', player1Name: 'Jordan T.', player2Name: 'Quinn B.',  winnerId: 'u1', scheduledAt: null, score1: 72, score2: 81 },
  { id: 'qf2', round: 1, matchNumber: 2, player1Id: 'u2', player2Id: 'u7', player1Name: 'Riley C.',  player2Name: 'Drew F.',   winnerId: 'u2', scheduledAt: null, score1: 74, score2: 78 },
  { id: 'qf3', round: 1, matchNumber: 3, player1Id: 'me', player2Id: 'u6', player1Name: 'You',       player2Name: 'Morgan K.', winnerId: 'me', scheduledAt: null, score1: 76, score2: 79 },
  { id: 'qf4', round: 1, matchNumber: 4, player1Id: 'u4', player2Id: 'u5', player1Name: 'Alex P.',   player2Name: 'Casey L.',  winnerId: 'u4', scheduledAt: null, score1: 75, score2: 77 },
  // SF
  { id: 'sf1', round: 2, matchNumber: 1, player1Id: 'u1', player2Id: 'u2', player1Name: 'Jordan T.', player2Name: 'Riley C.',  winnerId: 'u1', scheduledAt: null, score1: 70, score2: 73 },
  { id: 'sf2', round: 2, matchNumber: 2, player1Id: 'me', player2Id: 'u4', player1Name: 'You',       player2Name: 'Alex P.',   winnerId: null, scheduledAt: null, score1: null, score2: null },
  // Final
  { id: 'f1',  round: 3, matchNumber: 1, player1Id: 'u1', player2Id: null, player1Name: 'Jordan T.', player2Name: 'TBD',       winnerId: null, scheduledAt: null, score1: null, score2: null },
];

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

function BracketColumn({
  title,
  matches,
}: {
  title: string;
  matches: BracketMatch[];
}) {
  return (
    <View style={st.bracketCol}>
      <Text style={st.bracketColTitle}>{title}</Text>
      {matches.map((m) => {
        const isMeInMatch = m.player1Id === 'me' || m.player2Id === 'me';
        return (
          <View
            key={m.id}
            style={[st.bracketMatch, isMeInMatch && st.bracketMatchMe]}
          >
            <BracketPlayer
              name={m.player1Name ?? 'TBD'}
              score={m.score1}
              won={m.winnerId === m.player1Id}
              isMe={m.player1Id === 'me'}
            />
            <View style={st.bracketDivider} />
            <BracketPlayer
              name={m.player2Name ?? 'TBD'}
              score={m.score2}
              won={m.winnerId === m.player2Id}
              isMe={m.player2Id === 'me'}
            />
          </View>
        );
      })}
    </View>
  );
}

function BracketPlayer({
  name,
  score,
  won,
  isMe,
}: {
  name: string;
  score: number | null;
  won: boolean;
  isMe: boolean;
}) {
  return (
    <View style={st.bracketPlayer}>
      <Text
        style={[
          st.bracketPlayerName,
          won && { fontWeight: '800', color: PRIMARY },
          isMe && { color: PRIMARY },
        ]}
        numberOfLines={1}
      >
        {won ? '✓ ' : ''}{name}
      </Text>
      {score != null && <Text style={st.bracketScore}>{score}</Text>}
    </View>
  );
}

// ─── Create League Modal ────────────────────────────────────────────────────

function CreateLeagueForm({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
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
      // Will POST to /v1/leagues when endpoint exists
      await new Promise((r) => setTimeout(r, 800));
      Alert.alert('League created!', `"${name.trim()}" is ready. Invite your friends.`);
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

// ─── Main Screen ───────────────────────────────────────────────────────────

type View_ = 'standings' | 'bracket' | 'create';

export default function LeaguesScreen() {
  const [activeView, setActiveView] = useState<View_>('standings');

  const standingsByRound = (round: number) =>
    MOCK_BRACKET.filter((m) => m.round === round);

  return (
    <View style={st.screen}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={st.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Leagues</Text>
        <TouchableOpacity
          style={st.createBtn}
          onPress={() => setActiveView('create')}
        >
          <Text style={st.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {activeView === 'create' ? (
        <ScrollView>
          <CreateLeagueForm onClose={() => setActiveView('standings')} />
        </ScrollView>
      ) : (
        <>
          {/* View switcher */}
          <View style={st.tabs}>
            {[
              { id: 'standings' as const, label: '📊 Standings' },
              { id: 'bracket'   as const, label: '🏆 Playoffs' },
            ].map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[st.tabBtn, activeView === t.id && st.tabBtnActive]}
                onPress={() => setActiveView(t.id)}
              >
                <Text
                  style={[st.tabBtnText, activeView === t.id && st.tabBtnTextActive]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* League meta */}
          <View style={st.leagueMeta}>
            <View style={st.leagueMetaLeft}>
              <Text style={st.leagueName}>Sunday Scratch League</Text>
              <Text style={st.leagueSub}>Season 1 · 10 weeks · 8 players</Text>
            </View>
            <View style={st.statusBadge}>
              <Text style={st.statusBadgeText}>🏁 Playoffs</Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {activeView === 'standings' && (
              <View style={st.section}>
                <View style={st.tableHeader}>
                  <Text style={[st.tableHeaderText, { width: 28 }]}>#</Text>
                  <Text style={[st.tableHeaderText, { width: 36 }]}></Text>
                  <Text style={[st.tableHeaderText, { flex: 1 }]}>Player</Text>
                  <Text style={[st.tableHeaderText, { width: 80 }]}>Record</Text>
                  <Text style={[st.tableHeaderText, { width: 48, textAlign: 'right' }]}>Pts</Text>
                </View>
                {MOCK_STANDINGS.map((s) => (
                  <StandingsRow key={s.userId} s={s} isMe={s.userId === 'me'} />
                ))}
              </View>
            )}

            {activeView === 'bracket' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.bracket}
              >
                <BracketColumn title="Quarter-Finals" matches={standingsByRound(1)} />
                <BracketColumn title="Semi-Finals"    matches={standingsByRound(2)} />
                <BracketColumn title="Final"          matches={standingsByRound(3)} />
              </ScrollView>
            )}
          </ScrollView>
        </>
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
  backBtn: { fontSize: 15, color: PRIMARY, fontWeight: '600' },
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
