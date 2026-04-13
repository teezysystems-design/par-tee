import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { RANK_TIERS } from '@par-tee/shared/types';
import { RANK_COLORS } from '@par-tee/shared/colors';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const COLORS = {
  primary: '#1B6B3A',
  primaryLight: '#e8f5ee',
  gold: '#FFD700',
  white: '#fff',
  gray50: '#f7f7f7',
  gray100: '#f0f0f0',
  gray600: '#666',
  gray900: '#111',
  border: '#e0e0e0',
  birdie: '#1B6B3A',
  bogey: '#DC2626',
  eagle: '#0077B6',
};

const GAME_MODE_LABELS: Record<string, string> = {
  casual: '😎 Casual',
  solo: '🏌️ Solo',
  match_1v1: '⚔️ 1v1 Match',
  match_2v2: '🤝 2v2 Scramble',
  tournament: '🏆 Tournament',
};

interface HoleScore {
  userId: string;
  holeNumber: number;
  strokes: number;
  par: number | null;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
  putts: number | null;
  name: string | null;
}

interface PlayerSummary {
  userId: string;
  name: string;
  holes: (number | null)[];
  pars: (number | null)[];
  total: number;
  scoreToPar: number | null;
  fairwayPct: number | null;
  girPct: number | null;
  avgPutts: number | null;
  birdies: number;
  bogeys: number;
  pars_count: number;
}

interface PartyResult {
  userId: string;
  pointsEarned: number;
  totalStrokes: number;
}

function buildPlayerSummaries(scores: HoleScore[]): PlayerSummary[] {
  const byPlayer: Record<string, PlayerSummary> = {};
  for (const s of scores) {
    if (!byPlayer[s.userId]) {
      byPlayer[s.userId] = {
        userId: s.userId,
        name: s.name ?? 'Unknown',
        holes: Array(18).fill(null),
        pars: Array(18).fill(null),
        total: 0,
        scoreToPar: null,
        fairwayPct: null,
        girPct: null,
        avgPutts: null,
        birdies: 0,
        bogeys: 0,
        pars_count: 0,
      };
    }
    const p = byPlayer[s.userId];
    p.holes[s.holeNumber - 1] = s.strokes;
    p.pars[s.holeNumber - 1] = s.par;
    p.total += s.strokes;
  }

  // Calculate stats
  for (const p of Object.values(byPlayer)) {
    let parSum = 0, parCount = 0, fwHit = 0, fwTotal = 0, girHit = 0, girTotal = 0, puttsSum = 0, puttsCount = 0;
    for (let i = 0; i < 18; i++) {
      const strokes = p.holes[i];
      const par = p.pars[i];
      if (strokes == null) continue;
      if (par != null) {
        parSum += par;
        parCount++;
        const diff = strokes - par;
        if (diff < 0) p.birdies++;
        else if (diff === 0) p.pars_count++;
        else if (diff > 0) p.bogeys++;
      }
    }
    // Match with original scores for fairway/GIR/putts
    const playerScores = scores.filter((s) => s.userId === p.userId);
    for (const s of playerScores) {
      if (s.fairwayHit != null) { fwTotal++; if (s.fairwayHit) fwHit++; }
      if (s.greenInRegulation != null) { girTotal++; if (s.greenInRegulation) girHit++; }
      if (s.putts != null) { puttsSum += s.putts; puttsCount++; }
    }
    p.scoreToPar = parCount > 0 ? p.total - parSum : null;
    p.fairwayPct = fwTotal > 0 ? Math.round((fwHit / fwTotal) * 100) : null;
    p.girPct = girTotal > 0 ? Math.round((girHit / girTotal) * 100) : null;
    p.avgPutts = puttsCount > 0 ? Number((puttsSum / puttsCount).toFixed(1)) : null;
  }

  return Object.values(byPlayer).sort((a, b) => a.total - b.total);
}

