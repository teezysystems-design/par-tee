/**
 * Profile Screen — V2 Phase 3
 *
 * Layout:
 *   1. Header   — avatar (with rank ring), name, username, bio, privacy toggle, edit button
 *   2. Stats bar — rounds, avg score, wins, rank points, friends
 *   3. Badges row — earned rank/achievement badges
 *   4. Golf moods
 *   5. Posts grid — shared round cards
 *   6. Sign out
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { RANK_TIERS, RANK_COLORS } from '@par-tee/shared';
import type { RankTier } from '@par-tee/shared';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1a7f4b';

const MOODS = [
  { key: 'relaxed',     label: '😌 Relaxed' },
  { key: 'competitive', label: '🏆 Competitive' },
  { key: 'social',      label: '👥 Social' },
  { key: 'scenic',      label: '🌅 Scenic' },
  { key: 'beginner',    label: '🌱 Beginner-friendly' },
  { key: 'advanced',    label: '🔥 Advanced' },
  { key: 'fast-paced',  label: '⚡ Fast-paced' },
  { key: 'challenging', label: '💪 Challenging' },
] as const;

type MoodKey = (typeof MOODS)[number]['key'];

interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  isPrivate: boolean;
  handicap: string | null;
  moodPreferences: string[];
  avatarUrl: string | null;
}

interface RoundPost {
  id: string;
  courseName: string;
  totalScore: number;
  scoreToPar: number;
  date: string;
  holes: number;
}

// Mocked competitive stats until rankings API is wired
const MOCK_RANK: RankTier = 'scratch';
const MOCK_RANK_POINTS = 1240;
const MOCK_ROUNDS_PLAYED = 42;
const MOCK_AVG_SCORE = 78.4;
const MOCK_WINS = 9;

const MOCK_EARNED_BADGES: { tier: RankTier; earnedAt: string }[] = [
  { tier: 'rookie',      earnedAt: 'Jan 2026' },
  { tier: 'amateur',     earnedAt: 'Feb 2026' },
  { tier: 'club_player', earnedAt: 'Mar 2026' },
  { tier: 'scratch',     earnedAt: 'Mar 2026' },
];

// ─── Badge component ────────────────────────────────────────────────────────

function BadgePill({ tier, earnedAt }: { tier: RankTier; earnedAt: string }) {
  const info = RANK_TIERS.find((r) => r.tier === tier);
  const colors = RANK_COLORS[tier];
  return (
    <View style={[b.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={{ fontSize: 20 }}>{info?.icon}</Text>
      <Text style={[b.badgeLabel, { color: colors.text }]}>{info?.label}</Text>
      <Text style={b.badgeDate}>{earnedAt}</Text>
    </View>
  );
}

// ─── Round post cell ────────────────────────────────────────────────────────

function PostCell({ post }: { post: RoundPost }) {
  const diff = post.scoreToPar;
  const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  const diffColor = diff < 0 ? PRIMARY : diff === 0 ? '#374151' : '#dc2626';

  return (
    <View style={p.cell}>
      <Text style={[p.cellScore, { color: diffColor }]}>{diffStr}</Text>
      <Text style={p.cellTotal}>{post.totalScore}</Text>
      <Text style={p.cellCourse} numberOfLines={2}>{post.courseName}</Text>
      <Text style={p.cellDate}>{post.date}</Text>
    </View>
  );
}

// ─── Edit profile form ──────────────────────────────────────────────────────

function EditProfileForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onCancel: () => void;
}) {
  const { session } = useAuth();
  const [editName, setEditName] = useState(profile.name);
  const [editBio, setEditBio] = useState(profile.bio ?? '');
  const [editHandicap, setEditHandicap] = useState(profile.handicap ?? '');
  const [editPrivate, setEditPrivate] = useState(profile.isPrivate);
  const [editMoods, setEditMoods] = useState<MoodKey[]>(
    (profile.moodPreferences ?? []) as MoodKey[]
  );
  const [saving, setSaving] = useState(false);

  const toggleMood = (mood: MoodKey) => {
    setEditMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const save = async () => {
    if (!session || !editName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    const handicap = editHandicap.trim() ? parseFloat(editHandicap.trim()) : null;
    if (handicap !== null && (isNaN(handicap) || handicap < 0 || handicap > 54)) {
      Alert.alert('Invalid handicap', 'Handicap must be between 0 and 54.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: editName.trim(),
          bio: editBio.trim() || null,
          isPrivate: editPrivate,
          handicap,
          moodPreferences: editMoods,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? 'Failed to save');
      }
      const json = await res.json();
      onSave(json.data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={e.container}>
      <Text style={e.title}>Edit Profile</Text>

      <Text style={e.label}>Name</Text>
      <TextInput
        style={e.input}
        value={editName}
        onChangeText={setEditName}
        placeholder="Your name"
        placeholderTextColor="#9ca3af"
        autoCapitalize="words"
      />

      <Text style={e.label}>Bio (optional)</Text>
      <TextInput
        style={[e.input, e.bioInput]}
        value={editBio}
        onChangeText={setEditBio}
        placeholder="Tell golfers about yourself..."
        placeholderTextColor="#9ca3af"
        multiline
        maxLength={300}
      />

      <Text style={e.label}>Handicap (optional)</Text>
      <TextInput
        style={e.input}
        value={editHandicap}
        onChangeText={setEditHandicap}
        placeholder="e.g. 18.4"
        placeholderTextColor="#9ca3af"
        keyboardType="decimal-pad"
      />

      {/* Privacy toggle */}
      <View style={e.privacyRow}>
        <View style={{ flex: 1 }}>
          <Text style={e.label}>Private profile</Text>
          <Text style={e.privacyHint}>Only approved friends can see your stats and posts</Text>
        </View>
        <Switch
          value={editPrivate}
          onValueChange={setEditPrivate}
          trackColor={{ false: '#e5e7eb', true: PRIMARY }}
          thumbColor="#fff"
        />
      </View>

      <Text style={e.label}>Golf moods</Text>
      <View style={e.moodsGrid}>
        {MOODS.map((mood) => {
          const selected = editMoods.includes(mood.key);
          return (
            <TouchableOpacity
              key={mood.key}
              style={[e.moodChip, selected && e.moodChipSelected]}
              onPress={() => toggleMood(mood.key)}
            >
              <Text style={[e.moodChipText, selected && e.moodChipTextSelected]}>
                {mood.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={e.primaryBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={e.primaryBtnText}>Save changes</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={e.textBtn} onPress={onCancel}>
        <Text style={e.textBtnText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sharedRounds, setSharedRounds] = useState<RoundPost[]>([]);
  const [friendCount, setFriendCount] = useState<number>(0);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    try {
      const [profileRes, friendsRes] = await Promise.all([
        fetch(`${API_URL}/v1/users/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_URL}/v1/social/friends`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (profileRes.ok) {
        const json = await profileRes.json();
        setProfile(json.data);
      }
      if (friendsRes.ok) {
        const json = await friendsRes.json();
        setFriendCount((json.data ?? []).length);
      }

      // Fetch shared rounds from activity feed (own rounds)
      // TODO: replace with dedicated user rounds endpoint when available
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (fetching) {
    return (
      <View style={pr.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={pr.centered}>
        <Text style={pr.errorText}>Could not load profile.</Text>
        <TouchableOpacity style={pr.retryBtn} onPress={fetchProfile}>
          <Text style={pr.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (editing) {
    return (
      <EditProfileForm
        profile={profile}
        onSave={(updated) => { setProfile(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const rankInfo = RANK_TIERS.find((r) => r.tier === MOCK_RANK);
  const rankColors = RANK_COLORS[MOCK_RANK];

  return (
    <ScrollView
      style={pr.screen}
      contentContainerStyle={pr.content}
      refreshControl={<RefreshControl refreshing={fetching} onRefresh={fetchProfile} tintColor={PRIMARY} />}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={pr.header}>
        <View style={pr.avatarWrap}>
          <View style={pr.avatar}>
            <Text style={pr.avatarInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
          </View>
          {/* Rank ring badge */}
          <View style={[pr.rankRing, { borderColor: rankColors.border, backgroundColor: rankColors.bg }]}>
            <Text style={{ fontSize: 10 }}>{rankInfo?.icon}</Text>
          </View>
        </View>

        <View style={pr.headerInfo}>
          <View style={pr.nameRow}>
            <Text style={pr.profileName}>{profile.name}</Text>
            {profile.isPrivate && (
              <View style={pr.privateBadge}>
                <Text style={pr.privateBadgeText}>🔒 Private</Text>
              </View>
            )}
          </View>
          <Text style={pr.profileEmail}>{profile.email}</Text>
          {profile.handicap != null && (
            <Text style={pr.handicapText}>HCP {Number(profile.handicap).toFixed(1)}</Text>
          )}
        </View>

        <TouchableOpacity style={pr.editBtn} onPress={() => setEditing(true)}>
          <Text style={pr.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Bio */}
      {profile.bio ? (
        <View style={pr.bioSection}>
          <Text style={pr.bioText}>{profile.bio}</Text>
        </View>
      ) : null}

      {/* ── Stats bar ─────────────────────────────────────────── */}
      <View style={pr.statsBar}>
        <View style={pr.statItem}>
          <Text style={pr.statValue}>{MOCK_ROUNDS_PLAYED}</Text>
          <Text style={pr.statLabel}>Rounds</Text>
        </View>
        <View style={pr.statDivider} />
        <View style={pr.statItem}>
          <Text style={pr.statValue}>{MOCK_AVG_SCORE.toFixed(1)}</Text>
          <Text style={pr.statLabel}>Avg Score</Text>
        </View>
        <View style={pr.statDivider} />
        <View style={pr.statItem}>
          <Text style={pr.statValue}>{MOCK_WINS}</Text>
          <Text style={pr.statLabel}>Wins</Text>
        </View>
        <View style={pr.statDivider} />
        <View style={pr.statItem}>
          <Text style={[pr.statValue, { color: rankColors.text }]}>
            {MOCK_RANK_POINTS.toLocaleString()}
          </Text>
          <Text style={pr.statLabel}>Rank Pts</Text>
        </View>
        <View style={pr.statDivider} />
        <View style={pr.statItem}>
          <Text style={pr.statValue}>{friendCount}</Text>
          <Text style={pr.statLabel}>Friends</Text>
        </View>
      </View>

      {/* ── Rank badge ──────────────────────────────────────────── */}
      <View style={[pr.currentRankCard, { backgroundColor: rankColors.bg, borderColor: rankColors.border }]}>
        <Text style={{ fontSize: 32 }}>{rankInfo?.icon}</Text>
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={[pr.rankLabel, { color: rankColors.text }]}>Current Rank</Text>
          <Text style={[pr.rankTierName, { color: rankColors.text }]}>{rankInfo?.label}</Text>
          <Text style={pr.rankPts}>{MOCK_RANK_POINTS.toLocaleString()} pts</Text>
        </View>
        {/* Availability calendar shortcut */}
        <TouchableOpacity
          style={pr.calendarBtn}
          onPress={() => router.push('/availability')}
        >
          <Text style={pr.calendarBtnIcon}>📅</Text>
          <Text style={pr.calendarBtnText}>Availability</Text>
        </TouchableOpacity>
      </View>

      {/* ── Badges row ─────────────────────────────────────────── */}
      <View style={pr.sectionHeader}>
        <Text style={pr.sectionTitle}>Badges Earned</Text>
        <Text style={pr.sectionSub}>{MOCK_EARNED_BADGES.length} of {RANK_TIERS.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pr.badgesRow}
      >
        {MOCK_EARNED_BADGES.map(({ tier, earnedAt }) => (
          <BadgePill key={tier} tier={tier} earnedAt={earnedAt} />
        ))}
        {/* Locked badges */}
        {RANK_TIERS.filter((r) => !MOCK_EARNED_BADGES.find((e) => e.tier === r.tier)).map((r) => (
          <View key={r.tier} style={[b.badge, b.badgeLocked]}>
            <Text style={{ fontSize: 20, opacity: 0.3 }}>{r.icon}</Text>
            <Text style={b.badgeLabelLocked}>{r.label}</Text>
            <Text style={b.badgeDateLocked}>Locked</Text>
          </View>
        ))}
      </ScrollView>

      {/* ── Moods ────────────────────────────────────────────────── */}
      {(profile.moodPreferences?.length ?? 0) > 0 && (
        <View style={pr.moodsSection}>
          <Text style={pr.sectionTitle}>Golf Moods</Text>
          <View style={pr.moodsGrid}>
            {(profile.moodPreferences as MoodKey[]).map((key) => {
              const mood = MOODS.find((m) => m.key === key);
              return (
                <View key={key} style={pr.moodChip}>
                  <Text style={pr.moodChipText}>{mood?.label ?? key}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Posts grid ─────────────────────────────────────────── */}
      <View style={pr.sectionHeader}>
        <Text style={pr.sectionTitle}>Rounds</Text>
        <Text style={pr.sectionSub}>{sharedRounds.length > 0 ? `${sharedRounds.length} shared` : 'None shared yet'}</Text>
      </View>
      {sharedRounds.length > 0 ? (
        <View style={pr.postsGrid}>
          {sharedRounds.map((post) => (
            <PostCell key={post.id} post={post} />
          ))}
        </View>
      ) : (
        <View style={pr.emptyRounds}>
          <Text style={pr.emptyRoundsText}>Complete and share rounds to see them here.</Text>
        </View>
      )}

      {/* ── Sign out ─────────────────────────────────────────────── */}
      <TouchableOpacity style={pr.signOutBtn} onPress={handleSignOut}>
        <Text style={pr.signOutBtnText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const pr = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#9ca3af', fontSize: 15, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: PRIMARY, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 28, color: '#fff', fontWeight: '800' },
  rankRing: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#111' },
  privateBadge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  privateBadgeText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  profileEmail: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  handicapText: { fontSize: 13, color: PRIMARY, fontWeight: '700', marginTop: 4 },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },

  // Bio
  bioSection: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#f3f4f6' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 10, color: '#9ca3af', marginTop: 2 },

  // Current rank + calendar
  currentRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  rankLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  rankTierName: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  rankPts: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  calendarBtn: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  calendarBtnIcon: { fontSize: 22 },
  calendarBtnText: { fontSize: 10, fontWeight: '700', color: '#374151', marginTop: 2 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  sectionSub: { fontSize: 13, color: '#9ca3af' },

  // Badges
  badgesRow: { paddingLeft: 16, paddingRight: 8, paddingBottom: 4, gap: 8 },

  // Moods
  moodsSection: { paddingHorizontal: 16, marginTop: 20 },
  moodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  moodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: PRIMARY,
  },
  moodChipText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // Posts grid
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyRounds: { paddingHorizontal: 16, paddingVertical: 12 },
  emptyRoundsText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },

  // Sign out
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
  },
  signOutBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
});

const b = StyleSheet.create({
  badge: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    minWidth: 80,
  },
  badgeLabel: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  badgeDate: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  badgeLocked: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  badgeLabelLocked: { fontSize: 11, fontWeight: '600', color: '#d1d5db', marginTop: 4 },
  badgeDateLocked: { fontSize: 10, color: '#d1d5db', marginTop: 2 },
});

const p = StyleSheet.create({
  cell: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 10,
    justifyContent: 'space-between',
  },
  cellScore: { fontSize: 20, fontWeight: '900' },
  cellTotal: { fontSize: 28, fontWeight: '900', color: '#111', lineHeight: 30 },
  cellCourse: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  cellDate: { fontSize: 10, color: '#d1d5db', fontWeight: '600' },
});

const e = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff', paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 24, marginTop: 56 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingVertical: 4,
  },
  privacyHint: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  moodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  moodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9f9f9',
  },
  moodChipSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  moodChipText: { fontSize: 13, color: '#444' },
  moodChipTextSelected: { color: '#fff', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  textBtn: { alignItems: 'center', paddingVertical: 8 },
  textBtnText: { color: PRIMARY, fontSize: 15 },
});
