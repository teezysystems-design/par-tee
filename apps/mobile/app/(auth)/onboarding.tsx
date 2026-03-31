import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const MOODS = [
  { key: 'relaxed', label: '😌 Relaxed' },
  { key: 'competitive', label: '🏆 Competitive' },
  { key: 'social', label: '👥 Social' },
  { key: 'scenic', label: '🌅 Scenic' },
  { key: 'beginner', label: '🌱 Beginner-friendly' },
  { key: 'advanced', label: '🔥 Advanced' },
  { key: 'fast-paced', label: '⚡ Fast-paced' },
  { key: 'challenging', label: '💪 Challenging' },
] as const;

type MoodKey = (typeof MOODS)[number]['key'];
type Step = 'name' | 'handicap' | 'moods';

export default function OnboardingScreen() {
  const { session } = useAuth();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [handicapInput, setHandicapInput] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<MoodKey[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleMood = (mood: MoodKey) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const handleComplete = async () => {
    if (!session) return;

    const handicap = handicapInput.trim()
      ? parseFloat(handicapInput.trim())
      : null;

    if (handicap !== null && (isNaN(handicap) || handicap < 0 || handicap > 54)) {
      Alert.alert('Invalid handicap', 'Handicap must be between 0 and 54.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          handicap,
          moodPreferences: selectedMoods,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? 'Failed to create profile');
      }

      router.replace('/(tabs)');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setLoading(false);
    }
  };

  const progress = step === 'name' ? 1 : step === 'handicap' ? 2 : 3;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Progress indicator */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map((n) => (
            <View
              key={n}
              style={[styles.progressDot, n <= progress && styles.progressDotActive]}
            />
          ))}
        </View>

        {step === 'name' && (
          <>
            <Text style={styles.emoji}>👋</Text>
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>This is how other golfers will see you</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, !name.trim() && styles.primaryBtnDisabled]}
              onPress={() => {
                if (!name.trim()) {
                  Alert.alert('Name required', 'Please enter your name.');
                  return;
                }
                setStep('handicap');
              }}
              disabled={!name.trim()}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'handicap' && (
          <>
            <Text style={styles.emoji}>⛳</Text>
            <Text style={styles.title}>What's your handicap?</Text>
            <Text style={styles.subtitle}>Optional — helps us match you with the right courses</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 18.4 (leave blank if unsure)"
              placeholderTextColor="#999"
              value={handicapInput}
              onChangeText={setHandicapInput}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('moods')}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textBtn} onPress={() => setStep('name')}>
              <Text style={styles.textBtnText}>← Back</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'moods' && (
          <>
            <Text style={styles.emoji}>🎯</Text>
            <Text style={styles.title}>What's your golf mood?</Text>
            <Text style={styles.subtitle}>Pick all that apply — we'll find courses that match</Text>
            <View style={styles.moodsGrid}>
              {MOODS.map((mood) => {
                const selected = selectedMoods.includes(mood.key);
                return (
                  <TouchableOpacity
                    key={mood.key}
                    style={[styles.moodChip, selected && styles.moodChipSelected]}
                    onPress={() => toggleMood(mood.key)}
                  >
                    <Text style={[styles.moodChipText, selected && styles.moodChipTextSelected]}>
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleComplete}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Start playing →</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.textBtn} onPress={() => setStep('handicap')}>
              <Text style={styles.textBtnText}>← Back</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ddd',
  },
  progressDotActive: { backgroundColor: '#1a7f4b' },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 28 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#111',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#1a7f4b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnDisabled: { backgroundColor: '#a8d5be' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  textBtn: { paddingVertical: 8 },
  textBtnText: { color: '#1a7f4b', fontSize: 15 },
  moodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 28,
    width: '100%',
  },
  moodChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  moodChipSelected: { backgroundColor: '#1a7f4b', borderColor: '#1a7f4b' },
  moodChipText: { fontSize: 14, color: '#444' },
  moodChipTextSelected: { color: '#fff', fontWeight: '600' },
});
