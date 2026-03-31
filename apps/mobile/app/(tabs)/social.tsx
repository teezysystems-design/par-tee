import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const COLORS = {
  primary: '#1a7f4b',
  primaryLight: '#e8f5ee',
  white: '#fff',
  gray50: '#f7f7f7',
  gray400: '#aaa',
  gray600: '#666',
  gray900: '#111',
  border: '#e0e0e0',
};

interface Friend {
  id: string;
  name: string;
  email: string;
  handicap: string | null;
  moodPreferences: string[];
}

const MOOD_EMOJIS: Record<string, string> = {
  relaxed: '😌',
  competitive: '🏆',
  social: '👥',
  scenic: '🌅',
  beginner: '🌱',
  advanced: '🔥',
  'fast-paced': '⚡',
  challenging: '💪',
};

function FriendCard({ friend }: { friend: Friend }) {
  const initial = friend.name.charAt(0).toUpperCase();
  const moods = (friend.moodPreferences ?? []).slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.friendName}>{friend.name}</Text>
        {friend.handicap != null && (
          <Text style={styles.friendHandicap}>
            HCP {Number(friend.handicap).toFixed(1)}
          </Text>
        )}
        {moods.length > 0 && (
          <View style={styles.moodRow}>
            {moods.map((mood) => (
              <Text key={mood} style={styles.moodEmoji}>
                {MOOD_EMOJIS[mood] ?? '⛳'}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function SocialScreen() {
  const { session } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchFriends = useCallback(
    async (silent = false) => {
      if (!session) return;
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`${API_URL}/v1/friends`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setFriends(json.data ?? []);
      } catch {
        // silent — show empty state
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session]
  );

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFriends(true);
  };

  const handleAddFriend = async () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email) return;
    if (!session) return;

    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/v1/friends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email }),
      });

      if (res.status === 404) {
        Alert.alert('Not found', 'No Teezy user found with that email.');
        return;
      }
      if (res.status === 409) {
        Alert.alert('Already friends', "You're already connected with this person.");
        return;
      }
      if (!res.ok) throw new Error();

      setSearchEmail('');
      fetchFriends(true);
      Alert.alert('Friend added!', 'You are now connected.');
    } catch {
      Alert.alert('Error', 'Could not add friend. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Social</Text>
        <Text style={styles.headerSub}>
          {friends.length > 0
            ? `${friends.length} connection${friends.length !== 1 ? 's' : ''}`
            : 'Find your golf crew'}
        </Text>
      </View>

      {/* Add friend */}
      <View style={styles.addSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Add by email address..."
          placeholderTextColor={COLORS.gray400}
          value={searchEmail}
          onChangeText={setSearchEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TouchableOpacity
          style={[styles.addBtn, (!searchEmail.trim() || adding) && styles.addBtnDisabled]}
          onPress={handleAddFriend}
          disabled={!searchEmail.trim() || adding}
        >
          {adding ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.addBtnText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>No connections yet</Text>
          <Text style={styles.emptySub}>
            Add friends by email to coordinate tee times and see their golf moods.
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FriendCard friend={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.gray900 },
  headerSub: { fontSize: 14, color: COLORS.gray600, marginTop: 2 },
  addSection: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.gray900,
    backgroundColor: COLORS.gray50,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  addBtnDisabled: { backgroundColor: '#a8d5be' },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  list: { padding: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardLeft: {},
  cardRight: { flex: 1 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, color: COLORS.white, fontWeight: '700' },
  friendName: { fontSize: 16, fontWeight: '600', color: COLORS.gray900 },
  friendHandicap: { fontSize: 13, color: COLORS.gray600, marginTop: 2 },
  moodRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  moodEmoji: { fontSize: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray900, marginBottom: 8 },
  emptySub: { fontSize: 15, color: COLORS.gray600, textAlign: 'center', lineHeight: 22 },
});
