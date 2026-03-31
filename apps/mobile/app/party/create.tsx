import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const COLORS = {
  primary: '#1a7f4b',
  primaryLight: '#e8f5ee',
  white: '#fff',
  gray50: '#f7f7f7',
  gray100: '#f0f0f0',
  gray600: '#666',
  gray900: '#111',
  border: '#e0e0e0',
};

type GameMode = 'chill' | 'fun' | 'competitive';
type ChallengeType = 'none' | 'head_to_head' | 'scramble_2v2';

const GAME_MODES: { value: GameMode; label: string; emoji: string; desc: string }[] = [
  { value: 'chill', label: 'Chill', emoji: '😎', desc: 'Casual round — no ranking impact' },
  { value: 'fun', label: 'Fun', emoji: '🎉', desc: 'Counts toward ranking, relaxed vibe' },
  { value: 'competitive', label: 'Competitive', emoji: '🏆', desc: 'Full competitive mode, ranking counted' },
];

const CHALLENGE_TYPES: { value: ChallengeType; label: string; emoji: string; desc: string }[] = [
  { value: 'none', label: 'No Challenge', emoji: '⛳', desc: 'Standard stroke play' },
  { value: 'head_to_head', label: '1v1', emoji: '⚔️', desc: 'Head-to-head, hole-by-hole scoring' },
  { value: 'scramble_2v2', label: '2v2 Scramble', emoji: '🤝', desc: 'Team format, best ball' },
];

export default function CreatePartyScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [gameMode, setGameMode] = useState<GameMode>('fun');
  const [challengeType, setChallengeType] = useState<ChallengeType>('none');
  const [loading, setLoading] = useState(false);

  const createParty = async () => {
    if (!session || !bookingId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/parties`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId, gameMode, challengeType }),
      });
      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Error', json.error?.message ?? 'Could not create party');
        return;
      }
      router.replace({ pathname: '/party/[partyId]/index', params: { partyId: json.data.id } });
    } catch {
      Alert.alert('Error', 'Could not create party. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Game Mode</Text>
      <Text style={styles.sectionSub}>How seriously are you playing today?</Text>
      <View style={styles.optionGroup}>
        {GAME_MODES.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.optionCard, gameMode === m.value && styles.optionCardSelected]}
            onPress={() => setGameMode(m.value)}
            activeOpacity={0.8}
          >
            <Text style={styles.optionEmoji}>{m.emoji}</Text>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, gameMode === m.value && styles.optionLabelSelected]}>
                {m.label}
              </Text>
              <Text style={styles.optionDesc}>{m.desc}</Text>
            </View>
            {gameMode === m.value && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Challenge Format</Text>
      <Text style={styles.sectionSub}>Optional head-to-head format</Text>
      <View style={styles.optionGroup}>
        {CHALLENGE_TYPES.map((ct) => (
          <TouchableOpacity
            key={ct.value}
            style={[styles.optionCard, challengeType === ct.value && styles.optionCardSelected]}
            onPress={() => setChallengeType(ct.value)}
            activeOpacity={0.8}
          >
            <Text style={styles.optionEmoji}>{ct.emoji}</Text>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, challengeType === ct.value && styles.optionLabelSelected]}>
                {ct.label}
              </Text>
              <Text style={styles.optionDesc}>{ct.desc}</Text>
            </View>
            {challengeType === ct.value && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.createBtn, loading && { opacity: 0.6 }]}
        onPress={createParty}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.createBtnText}>Create Party →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray900, marginBottom: 4 },
  sectionSub: { fontSize: 14, color: COLORS.gray600, marginBottom: 16 },
  optionGroup: { gap: 10 },
  optionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    gap: 12,
  },
  optionCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionEmoji: { fontSize: 28 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.gray900 },
  optionLabelSelected: { color: COLORS.primary },
  optionDesc: { fontSize: 13, color: COLORS.gray600, marginTop: 2 },
  checkmark: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  createBtn: {
    marginTop: 36,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