export default function RoundSummaryScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [scores, setScores] = useState<HoleScore[]>([]);
  const [party, setParty] = useState<{ gameMode: string; status: string } | null>(null);
  const [results, setResults] = useState<PartyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const celebrateAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(
    async (silent = false) => {
      if (!session || !partyId) return;
      if (!silent) setLoading(true);
      try {
        const [scoresRes, partyRes] = await Promise.all([
          fetch(`${API_URL}/v1/parties/${partyId}/scores`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${API_URL}/v1/parties/${partyId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        if (scoresRes.ok) {
          const json = await scoresRes.json();
          setScores(json.data ?? []);
        }
        if (partyRes.ok) {
          const json = await partyRes.json();
          setParty({ gameMode: json.data?.gameMode, status: json.data?.status });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session, partyId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loading && scores.length > 0) {
      Animated.spring(celebrateAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    }
  }, [loading, scores.length]);

  const handleDone = async () => {
    if (!session) { router.replace('/(tabs)'); return; }
    try {
      const res = await fetch(`${API_URL}/v1/rankings/check-rankup`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.rankedUp) {
          router.replace({
            pathname: '/rankup/index',
            params: {
              fromTier: json.data.fromTier,
              toTier: json.data.toTier,
              points: json.data.newPoints?.toString() ?? '0',
              pointsEarned: json.data.pointsEarned?.toString() ?? '0',
            },
          });
          return;
        }
      }
    } catch {}
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const players = buildPlayerSummaries(scores);
  const holesPlayed = players.length > 0
    ? Math.max(...players.map((p) => p.holes.filter((h) => h != null).length))
    : 0;
  const isCompleted = party?.status === 'completed';
  const gameMode = party?.gameMode ?? 'casual';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={COLORS.primary} />
      }
    >
      {/* Header */}
      <Animated.View style={{ transform: [{ scale: celebrateAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }], opacity: celebrateAnim }}>
        <Text style={styles.heading}>{isCompleted ? 'Round Complete!' : 'Round Summary'}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{GAME_MODE_LABELS[gameMode] ?? gameMode}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{holesPlayed} hole{holesPlayed !== 1 ? 's' : ''}</Text>
        </View>
      </Animated.View>

      {/* Leaderboard */}
      {players.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>No scores recorded yet</Text>
        </View>
      ) : (
        players.map((player, idx) => {
          const result = results.find((r) => r.userId === player.userId);
          return (
            <View key={player.userId} style={[styles.playerCard, idx === 0 && styles.playerCardFirst]}>
              <View style={styles.rank}>
                <Text style={[styles.rankText, idx === 0 && styles.rankTextFirst]}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </Text>
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <View style={styles.statsRow}>
                  {player.scoreToPar != null && (
                    <Text style={[styles.statChip, player.scoreToPar < 0 && { color: COLORS.birdie }, player.scoreToPar > 0 && { color: COLORS.bogey }]}>
                      {player.scoreToPar === 0 ? 'E' : player.scoreToPar > 0 ? `+${player.scoreToPar}` : player.scoreToPar}
                    </Text>
                  )}
                  {player.birdies > 0 && <Text style={styles.statChip}>🐦 {player.birdies}</Text>}
                  {player.fairwayPct != null && <Text style={styles.statChip}>🎯 {player.fairwayPct}%</Text>}
                  {player.avgPutts != null && <Text style={styles.statChip}>🏌️ {player.avgPutts}</Text>}
                </View>
              </View>
              <View style={styles.scoreCol}>
                <Text style={[styles.totalScore, idx === 0 && styles.totalScoreFirst]}>{player.total}</Text>
                {result && result.pointsEarned > 0 && (
                  <Text style={styles.pointsEarned}>+{result.pointsEarned} pts</Text>
                )}
              </View>
            </View>
          );
        })
      )}

      {/* Detailed stats table */}
      {players.length > 0 && (
        <>
          <Text style={[styles.heading, { fontSize: 18, marginTop: 28 }]}>Stats Breakdown</Text>
          {players.map((player) => (
            <View key={player.userId} style={styles.statsCard}>
              <Text style={styles.statsCardName}>{player.name}</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>{player.total}</Text>
                  <Text style={styles.statBoxLabel}>Total</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxValue, player.scoreToPar != null && player.scoreToPar < 0 && { color: COLORS.birdie }, player.scoreToPar != null && player.scoreToPar > 0 && { color: COLORS.bogey }]}>
                    {player.scoreToPar == null ? '—' : player.scoreToPar === 0 ? 'E' : player.scoreToPar > 0 ? `+${player.scoreToPar}` : player.scoreToPar}
                  </Text>
                  <Text style={styles.statBoxLabel}>To Par</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>{player.fairwayPct != null ? `${player.fairwayPct}%` : '—'}</Text>
                  <Text style={styles.statBoxLabel}>FW%</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>{player.girPct != null ? `${player.girPct}%` : '—'}</Text>
                  <Text style={styles.statBoxLabel}>GIR%</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>{player.avgPutts ?? '—'}</Text>
                  <Text style={styles.statBoxLabel}>Avg Putts</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxValue, { color: COLORS.birdie }]}>{player.birdies}</Text>
                  <Text style={styles.statBoxLabel}>Birdies</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Hole-by-hole scorecard */}
      {players.length > 0 && (
        <>
          <Text style={[styles.heading, { fontSize: 18, marginTop: 28 }]}>Scorecard</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header row */}
              <View style={styles.scorecardRow}>
                <Text style={[styles.scorecardCell, styles.scorecardName]}>Player</Text>
                {Array.from({ length: 18 }, (_, i) => (
                  <Text key={i} style={[styles.scorecardCell, styles.scorecardHole]}>{i + 1}</Text>
                ))}
                <Text style={[styles.scorecardCell, styles.scorecardTotal]}>Tot</Text>
              </View>
              {/* Player rows */}
              {players.map((player, idx) => (
                <View key={player.userId} style={[styles.scorecardRow, idx % 2 === 1 && styles.scorecardRowAlt]}>
                  <Text style={[styles.scorecardCell, styles.scorecardName]} numberOfLines={1}>
                    {player.name.split(' ')[0]}
                  </Text>
                  {Array.from({ length: 18 }, (_, i) => {
                    const strokes = player.holes[i];
                    const par = player.pars[i];
                    const diff = strokes != null && par != null ? strokes - par : null;
                    const cellColor = diff == null ? COLORS.gray600 : diff < 0 ? COLORS.birdie : diff === 0 ? COLORS.gray900 : COLORS.bogey;
                    return (
                      <Text key={i} style={[styles.scorecardCell, styles.scorecardHole, { color: cellColor, fontWeight: diff != null && diff !== 0 ? '700' : '400' }]}>
                        {strokes ?? '—'}
                      </Text>
                    );
                  })}
                  <Text style={[styles.scorecardCell, styles.scorecardTotal, { fontWeight: '700' }]}>
                    {player.total || '—'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* Points earned banner (for completed rounds with non-casual mode) */}
      {isCompleted && gameMode !== 'casual' && (
        <View style={styles.pointsBanner}>
          <Text style={styles.pointsBannerIcon}>⭐</Text>
          <View style={styles.pointsBannerText}>
            <Text style={styles.pointsBannerTitle}>Ranking Points Earned!</Text>
            <Text style={styles.pointsBannerSub}>
              {gameMode === 'match_1v1' ? '1.5×' : gameMode === 'match_2v2' ? '1.3×' : gameMode === 'tournament' ? '2×' : '1×'} multiplier applied
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, fontWeight: '800', color: COLORS.gray900, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  metaText: { fontSize: 14, color: COLORS.gray600 },
  metaDot: { fontSize: 14, color: COLORS.gray600 },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: COLORS.gray600 },

  // Leaderboard
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  playerCardFirst: { borderColor: COLORS.gold, backgroundColor: '#fffbeb' },
  rank: { width: 36, alignItems: 'center' },
  rankText: { fontSize: 22 },
  rankTextFirst: { fontSize: 28 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '600', color: COLORS.gray900 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  statChip: { fontSize: 12, color: COLORS.gray600, fontWeight: '500' },
  scoreCol: { alignItems: 'flex-end' },
  totalScore: { fontSize: 24, fontWeight: '800', color: COLORS.gray900 },
  totalScoreFirst: { color: COLORS.gold },
  pointsEarned: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 2 },

  // Stats card
  statsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsCardName: { fontSize: 15, fontWeight: '700', color: COLORS.gray900, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: {
    width: '30%',
    backgroundColor: COLORS.gray50,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statBoxValue: { fontSize: 18, fontWeight: '800', color: COLORS.gray900 },
  statBoxLabel: { fontSize: 11, color: COLORS.gray600, fontWeight: '500', marginTop: 4 },

  // Scorecard table
  scorecardRow: { flexDirection: 'row', alignItems: 'center' },
  scorecardRowAlt: { backgroundColor: COLORS.gray100 },
  scorecardCell: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 8,
    color: COLORS.gray900,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scorecardName: { width: 70, textAlign: 'left', paddingLeft: 8, fontWeight: '600' },
  scorecardHole: { width: 32, color: COLORS.gray600 },
  scorecardTotal: { width: 40, fontWeight: '600', color: COLORS.primary },

  // Points banner
  pointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF0',
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  pointsBannerIcon: { fontSize: 28 },
  pointsBannerText: { flex: 1 },
  pointsBannerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },
  pointsBannerSub: { fontSize: 13, color: COLORS.gray600, marginTop: 2 },

  doneBtn: {
    marginTop: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
