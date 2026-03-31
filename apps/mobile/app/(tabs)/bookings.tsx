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
  gray100: '#f0f0f0',
  gray400: '#aaa',
  gray600: '#666',
  gray900: '#111',
  border: '#e0e0e0',
  error: '#ff4444',
};

interface Booking {
  id: string;
  startsAt: string;
  courseName: string;
  partySize: number;
  totalCents: number;
  status: 'confirmed' | 'cancelled' | 'completed';
}

const STATUS_LABELS: Record<Booking['status'], string> = {
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const STATUS_COLORS: Record<Booking['status'], string> = {
  confirmed: '#1a7f4b',
  cancelled: '#ff4444',
  completed: '#888',
};

function BookingCard({ booking }: { booking: Booking }) {
  const date = new Date(booking.startsAt);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.courseName}>{booking.courseName}</Text>
        <Text style={[styles.statusBadge, { color: STATUS_COLORS[booking.status] }]}>
          {STATUS_LABELS[booking.status]}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>📅</Text>
          <Text style={styles.metaText}>{dateStr}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>🕐</Text>
          <Text style={styles.metaText}>{timeStr}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>👥</Text>
          <Text style={styles.metaText}>
            {booking.partySize} {booking.partySize === 1 ? 'golfer' : 'golfers'}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>Total paid</Text>
        <Text style={styles.totalValue}>
          ${(booking.totalCents / 100).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchBookings = useCallback(
    async (silent = false) => {
      if (!session) return;
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_URL}/v1/bookings`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to load bookings');
        const json = await res.json();
        setBookings(json.data ?? []);
      } catch {
        setError('Could not load bookings.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session]
  );

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(true);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchBookings()}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerSub}>
          {bookings.length > 0
            ? `${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`
            : 'No bookings yet'}
        </Text>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>⛳</Text>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySub}>
            Head to Discover to find tee times that match your mood.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.gray900 },
  headerSub: { fontSize: 14, color: COLORS.gray600, marginTop: 2 },
  list: { padding: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  courseName: { fontSize: 16, fontWeight: '700', color: COLORS.gray900, flex: 1, marginRight: 8 },
  statusBadge: { fontSize: 13, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 13 },
  metaText: { fontSize: 13, color: COLORS.gray600 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: { fontSize: 13, color: COLORS.gray600 },
  totalValue: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray900, marginBottom: 8 },
  emptySub: { fontSize: 15, color: COLORS.gray600, textAlign: 'center', lineHeight: 22 },
  errorText: { fontSize: 15, color: COLORS.gray600, marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '600' },
});
