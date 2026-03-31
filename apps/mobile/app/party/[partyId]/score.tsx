import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const COLORS = {
  primary: '#1a7f4b',
  primaryLight: '#e8f5ee',
  white: '#fff',
  gray50: '#f7f7f7',
  gray100: '#f0f0f0',
  gray400: '#aaa',
  gray600: '#666',
  gray900: '#111',
  border: '#e0e0e0',
};

const TOTAL_HOLES = 18;

export default function ScoreEntryScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  // Initialize all 18 holes with empty string
  const [scores, setScores] = useState<string[]>(Array(TOTAL_HOLES).fill(''));
  const [saving, setSaving] = useState(false);

  const setHoleScore = (index: number, value: string) => {
    const updated = [...scores];
    updated[index] = value.replace(/[^0-9]/g, '').slice(0, 2);
    setScores(updated);
  };

  const filledCount = scores.filter((s) => s !== '' && Number(s) >= 1).length;
  const totalStrokes = scores.reduce((sum, s) => sum + (Number(s) || 0), 0);

  const saveScores = async () => {
    if (!session || !partyId) return;

    const scoresToSubmit = scores
      .map((s, i) => ({ holeNumber: i + 1, strokes: Number(s) }))
      .filter((s) => s.strokes >= 1 && s.strokes <= 20);

    if (scoresToSubmit.length === 0) {
      Alert.alert('No scores', 'Enter at least one hole score before saving.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/parties/${partyId}/scores`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scores: scoresToSubmit }),
      });
      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Error', json.error?.message ?? 'Could not save scores');
        return;
      }
      Alert.alert('Scores saved!', `${scoresToSubmit.length} hole(s) saved.`, [
        {
          text: 'View Summary',
          onPress: () =>
            router.replace({ pathname: '/party/[partyId]/summary', params: { partyId } }),
        },
        { text: 'Continue Scoring', style: 'cancel' },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save scores');
    } finally {
      setSaving(false);
    }
  };

  const finishRound = async () => {
    if (!session || !partyId) return;
    // Save scores first, then mark party complete
    const scoresToSubmit = scores
      .map((s, i) => ({ holeNumber: i + 1, strokes: Number(s) }))
      .filter((s) => s.strokes >= 1 && s.strokes <= 20);

    setSaving(true);
    try {
      if (scoresToSubmit.length > 0) {
        await fetch(`${API_URL}/v1/parties/${partyId}/scores`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scores: scoresToSubmit }),
        });
      }
      await fetch(`${API_URL}/v1/parties/${partyId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      router.replace({ pathname: '/party/[partyId]/summary', params: { partyId } });
    } catch {
      Alert.alert('Error', 'Could not finish round');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Progress bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {filledCount} / {TOTAL_HOLES} holes entered
          </Text>
          <Text style={styles.progressText}>Total: {totalStrokes}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(filledCount / TOTAL_HOLES) * 100}%` }]} />
        </View>

        {/* Hole grid */}
        <View style={styles.grid}>
          {Array.from({ length: TOTAL_HOLES }, (_, i) => (
            <View key={i} style={styles.holeCell}>
              <Text style={styles.holeLabel}>H{i + 1}</Text>
              <TextInput
                style={[
                  styles.holeInput,
                  scores[i] !== '' && Number(scores[i]) >= 1 && styles.holeInputFilled,
                ]}
                value={scores[i]}
                onChangeText={(v) => setHoleScore(i, v)}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="—"
                placeholderTextColor={COLORS.gray400}
                selectTextOnFocus
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={saveScores}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Progress</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.finishBtn, saving && { opacity: 0.6 }]}
          onPress={finishRound}
          disabled={saving}
        >
          <Text style={styles.finishBtnText}>Finish Round →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20, paddingBottom: 120 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 13, color: COLORS.gray600, fontWeight: '500' },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.gray100,
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
  },
  holeCell: { width: '17%', alignItems: 'center', gap: 4 },
  holeLabel: { fontSize: 12, color: COLORS.gray600, fontWeight: '600' },
  holeInput: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  holeInputFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    gap: 12,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: COLORS.gray100,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: COLORS.gray900, fontSize: 15, fontWeight: '600' },
  finishBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
