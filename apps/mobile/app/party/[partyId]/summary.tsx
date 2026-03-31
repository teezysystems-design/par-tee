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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const COLORS = {
  primary: '#1a7f4b',
  primaryLight: '#e8f5ee',
  gold: '#f59e0b',
  white: '#fff',
  gray50: '#f7f7f7',
  gray100: '#f0f0f0',
  gray600: '#666',
  gray900: '#111',
  border: '#e0e0e0',
};

interface HoleScore {
  userId: string;
  holeNumber: number;
  strokes: number;
  name: string | null;
}

interface PlayerSummary {
  userId: string;
  name: string;
  holes: number[];
  total: number;
}

function buildPlayerSummaries(scores: HoleScore[]): PlayerSummary[] {
  const byPlayer: Record<string, PlayerSummary> = {};
  for (const s of scores) {
    if (!byPlayer[s.userId]) {
      byPlayer[s.userId] = { userId: s.userId, name: s.name ?? 'Unknown', holes: [], total: 0 };
    }
    byPlayer[s.userId].holes[s.holeNumber - 1] = s.strokes;
    byPlayer[s.userId].total += s.strokes;
  }
  return Object.values(byPlayer).sort((a, b) => a.total - b.total);
}

export default function RoundSummaryScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [scores, setScores] = useState<HoleScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScores = useCallback(
    async (silent = false) => {
      if (!session || !partyId) return;
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`${API_URL}/v1/parties/${partyId}/scores`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (res.ok) setScores(json.data ?? []);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session, partyId]
  );

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const players = buildPlayerSummaries(scores);
  const holesPlayed = players.length > 0
    ? Math.max(...players.map((p) => p.holes.filter(Boolean).length))
    : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchScores(true); }}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Leaderboard */}
      <Text style={styles.heading}>Leaderboard</Text>
      <Text style={styles.sub}>{holesPlayed} hole{holesPlayed !== 1 ? 's' : ''} played</Text>

      {players.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>No scores recorded yet</Text>
        </View>
      ) : (
        players.map((player, idx) => (
          <View key={player.userId} style={[styles.playerCard, idx === 0 && styles.playerCardFirst]}>
            <View style={styles.rank}>
              <Text style={[styles.rankText, idx === 0 && styles.rankTextFirst]}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
              </Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.holesText}>
                {player.holes.filter(Boolean).length} / 18 holes
              </Text>
            </View>
            <Text style={[styles.totalScore, idx === 0 && styles.totalScoreFirst]}>
              {player.total}
            </Text>
          </View>
        ))
      )}

      {/* Hole-by-hole scorecard */}
      {players.length > 0 && (
        <>
          <Text style={[styles.heading, { marginTop: 32 }]}>Scorecard</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header row */}
              <View style={styles.scorecardRow}>
                <Text style={[styles.scorecardCell, styles.scorecardName]}>Player</Text>
                {Array.from({ length: 18 }, (_, i) => (
                  <Text key={i} style={[styles.scorecardCell, styles.scorecardHole]}>
                    {i + 1}
                  </Text>
                ))}
                <Text style={[styles.scorecardCell, styles.scorecardTotal]}>Tot</Text>
              </View>
              {/* Player rows */}
              {players.map((player, idx) => (
                <View key={player.userId} style={[styles.scorecardRow, idx % 2 === 1 && styles.scorecardRowAlt]}>
                  <Text style={[styles.scorecardCell, styles.scorecardName]} numberOfLines={1}>
                    {player.name.split(' ')[0]}
                  </Text>
                  {Array.from({ length: 18 }, (_, i) => (
                    <Text key={i} style={[styles.scorecardCell, styles.scorecardHole]}>
                      {player.holes[i] ?? '—'}
                    </Text>
                  ))}
                  <Text style={[styles.scorecardCell, styles.scorecardTotal, { fontWeight: '700' }]}>
                    {player.total || '—'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 20, fontWeight: '700', color: COLORS.gray900, marginBottom: 4 },
  sub: { fontSize: 14, color: COLORS.gray600, marginBottom: 20 },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: COLORS.gray600 },
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
  holesText: { fontSize: 12, color: COLORS.gray600, marginTop: 2 },
  totalScore: { fontSize: 22, fontWeight: '700', color: COLORS.gray900 },
  totalScoreFirst: { color: COLORS.gold },
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
  doneBtn: {
    marginTop: 32,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
