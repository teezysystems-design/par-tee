/**
 * Profile Screen — Redesigned V3
 *
 * Clean, playful, premium design with competitive gaming energy.
 * Brand colors: Primary Green #1B6B3A, Gold #FFD700, Bronze #CD7F32
 *
 * Layout:
 *   1. Header — avatar with rank ring, name, username, handicap, lock badge, edit button
 *   2. Bio — subtitle with user's bio
 *   3. Stats bar — rounds, avg score, wins, rank points, friends
 *   4. Current rank card — tier icon, name, points, progress bar to next tier
 *   5. Badges — horizontal scroll of earned/locked badges
 *   6. Rank history — bar chart showing progression over time
 *   7. Golf moods — chip display of selected moods
 *   8. Recent rounds grid — 3-column grid of score cards
 *   9. Sign out button
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
import { COLORS, MOODS, RANK_COLORS, RANK_TIERS } from '@par-tee/shared';
import type { RankTier } from '@par-tee/shared';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// Brand colors
const PRIMARY_GREEN = '#1B6B3A';
const GOLD = '#FFD700';
const BRONZE = '#CD7F32';

type MoodKey = (typeof MOODS)[number]['key'];

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio: string | null;
  isPrivate: boolean;
  handicap: number | null;
  moodPreferences: string[];
  avatarUrl: string | null;
  homeCourseId: string | null;
  ranking: {
    tier: RankTier;
    points: number;
    rank: number;
  } | null;
}

interface RoundPost {
  id: string;
  courseName: string;
  totalScore: number;
  scoreToPar: number;
  completedAt: string;
  holeCount: number;
}

interface RankHistoryPoint {
  label: string;
  points: number;
  tier: RankTier;
}

// ─── Rank History Chart ─────────────────────────────────────────────────────

function RankHistoryChart({ history }: { history: RankHistoryPoint[] }) {
  if (history.length === 0) return null;
  const maxPts = Math.max(...history.map((h) => h.points), 1);

  return (
    <View style={rh.container}>
      <View style={rh.bars}>
        {history.map((point) => {
          const heightPct = Math.max(point.points / maxPts, 0.04);
          const colors = RANK_COLORS[point.tier];
          return (
            <View key={point.label} style={rh.barCol}>
              <View style={rh.barTrack}>
                <View
                  style={[
                    rh.barFill,
                    {
                      height: `${Math.round(heightPct * 100)}%` as `${number}%`,
                      backgroundColor: colors.border,
                    },
                  ]}
                />
              </View>
              <Text style={rh.barLabel}>{point.label}</Text>
              <Text style={rh.barIcon}>{RANK_TIERS.find((r) => r.tier === point.tier)?.icon}</Text>
            </View>
          );
        })}
      </View>
      <View style={rh.yAxis}>
        {[1, 0.5, 0].map((fraction) => (
          <Text key={fraction} style={rh.yLabel}>
            {Math.round(maxPts * fraction).toLocaleString()}
          </Text>
        ))}
      </View>
    </View>
  );
}

const rh = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 120,
    gap: 8,
  },
  yAxis: {
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 28,
  },
  yLabel: { fontSize: 9, color: '#9ca3af', fontWeight: '500' },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barTrack: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 9, color: '#6b7280', fontWeight: '500' },
  barIcon: { fontSize: 10 },
});

// ─── Badge Pill ─────────────────────────────────────────────────────────────

function BadgePill({
  tier,
  earnedAt,
  isLocked,
}: {
  tier: RankTier;
  earnedAt?: string;
  isLocked?: boolean;
}) {
  const info = RANK_TIERS.find((r) => r.tier === tier);
  const colors = RANK_COLORS[tier];

  if (isLocked) {
    return (
      <View style={[b.badge, b.badgeLocked]}>
        <Text style={{ fontSize: 20, opacity: 0.3 }}>{info?.icon}</Text>
        <Text style={b.badgeLabelLocked}>{info?.label}</Text>
        <Text style={b.badgeDateLocked}>Locked</Text>
      </View>
    );
  }

  return (
    <View style={[b.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={{ fontSize: 20 }}>{info?.icon}</Text>
      <Text style={[b.badgeLabel, { color: colors.text }]}>{info?.label}</Text>
      <Text style={b.badgeDate}>{earnedAt ?? 'Earned'}</Text>
    </View>
  );
}

// ─── Round Post Cell ────────────────────────────────────────────────────────

function PostCell({ post }: { post: RoundPost }) {
  const diff = post.scoreToPar;
  const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  const diffColor = diff < 0 ? PRIMARY_GREEN : diff === 0 ? '#374151' : '#dc2626';

  return (
    <View style={p.cell}>
      <View>
        <Text style={[p.cellScore, { color: diffColor }]}>{diffStr}</Text>
      </View>
      <Text style={p.cellTotal}>{post.totalScore}</Text>
      <Text style={p.cellCourse} numberOfLines={2}>
        {post.courseName}
      </Text>
      <Text style={p.cellDate}>
        {new Date(post.completedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </Text>
    </View>
  );
}

// ─── Edit Profile Form ──────────────────────────────────────────────────────

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
  const [editName, setEditName] = useState(profile.displayName);
  const [editBio, setEditBio] = useState(profile.bio ?? '');
  const [editHandicap, setEditHandicap] = useState(
    profile.handicap != null ? profile.handicap.toString() : ''
  );
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
      Alert.alert('Name required', 'Please enter your display name.');
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          displayName: editName.trim(),
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

      <Text style={e.label}>Display Name</Text>
      <TextInput
        style={e.input}
        value={editName}
        onChangeText={setEditName}
        placeholder="Your display name"
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

      <View style={e.privacyRow}>
        <View style={{ flex: 1 }}>
          <Text style={e.label}>Private profile</Text>
          <Text style={e.privacyHint}>Only approved friends can see your stats and posts</Text>
        </View>
        <Switch
          value={editPrivate}
          onValueChange={setEditPrivate}
          trackColor={{ false: '#e5e7eb', true: PRIMARY_GREEN }}
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
                {mood.emoji} {mood.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={e.primaryBtn} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={e.primaryBtnText}>Save changes</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={e.textBtn} onPress={onCancel}>
        <Text style={e.textBtnText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Profile Screen ────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sharedRounds, setSharedRounds] = useState<RoundPost[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [rankHistory, setRankHistory] = useState<RankHistoryPoint[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [totalWins, setTotalWins] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    try {
      // Fetch user profile
      const profileRes = await fetch(`${API_URL}/v1/users/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (profileRes.ok) {
        const json = await profileRes.json();
        setProfile(json.data);
      }

      // Fetch friend count
      const friendsRes = await fetch(`${API_URL}/v1/social/friends`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (friendsRes.ok) {
        const json = await friendsRes.json();
        setFriendCount((json.data ?? []).length);
      }

      // Fetch recent rounds and calculate stats
      const roundsRes = await fetch(`${API_URL}/v1/rounds?limit=6`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (roundsRes.ok) {
        const json = await roundsRes.json();
        const rounds = (json.data ?? []) as RoundPost[];
        setSharedRounds(rounds);

        // Calculate average score and wins from rounds
        if (rounds.length > 0) {
          const totalScore = rounds.reduce((sum, r) => sum + r.totalScore, 0);
          setAvgScore(totalScore / rounds.length);
          // Count wins as rounds with negative score to par
          const wins = rounds.filter((r) => r.scoreToPar < 0).length;
          setTotalWins(wins);
        }
      }

      // Fetch rank history
      const historyRes = await fetch(`${API_URL}/v1/rankings/history`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (historyRes.ok) {
        const json = await historyRes.json();
        if ((json.data ?? []).length > 0) {
          setRankHistory(json.data as RankHistoryPoint[]);
        }
      }
    } catch {
      // Silent error handling
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (fetching) {
    return (
      <View style={pr.centered}>
        <ActivityIndicator size="large" color={PRIMARY_GREEN} />
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
        onSave={(updated) => {
          setProfile(updated);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  // Determine current rank (default to bronze_1 if no ranking)
  const currentRank = profile.ranking?.tier ?? 'bronze_1';
  const currentPoints = profile.ranking?.points ?? 0;
  const rankInfo = RANK_TIERS.find((r) => r.tier === currentRank);
  const rankColors = RANK_COLORS[currentRank];

  // Calculate progress to next tier
  const currentTierIndex = RANK_TIERS.findIndex((r) => r.tier === currentRank);
  const nextTierIndex = currentTierIndex + 1;
  const nextTierInfo =
    nextTierIndex < RANK_TIERS.length ? RANK_TIERS[nextTierIndex] : null;

  let progressPercent = 0;
  let pointsToNext = 0;
  if (nextTierInfo && rankInfo) {
    const currentMin = rankInfo.minPoints;
    const nextMin = nextTierInfo.minPoints;
    const pointsInTier = nextMin - currentMin;
    const pointsEarned = currentPoints - currentMin;
    progressPercent = Math.min((pointsEarned / pointsInTier) * 100, 100);
    pointsToNext = Math.max(nextMin - currentPoints, 0);
  }

  // Get top 6 badges (earned) and show 12 total
  const earnedBadges = [currentRank]; // Placeholder: in production, this comes from API
  const allTiers = RANK_TIERS.slice(0, 12); // Show first 12 tiers
  const lockedBadges = allTiers.filter((t) => !earnedBadges.includes(t.tier));

  const roundsPlayed = sharedRounds.length;

  return (
    <ScrollView
      style={pr.screen}
      contentContainerStyle={pr.content}
      refreshControl={
        <RefreshControl refreshing={fetching} onRefresh={fetchProfile} tintColor={PRIMARY_GREEN} />
      }
    >
      {/* ── Header Section ──────────────────────────────────────── */}
      <View style={pr.header}>
        <View style={pr.avatarWrap}>
          <View style={[pr.avatar, { backgroundColor: rankColors.bg }]}>
            <Text style={pr.avatarInitial}>
              {profile.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View
            style={[
              pr.rankRing,
              { borderColor: rankColors.border, backgroundColor: rankColors.bg },
            ]}
          >
            <Text style={pr.rankRingIcon}>{rankInfo?.icon}</Text>
          </View>
        </View>

        <View style={pr.headerInfo}>
          <View style={pr.nameRow}>
            <Text style={pr.profileName}>{profile.displayName}</Text>
            {profile.isPrivate && (
              <View style={pr.privateBadge}>
                <Text style={pr.privateBadgeText}>🔒</Text>
              </View>
            )}
          </View>
          <Text style={pr.profileUsername}>@{profile.username}</Text>
          {profile.handicap != null && (
            <Text style={pr.handicapText}>HCP {Number(profile.handicap).toFixed(1)}</Text>
          )}
        </View>

        <TouchableOpacity style={pr.editBtn} onPress={() => setEditing(true)}>
          <Text style={pr.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bio Section ─────────────────────────────────────────── */}
      {profile.bio ? (
        <View style={pr.bioSection}>
          <Text style={pr.bioText}>{profile.bio}</Text>
        </View>
      ) : null}

      {/* ── Stats Bar ───────────────────────────────────────────── */}
      <View style={pr.statsBar}>
        <View style={pr.statItem}>
          <Text style={pr.statValue}>{roundsPlayed}</Text>
          <Text style={pr.statLabel}>Rounds</Text>
        </View>
        <View style={pr.statDivider} />
        <View style={pr.statItem}>
          <Text style={pr.statValue}>
            {avgScore ? avgScore.toFixed(1) : '—'}
          </Text>
          <Text style={pr.statLabel}>Avg Score</Text>
        </View>
        <View style={pr.statDivider} />
        <View style={pr.statItem}>
          <Text style={pr.statValue}>{totalWins}</Text>
          <Text style={pr.statLabel}>Wins</Text>
        </View>
        <View style={pr.statDivider} />
        <View style={pr.statItem}>
          <Text style={[pr.statValue, { color: rankColors.text }]}>
            {currentPoints.toLocaleString()}
          </Text>
          <Text style={pr.statLabel}>Rank Pts</Text>
        </View>
        <View style={pr.statDivider} />
        <View style={pr.statItem}>
          <Text style={pr.statValue}>{friendCount}</Text>
          <Text style={pr.statLabel}>Friends</Text>
        </View>
      </View>

      {/* ── Current Rank Card ───────────────────────────────────── */}
      <View style={[pr.currentRankCard, { backgroundColor: rankColors.bg, borderColor: rankColors.border }]}>
        <View style={pr.rankCardLeft}>
          <Text style={pr.rankCardIcon}>{rankInfo?.icon}</Text>
        </View>
        <View style={pr.rankCardCenter}>
          <Text style={[pr.rankLabel, { color: rankColors.text }]}>CURRENT RANK</Text>
          <Text style={[pr.rankTierName, { color: rankColors.text }]}>
            {rankInfo?.label}
          </Text>
          <Text style={[pr.rankPts, { color: rankColors.text }]}>
            {currentPoints.toLocaleString()} pts
          </Text>

          {/* Progress bar */}
          {nextTierInfo && (
            <View style={pr.progressContainer}>
              <View style={pr.progressBar}>
                <View
                  style={[
                    pr.progressFill,
                    { width: `${progressPercent}%`, backgroundColor: rankColors.text },
                  ]}
                />
              </View>
              <Text style={pr.progressText}>
                {pointsToNext.toLocaleString()} pts to {nextTierInfo.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Badges Section ──────────────────────────────────────── */}
      {allTiers.length > 0 && (
        <>
          <View style={pr.sectionHeader}>
            <Text style={pr.sectionTitle}>Badges Earned</Text>
            <Text style={pr.sectionSub}>
              {earnedBadges.length} of {RANK_TIERS.length}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={pr.badgesRow}
          >
            {earnedBadges.map((tier) => (
              <BadgePill key={tier} tier={tier} />
            ))}
            {lockedBadges.slice(0, 6).map((t) => (
              <BadgePill key={t.tier} tier={t.tier} isLocked />
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Rank History Chart ──────────────────────────────────── */}
      {rankHistory.length > 0 && (
        <>
          <View style={pr.sectionHeader}>
            <Text style={pr.sectionTitle}>Rank History</Text>
          </View>
          <View style={pr.rankHistoryCard}>
            <RankHistoryChart history={rankHistory} />
          </View>
        </>
      )}

      {/* ── Golf Moods ──────────────────────────────────────────── */}
      {(profile.moodPreferences?.length ?? 0) > 0 && (
        <View style={pr.moodsSection}>
          <Text style={pr.sectionTitle}>Golf Moods</Text>
          <View style={pr.moodsGrid}>
            {(profile.moodPreferences as MoodKey[]).map((key) => {
              const mood = MOODS.find((m) => m.key === key);
              return (
                <View key={key} style={pr.moodChip}>
                  <Text style={pr.moodChipText}>{mood ? `${mood.emoji} ${mood.label}` : key}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Recent Rounds Grid ──────────────────────────────────── */}
      <View style={pr.sectionHeader}>
        <Text style={pr.sectionTitle}>Recent Rounds</Text>
        {sharedRounds.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/rounds')}>
            <Text style={pr.sectionLink}>View all →</Text>
          </TouchableOpacity>
        )}
      </View>
      {sharedRounds.length > 0 ? (
        <View style={pr.postsGrid}>
          {sharedRounds.map((post) => (
            <PostCell key={post.id} post={post} />
          ))}
        </View>
      ) : (
        <View style={pr.emptyRounds}>
          <Text style={pr.emptyRoundsText}>
            Complete and share rounds to see them here.
          </Text>
        </View>
      )}

      {/* ── Sign Out Button ─────────────────────────────────────── */}
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
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: PRIMARY_GREEN,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 28, color: '#fff', fontWeight: '800' },
  rankRing: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankRingIcon: { fontSize: 16 },
  headerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#111' },
  profileUsername: { fontSize: 13, color: '#9ca3af', marginTop: 2, fontWeight: '500' },
  privateBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateBadgeText: { fontSize: 13 },
  handicapText: { fontSize: 13, color: PRIMARY_GREEN, fontWeight: '700', marginTop: 4 },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },

  // Bio
  bioSection: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#f3f4f6' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: '500' },

  // Current rank card
  currentRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 16,
  },
  rankCardLeft: { alignItems: 'center', justifyContent: 'center' },
  rankCardIcon: { fontSize: 40 },
  rankCardCenter: { flex: 1 },
  rankLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  rankTierName: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  rankPts: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  progressContainer: { marginTop: 10 },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 10, color: '#6b7280', marginTop: 4, fontWeight: '500' },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  sectionSub: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  sectionLink: { fontSize: 13, color: PRIMARY_GREEN, fontWeight: '700' },

  // Badges
  badgesRow: { paddingLeft: 16, paddingRight: 8, paddingBottom: 4, gap: 8 },

  // Rank history
  rankHistoryCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },

  // Moods
  moodsSection: { paddingHorizontal: 16, marginTop: 8, marginBottom: 12 },
  moodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  moodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: PRIMARY_GREEN,
  },
  moodChipText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // Posts grid
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  emptyRounds: { paddingHorizontal: 16, paddingVertical: 12 },
  emptyRoundsText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },

  // Sign out
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 28,
    marginBottom: 20,
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
  badgeDate: { fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: '500' },
  badgeLocked: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  badgeLabelLocked: { fontSize: 11, fontWeight: '600', color: '#d1d5db', marginTop: 4 },
  badgeDateLocked: { fontSize: 10, color: '#d1d5db', marginTop: 2, fontWeight: '500' },
});

const p = StyleSheet.create({
  cell: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 10,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cellScore: { fontSize: 20, fontWeight: '900' },
  cellTotal: { fontSize: 28, fontWeight: '900', color: '#111', lineHeight: 30 },
  cellCourse: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  cellDate: { fontSize: 10, color: '#d1d5db', fontWeight: '600' },
});

const e = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
    paddingBottom: 48,
  },
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
  moodChipSelected: { backgroundColor: PRIMARY_GREEN, borderColor: PRIMARY_GREEN },
  moodChipText: { fontSize: 13, color: '#444' },
  moodChipTextSelected: { color: '#fff', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  textBtn: { alignItems: 'center', paddingVertical: 8 },
  textBtnText: { color: PRIMARY_GREEN, fontSize: 15 },
});
