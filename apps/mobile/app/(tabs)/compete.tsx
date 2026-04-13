import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import type { RankTier } from '@par-tee/shared/types';
import { RANK_TIERS } from '@par-tee/shared/types';
import { RANK_COLORS } from '@par-tee/shared/colors';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

// ─── Sub-components ────────────────────────────────────────────────────────

function RankBadge({ tier, size = 'md' }: { tier: RankTier; size?: 'sm' | 'md' | 'lg' }) {
  const info = RANK_TIERS.find((r) => r.tier === tier);
  const colors = RANK_COLORS[tier] ?? RANK_COLORS.bronze_1;
  const dim = size === 'lg' ? 72 : size === 'md' ? 48 : 32;
  const iconSize = size === 'lg' ? 28 : size === 'md' ? 20 : 14;
  const labelSize = size === 'lg' ? 13 : size === 'md' ? 11 : 9;
  return (
    <View
      style={[
        styles.badge,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          shadowColor: colors.glow,
        },
      ]}
    >
      <Text style={{ fontSize: iconSize }}>{info?.icon ?? '🥉'}</Text>
      {size !== 'sm' && (
        <Text style={[styles.badgeLabel, { color: colors.text, fontSize: labelSize }]}>
          {info?.label}
        </Text>
      )}
    </View>
  );
}

