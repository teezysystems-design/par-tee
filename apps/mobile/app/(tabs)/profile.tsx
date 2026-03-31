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
} from 'react-native';
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

interface UserProfile {
  id: string;
  name: string;
  email: string;
  handicap: string | null;
  moodPreferences: string[];
  avatarUrl: string | null;
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editHandicap, setEditHandicap] = useState('');
  const [editMoods, setEditMoods] = useState<MoodKey[]>([]);

  const fetchProfile = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/v1/users/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setProfile(json.data);
      }
    } catch {
      // silent — profile will remain null
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditHandicap(profile.handicap ?? '');
    setEditMoods((profile.moodPreferences ?? []) as MoodKey[]);
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const toggleMood = (mood: MoodKey) => {
    setEditMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const saveProfile = async () => {
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          handicap,
          moodPreferences: editMoods,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? 'Failed to save');
      }

      const json = await res.json();
      setProfile(json.data);
      setEditing(false);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (fetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a7f4b" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load profile.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchProfile}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (editing) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={editName}
          onChangeText={setEditName}
          placeholder="Your name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Handicap (optional)</Text>
        <TextInput
          style={styles.input}
          value={editHandicap}
          onChangeText={setEditHandicap}
          placeholder="e.g. 18.4"
          placeholderTextColor="#999"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Golf moods</Text>
        <View style={styles.moodsGrid}>
          {MOODS.map((mood) => {
            const selected = editMoods.includes(mood.key);
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

        <TouchableOpacity style={styles.primaryBtn} onPress={saveProfile} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Save changes</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.textBtn} onPress={cancelEditing}>
          <Text style={styles.textBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={fetching} onRefresh={fetchProfile} tintColor="#1a7f4b" />}
    >
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
      </View>

      <Text style={styles.profileName}>{profile.name}</Text>
      <Text style={styles.profileEmail}>{profile.email}</Text>

      <View style={styles.statRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {profile.handicap != null ? Number(profile.handicap).toFixed(1) : '—'}
          </Text>
          <Text style={styles.statLabel}>Handicap</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{profile.moodPreferences?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Moods set</Text>
        </View>
      </View>

      {(profile.moodPreferences?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your golf moods</Text>
          <View style={styles.moodsGrid}>
            {(profile.moodPreferences as MoodKey[]).map((key) => {
              const mood = MOODS.find((m) => m.key === key);
              return (
                <View key={key} style={[styles.moodChip, styles.moodChipSelected]}>
                  <Text style={[styles.moodChipText, styles.moodChipTextSelected]}>
                    {mood?.label ?? key}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={startEditing}>
        <Text style={styles.primaryBtnText}>Edit profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutBtnText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { flexGrow: 1, alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a7f4b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 16,
  },
  avatarInitial: { fontSize: 32, color: '#fff', fontWeight: '700' },
  profileName: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: '#888', marginBottom: 24 },
  statRow: {
    flexDirection: 'row',
    backgroundColor: '#f7f7f7',
    borderRadius: 16,
    width: '100%',
    marginBottom: 24,
    paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#e0e0e0' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#1a7f4b' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  section: { width: '100%', marginBottom: 24 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  moodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  moodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  moodChipSelected: { backgroundColor: '#1a7f4b', borderColor: '#1a7f4b' },
  moodChipText: { fontSize: 13, color: '#444' },
  moodChipTextSelected: { color: '#fff', fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: '#444', alignSelf: 'flex-start', marginBottom: 6 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
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
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  textBtn: { paddingVertical: 8 },
  textBtnText: { color: '#1a7f4b', fontSize: 15 },
  signOutBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
    marginTop: 8,
  },
  signOutBtnText: { color: '#ff4444', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#888', fontSize: 15, marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#1a7f4b',
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
});
