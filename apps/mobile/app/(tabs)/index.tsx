import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const COLORS = {
  primary: '#1a7f4b',
  primaryLight: '#e8f5ee',
  white: '#fff',
  gray50: '#f7f7f7',
  gray100: '#efefef',
  gray400: '#aaa',
  gray600: '#666',
  gray900: '#111',
  border: '#e0e0e0',
};

const MOODS = [
  { key: 'all', label: '✨ All', emoji: '✨' },
  { key: 'relaxed', label: '😌 Relaxed', emoji: '😌' },
  { key: 'competitive', label: '🏆 Competitive', emoji: '🏆' },
  { key: 'social', label: '👥 Social', emoji: '👥' },
  { key: 'scenic', label: '🌅 Scenic', emoji: '🌅' },
  { key: 'beginner', label: '🌱 Beginner', emoji: '🌱' },
  { key: 'advanced', label: '🔥 Advanced', emoji: '🔥' },
  { key: 'fast-paced', label: '⚡ Fast', emoji: '⚡' },
  { key: 'challenging', label: '💪 Challenging', emoji: '💪' },
] as const;

type MoodFilter = (typeof MOODS)[number]['key'];

interface TeeTimeSlot {
  id: string;
  startsAt: string;
  capacityRemaining: number;
  pricePerPersonCents: number;
  courseName: string;
  courseId: string;
  moodTags: string[];
}

function TeeTimeCard({ slot }: { slot: TeeTimeSlot }) {
  const date = new Date(slot.startsAt);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const price = `$${(slot.pricePerPersonCents / 100).toFixed(0)}/person`;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.courseName}>{slot.courseName}</Text>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{dateStr} · {timeStr}</Text>
          </View>
        </View>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{price}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.spotsRow}>
          <View
            style={[
              styles.spotsDot,
              { backgroundColor: slot.capacityRemaining <= 2 ? '#f59e0b' : COLORS.primary },
            ]}
          />
          <Text style={styles.spotsText}>
            {slot.capacityRemaining} spot{slot.capacityRemaining !== 1 ? 's' : ''} left
          </Text>
        </View>

        {slot.moodTags.length > 0 && (
          <View style={styles.moodTagRow}>
            {slot.moodTags.slice(0, 3).map((tag) => {
              const mood = MOODS.find((m) => m.key === tag);
              return (
                <View key={tag} style={styles.moodTag}>
                  <Text style={styles.moodTagText}>{mood?.emoji ?? '⛳'} {tag}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function DiscoverScreen() {
  const { session } = useAuth();
  const [selectedMood, setSelectedMood] = useState<MoodFilter>('all');
  const [slots, setSlots] = useState<TeeTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSlots = useCallback(
    async (silent = false) => {
      if (!session) return;
      if (!silent) setLoading(true);
      try {
        const mood = selectedMood === 'all' ? '' : `?mood=${selectedMood}`;
        const res = await fetch(`${API_URL}/v1/discover${mood}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setSlots(json.data ?? []);
      } catch {
        // show empty state silently
        setSlots([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session, selectedMood]
  );

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSlots(true);
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSub}>Find tee times that match your mood</Text>
      </View>

      {/* Mood filter bar */}
      <View style={styles.filterWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MOODS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const active = selectedMood === item.key;
            return (
              <TouchableOpacity
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedMood(item.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : slots.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>
            {selectedMood === 'all' ? '⛳' : MOODS.find((m) => m.key === selectedMood)?.emoji ?? '⛳'}
          </Text>
          <Text style={styles.emptyTitle}>No tee times available</Text>
          <Text style={styles.emptySub}>
            {selectedMood === 'all'
              ? 'Check back soon — courses are added regularly.'
              : 'Try a different mood to see more options.'}
          </Text>
          {selectedMood !== 'all' && (
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={() => setSelectedMood('all')}
            >
              <Text style={styles.clearFilterBtnText}>Show all times</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={slots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TeeTimeCard slot={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.gray900 },
  headerSub: { fontSize: 14, color: COLORS.gray600, marginTop: 2 },
  filterWrapper: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterList: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, color: COLORS.gray600, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.white, fontWeight: '600' },
  list: { padding: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardInfo: { flex: 1, marginRight: 12 },
  courseName: { fontSize: 16, fontWeight: '700', color: COLORS.gray900, marginBottom: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 13, color: COLORS.gray600 },
  priceTag: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priceText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  cardBottom: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  spotsDot: { width: 7, height: 7, borderRadius: 4 },
  spotsText: { fontSize: 12, color: COLORS.gray600, fontWeight: '500' },
  moodTagRow: { flexDirection: 'row', gap: 6 },
  moodTag: {
    backgroundColor: COLORS.gray100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  moodTagText: { fontSize: 11, color: COLORS.gray600, textTransform: 'capitalize' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray900, marginBottom: 8 },
  emptySub: { fontSize: 15, color: COLORS.gray600, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  clearFilterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  clearFilterBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
});