function RankProgressBar({ tier, points }: { tier: RankTier; points: number }) {
  const info = RANK_TIERS.find((r) => r.tier === tier);
  if (!info) return null;
  const { minPoints, maxPoints } = info;
  const range = maxPoints != null ? maxPoints - minPoints : 1000;
  const progress = Math.min((points - minPoints) / range, 1);
  const nextTier = RANK_TIERS.find((r) => r.minPoints === (maxPoints != null ? maxPoints + 1 : null));
  const nextTierByIdx = RANK_TIERS[RANK_TIERS.indexOf(info) + 1];

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>{info.label}</Text>
        {nextTierByIdx && <Text style={styles.progressLabel}>{nextTierByIdx.label}</Text>}
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress * 100}%` as `${number}%`,
              backgroundColor: (RANK_COLORS[tier] ?? RANK_COLORS.bronze_1).border,
            },
          ]}
        />
      </View>
      <Text style={styles.progressPoints}>
        {points.toLocaleString()} pts
        {maxPoints != null && nextTierByIdx && ` · ${(maxPoints + 1 - points).toLocaleString()} to ${nextTierByIdx.label}`}
      </Text>
    </View>
  );
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  username: string | null;
  avatarUrl: string | null;
  tier: RankTier;
  points: number;
  wins: number;
  losses: number;
  avgScore: number | null;
  roundsPlayed: number;
}

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const colors = RANK_COLORS[entry.tier] ?? RANK_COLORS.bronze_1;
  return (
    <View style={[styles.row, isMe && styles.rowHighlight]}>
      <Text style={[styles.rowRank, isMe && { color: PRIMARY }]}>
        {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
      </Text>
      <View
        style={[styles.rowAvatar, { backgroundColor: colors.bg, borderColor: colors.border }]}
      >
        <Text style={{ fontSize: 13 }}>{entry.userName.charAt(0)}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, isMe && { color: PRIMARY, fontWeight: '700' }]}>
          {entry.userName}
        </Text>
        <Text style={styles.rowSub}>
          {entry.roundsPlayed} rounds · {entry.wins}W
          {entry.avgScore != null ? ` · avg ${entry.avgScore.toFixed(1)}` : ''}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowPoints, { color: colors.text }]}>
          {entry.points.toLocaleString()}
        </Text>
        <RankBadge tier={entry.tier} size="sm" />
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

type Tab = 'main' | '1v1' | '2v2';

export default function CompeteScreen() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('main');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<{ tier: RankTier; points: number; rank: number | null; roundsPlayed: number; wins: number }>({
    tier: 'bronze_1',
    points: 0,
    rank: null,
    roundsPlayed: 0,
    wins: 0,
  });
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  const fetchData = useCallback(async (tab: Tab) => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [lbRes, meRes] = await Promise.all([
        fetch(`${API_URL}/v1/rankings/leaderboard?type=${tab}&limit=50`, { headers }),
        fetch(`${API_URL}/v1/rankings/me?type=${tab}`, { headers }),
      ]);
      if (lbRes.ok) {
        const json = await lbRes.json();
        setEntries(json.data ?? []);
      }
      if (meRes.ok) {
        const json = await meRes.json();
        const d = json.data;
        setMyRank({
          tier: d?.tier ?? 'bronze_1',
          points: d?.points ?? 0,
          rank: d?.rank ?? null,
          roundsPlayed: d?.roundsPlayed ?? 0,
          wins: d?.wins ?? 0,
        });
      }

      // Get profile ID for highlighting
      const profileRes = await fetch(`${API_URL}/v1/users/me`, { headers });
      if (profileRes.ok) {
        const pj = await profileRes.json();
        setMyProfileId(pj.data?.id ?? null);
      }
    } catch {
      // Network unavailable — keep existing data
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { fetchData(activeTab); }, [activeTab, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(activeTab);
    setRefreshing(false);
  }, [activeTab, fetchData]);

  const tabLabels: { id: Tab; label: string }[] = [
    { id: 'main', label: 'Global' },
    { id: '1v1',  label: '1v1' },
    { id: '2v2',  label: '2v2' },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Compete</Text>
      </View>

      {/* My Rank Card */}
      <View style={styles.myRankCard}>
        <View style={styles.myRankLeft}>
          <RankBadge tier={myRank.tier} size="lg" />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.myRankTitle}>Your Rank</Text>
            <Text style={styles.myRankPos}>
              {myRank.rank != null ? `#${myRank.rank} globally` : 'Unranked'}
            </Text>
            <Text style={styles.myRankStats}>
              {myRank.roundsPlayed} rounds · {myRank.wins} wins
            </Text>
            <RankProgressBar tier={myRank.tier} points={myRank.points} />
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: '#fff7ed', borderColor: '#fb923c' }]}
          onPress={() => router.push('/leagues' as never)}
          activeOpacity={0.8}
        >
          <Text style={styles.quickIcon}>🏅</Text>
          <Text style={styles.quickLabel}>Leagues</Text>
          <Text style={styles.quickSub}>Join a league</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}
          onPress={() => router.push('/tournaments' as never)}
          activeOpacity={0.8}
        >
          <Text style={styles.quickIcon}>🎖️</Text>
          <Text style={styles.quickLabel}>Tournaments</Text>
          <Text style={styles.quickSub}>View upcoming</Text>
        </TouchableOpacity>
      </View>

      {/* Leaderboard */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leaderboard</Text>

        {/* Tab Switcher */}
        <View style={styles.tabs}>
          {tabLabels.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.id)}
            >
              <Text style={[styles.tabBtnText, activeTab === t.id && styles.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 32 }} />
        ) : entries.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🏌️</Text>
            <Text style={styles.emptyText}>No rankings yet</Text>
            <Text style={styles.emptySub}>Play rounds to earn points and climb the leaderboard!</Text>
          </View>
        ) : (
          <View style={styles.table}>
            {entries.map((entry) => (
              <LeaderboardRow
                key={`${entry.userId}-${entry.rank}`}
                entry={entry}
                isMe={entry.userId === myProfileId}
              />
            ))}
          </View>
        )}
      </View>

      {/* Rank Tiers Reference */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All 18 Rank Tiers</Text>
        <Text style={styles.sectionSub}>Earn points by playing rounds. Mode multipliers: Solo 1×, 1v1 1.5×, 2v2 1.3×, Tournament 2×</Text>
        <View style={styles.tiersGrid}>
          {RANK_TIERS.map((info) => {
            const colors = RANK_COLORS[info.tier] ?? RANK_COLORS.bronze_1;
            const isCurrentTier = info.tier === myRank.tier;
            return (
              <View
                key={info.tier}
                style={[
                  styles.tierChip,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                  isCurrentTier && styles.tierChipCurrent,
                ]}
              >
                <Text style={{ fontSize: 16 }}>{info.icon}</Text>
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[styles.tierLabel, { color: colors.text }]}>{info.label}</Text>
                  <Text style={styles.tierPts}>
                    {info.minPoints.toLocaleString()}
                    {info.maxPoints != null ? `–${info.maxPoints.toLocaleString()}` : '+'} pts
                  </Text>
                </View>
                {isCurrentTier && (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>YOU</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111' },

  // My rank card
  myRankCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  myRankLeft: { flexDirection: 'row', alignItems: 'center' },
  myRankTitle: { fontSize: 12, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 },
  myRankPos: { fontSize: 22, fontWeight: '800', color: '#111', marginVertical: 2 },
  myRankStats: { fontSize: 12, color: '#6b7280', marginBottom: 4 },

  // Badge
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 4,
  },
  badgeLabel: { fontWeight: '700', marginTop: 1 },

  // Progress
  progressContainer: { marginTop: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  progressTrack: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    marginVertical: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },
  progressPoints: { fontSize: 11, color: '#6b7280' },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 12,
  },
  quickCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  quickIcon: { fontSize: 24, marginBottom: 6 },
  quickLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  quickSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Section
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#9ca3af', marginBottom: 12, lineHeight: 16 },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 4 },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    marginTop: 8,
  },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2 },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabBtnTextActive: { color: '#111' },

  // Table rows
  table: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 10,
  },
  rowHighlight: { backgroundColor: '#e8f5ee' },
  rowRank: { width: 28, fontSize: 14, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#111' },
  rowSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowPoints: { fontSize: 14, fontWeight: '700' },

  // Rank tiers grid
  tiersGrid: { gap: 8 },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  tierChipCurrent: {
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  tierLabel: { fontSize: 14, fontWeight: '700' },
  tierPts: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  youBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  youBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
