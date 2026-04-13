/**
 * Social Screen — Feature 5
 *
 * Tabs:
 *   Feed     — rich activity posts (round scores, rank-ups, challenges, tournaments)
 *   Friends  — accepted friends list + add by @username + pending requests + contact sync
 *
 * Fixes from scaffold:
 *   - Brand green #1B6B3A
 *   - Feed expects json.data (API now returns { data })
 *   - Like endpoint → /v1/social/posts/:id/like (toggle POST)
 *   - Friend add by @username instead of UUID
 *   - Friend request accept/decline via /v1/social/friends/respond
 *   - Post type display with proper payload parsing
 */
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
  ScrollView,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import * as Contacts from 'expo-contacts';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const COLORS = {
  primary: '#1B6B3A',
  primaryLight: '#e8f5ee',
  white: '#fff',
  gray50: '#f7f7f7',
  gray100: '#f3f4f6',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray600: '#6b7280',
  gray900: '#111827',
  border: '#e5e7eb',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  gold: '#FFD700',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatar: string | null;
  body: string;
  mediaUrls: string[];
  courseId: string | null;
  courseName: string | null;
  roundId: string | null;
  visibility: string;
  postType: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
}

interface Friend {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  handicap: number | null;
  tier: string;
  points: number;
  roundsPlayed: number;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  fromName: string;
  fromUsername: string | null;
  fromAvatar: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const TIER_LABELS: Record<string, string> = {
  bronze_1: 'Bronze I', bronze_2: 'Bronze II', bronze_3: 'Bronze III',
  silver_1: 'Silver I', silver_2: 'Silver II', silver_3: 'Silver III',
  gold_1: 'Gold I', gold_2: 'Gold II', gold_3: 'Gold III',
  platinum_1: 'Platinum I', platinum_2: 'Platinum II', platinum_3: 'Platinum III',
  diamond_1: 'Diamond I', diamond_2: 'Diamond II', diamond_3: 'Diamond III',
  master: 'Master', grandmaster: 'Grandmaster', unreal: 'Unreal',
};

const TIER_COLORS: Record<string, string> = {
  bronze_1: '#CD7F32', bronze_2: '#CD7F32', bronze_3: '#CD7F32',
  silver_1: '#C0C0C0', silver_2: '#C0C0C0', silver_3: '#C0C0C0',
  gold_1: '#FFD700', gold_2: '#FFD700', gold_3: '#FFD700',
  platinum_1: '#E5E4E2', platinum_2: '#E5E4E2', platinum_3: '#E5E4E2',
  diamond_1: '#B9F2FF', diamond_2: '#B9F2FF', diamond_3: '#B9F2FF',
  master: '#9B59B6', grandmaster: '#E74C3C', unreal: '#FF6B00',
};

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = (name ?? '?').charAt(0).toUpperCase();
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.text, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  circle: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  text: { color: COLORS.white, fontWeight: '700' },
});

// ─── Post Type Chip ──────────────────────────────────────────────────────────

function PostTypeChip({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    round_score:       { label: '⛳ Round',      color: COLORS.primary, bg: COLORS.primaryLight },
    swing_video:       { label: '🎥 Swing',      color: COLORS.blue,    bg: '#eff6ff' },
    rank_up:           { label: '🚀 Rank Up',    color: COLORS.purple,  bg: '#f5f3ff' },
    tournament_result: { label: '🏆 Tournament', color: COLORS.amber,   bg: '#fffbeb' },
    challenge:         { label: '⚔️ Challenge',  color: '#0891b2',      bg: '#ecfeff' },
    general:           { label: '💬 Post',        color: COLORS.gray600, bg: COLORS.gray100 },
  };
  const cfg = map[type] ?? map.general;
  return (
    <View style={[ptc.chip, { backgroundColor: cfg.bg }]}>
      <Text style={[ptc.chipText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const ptc = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { fontSize: 11, fontWeight: '700' },
});

// ─── Feed Post Card ──────────────────────────────────────────────────────────

function FeedPostCard({
  post,
  onLike,
}: {
  post: FeedPost;
  onLike: (postId: string, currentlyLiked: boolean) => void;
}) {
  return (
    <View style={fp.card}>
      {/* Author row */}
      <View style={fp.authorRow}>
        <Avatar name={post.authorName} size={38} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={fp.authorName}>{post.authorName}</Text>
          <View style={fp.metaRow}>
            {post.authorUsername && (
              <Text style={fp.username}>@{post.authorUsername}</Text>
            )}
            <Text style={fp.timestamp}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>
        <PostTypeChip type={post.postType} />
      </View>

      {/* Body */}
      <Text style={fp.body}>{post.body}</Text>

      {/* Course tag */}
      {post.courseName && (
        <View style={fp.courseTag}>
          <Text style={fp.courseTagText}>⛳ {post.courseName}</Text>
        </View>
      )}

      {/* Like / comment bar */}
      <View style={fp.actions}>
        <TouchableOpacity
          style={fp.actionBtn}
          onPress={() => onLike(post.id, post.liked)}
          activeOpacity={0.7}
        >
          <Text style={[fp.actionIcon, post.liked && { color: COLORS.red }]}>
            {post.liked ? '❤️' : '🤍'}
          </Text>
          <Text style={[fp.actionCount, post.liked && { color: COLORS.red }]}>
            {post.likeCount}
          </Text>
        </TouchableOpacity>
        <View style={fp.actionBtn}>
          <Text style={fp.actionIcon}>💬</Text>
          <Text style={fp.actionCount}>{post.commentCount}</Text>
        </View>
      </View>
    </View>
  );
}

const fp = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  authorName: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  username: { fontSize: 12, color: COLORS.gray400 },
  timestamp: { fontSize: 12, color: COLORS.gray400 },
  body: { fontSize: 15, color: COLORS.gray900, lineHeight: 22, marginTop: 10 },
  courseTag: {
    marginTop: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  courseTagText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 16 },
  actionCount: { fontSize: 13, color: COLORS.gray600, fontWeight: '600' },
});

// ─── Friend Card ─────────────────────────────────────────────────────────────

function FriendCard({ friend }: { friend: Friend }) {
  const tierColor = TIER_COLORS[friend.tier] ?? COLORS.gray400;
  const tierLabel = TIER_LABELS[friend.tier] ?? 'Bronze I';

  return (
    <View style={frc.card}>
      <Avatar name={friend.displayName} size={44} />
      <View style={frc.info}>
        <Text style={frc.name}>{friend.displayName}</Text>
        {friend.username && (
          <Text style={frc.username}>@{friend.username}</Text>
        )}
        <View style={frc.statsRow}>
          <View style={[frc.tierBadge, { backgroundColor: tierColor + '22' }]}>
            <Text style={[frc.tierText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
          {friend.handicap != null && (
            <Text style={frc.hcp}>HCP {Number(friend.handicap).toFixed(1)}</Text>
          )}
          <Text style={frc.rounds}>{friend.roundsPlayed} rounds</Text>
        </View>
      </View>
    </View>
  );
}

const frc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    marginBottom: 10,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  username: { fontSize: 13, color: COLORS.gray400, marginTop: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tierText: { fontSize: 11, fontWeight: '700' },
  hcp: { fontSize: 12, color: COLORS.gray600 },
  rounds: { fontSize: 12, color: COLORS.gray400 },
});

// ─── Feed Tab ─────────────────────────────────────────────────────────────────

function FeedTab() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(
    async (silent = false) => {
      if (!session) return;
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`${API_URL}/v1/social/feed`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setPosts(json.data ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session]
  );

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!session) return;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked: !currentlyLiked,
              likeCount: p.likeCount + (currentlyLiked ? -1 : 1),
            }
          : p
      )
    );
    try {
      // Toggle like — single POST endpoint
      const res = await fetch(`${API_URL}/v1/social/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked: currentlyLiked,
                likeCount: p.likeCount + (currentlyLiked ? 1 : -1),
              }
            : p
        )
      );
    }
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyEmoji}>📰</Text>
        <Text style={s.emptyTitle}>No posts yet</Text>
        <Text style={s.emptySub}>
          Add friends and play rounds to see their scores, rank-ups, and tournament results here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <FeedPostCard post={item} onLike={handleLike} />}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchFeed(true);
          }}
          tintColor={COLORS.primary}
        />
      }
    />
  );
}

// ─── Friends Tab ──────────────────────────────────────────────────────────────

function FriendsTab() {
  const { session } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [contactsMatches, setContactsMatches] = useState<Friend[]>([]);
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [contactsSynced, setContactsSynced] = useState(false);

  const fetchAll = useCallback(
    async (silent = false) => {
      if (!session) return;
      if (!silent) setLoading(true);
      try {
        const [fRes, rRes] = await Promise.all([
          fetch(`${API_URL}/v1/social/friends`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${API_URL}/v1/social/friends/requests`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        const [fJson, rJson] = await Promise.all([fRes.json(), rRes.json()]);
        setFriends(fJson.data ?? []);
        setRequests(rJson.data ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session]
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSendRequest = async () => {
    const username = usernameInput.trim().toLowerCase().replace(/^@/, '');
    if (!username || !session) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/v1/social/friends/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username }),
      });
      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Error', json.error?.message ?? 'Could not send request');
        return;
      }
      setUsernameInput('');
      Alert.alert('Sent!', json.data?.message ?? 'Friend request sent');
    } catch {
      Alert.alert('Error', 'Could not send friend request.');
    } finally {
      setAdding(false);
    }
  };

  const handleRespond = async (friendshipId: string, response: 'accepted' | 'declined') => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/v1/social/friends/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ friendshipId, response }),
      });
      if (!res.ok) throw new Error();
      setRequests((prev) => prev.filter((r) => r.id !== friendshipId));
      if (response === 'accepted') fetchAll(true);
    } catch {
      Alert.alert('Error', `Could not ${response === 'accepted' ? 'accept' : 'decline'} request.`);
    }
  };

  const handleSyncContacts = async () => {
    Alert.alert(
      'Sync Contacts',
      'PAR-Tee would like to access your contacts to help you find friends who already play. Your contacts are only used to match accounts and are never stored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Allow',
          onPress: async () => {
            setSyncingContacts(true);
            try {
              const { status } = await Contacts.requestPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission denied', 'You can enable contacts access in Settings.');
                return;
              }
              const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
              });
              const phones = data
                .flatMap((c) => (c.phoneNumbers ?? []).map((p) => p.number ?? ''))
                .filter(Boolean);
              const emails = data
                .flatMap((c) => (c.emails ?? []).map((e) => e.email ?? ''))
                .filter(Boolean);

              if (!session) return;
              const res = await fetch(`${API_URL}/v1/social/friends/contact-sync`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  phones: phones.slice(0, 500),
                  emails: emails.slice(0, 500),
                }),
              });
              if (res.ok) {
                const json = await res.json();
                setContactsMatches(json.data ?? []);
                setContactsSynced(true);
              }
            } catch {
              Alert.alert('Error', 'Could not sync contacts. Please try again.');
            } finally {
              setSyncingContacts(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchAll(true);
          }}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Add friend by @username */}
      <View style={fr.addBox}>
        <Text style={fr.addLabel}>Add a Friend</Text>
        <View style={fr.addRow}>
          <View style={fr.inputWrap}>
            <Text style={fr.atSign}>@</Text>
            <TextInput
              style={fr.input}
              placeholder="username"
              placeholderTextColor={COLORS.gray400}
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            style={[fr.addBtn, (!usernameInput.trim() || adding) && fr.addBtnDisabled]}
            onPress={handleSendRequest}
            disabled={!usernameInput.trim() || adding}
          >
            {adding ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={fr.addBtnText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Sync contacts banner */}
      {!contactsSynced ? (
        <TouchableOpacity
          style={fr.syncBanner}
          onPress={handleSyncContacts}
          disabled={syncingContacts}
          activeOpacity={0.8}
        >
          {syncingContacts ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <>
              <Text style={fr.syncBannerEmoji}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={fr.syncBannerTitle}>Find friends from contacts</Text>
                <Text style={fr.syncBannerSub}>Discover who already plays PAR-Tee</Text>
              </View>
              <Text style={fr.syncBannerArrow}>›</Text>
            </>
          )}
        </TouchableOpacity>
      ) : contactsMatches.length > 0 ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={fr.sectionLabel}>From Your Contacts ({contactsMatches.length})</Text>
          {contactsMatches
            .filter((m) => !friends.some((f) => f.id === m.id))
            .map((match) => (
              <FriendCard key={match.id} friend={match} />
            ))}
        </View>
      ) : (
        <View style={fr.syncedEmpty}>
          <Text style={fr.syncedEmptyText}>No new contacts found on PAR-Tee</Text>
        </View>
      )}

      {/* Pending requests */}
      {requests.length > 0 && (
        <>
          <Text style={fr.sectionLabel}>Friend Requests ({requests.length})</Text>
          {requests.map((req) => (
            <View key={req.id} style={fr.requestCard}>
              <Avatar name={req.fromName} size={40} />
              <View style={fr.reqInfo}>
                <Text style={fr.reqName}>{req.fromName}</Text>
                {req.fromUsername && (
                  <Text style={fr.reqUsername}>@{req.fromUsername}</Text>
                )}
              </View>
              <TouchableOpacity
                style={fr.acceptBtn}
                onPress={() => handleRespond(req.id, 'accepted')}
              >
                <Text style={fr.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={fr.declineBtn}
                onPress={() => handleRespond(req.id, 'declined')}
              >
                <Text style={fr.declineBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Friends list */}
      <Text style={fr.sectionLabel}>
        Friends {friends.length > 0 ? `(${friends.length})` : ''}
      </Text>
      {friends.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyEmoji}>👥</Text>
          <Text style={s.emptyTitle}>No friends yet</Text>
          <Text style={s.emptySub}>
            Add friends by @username to see their activity and coordinate tee times.
          </Text>
        </View>
      ) : (
        friends.map((f) => <FriendCard key={f.id} friend={f} />)
      )}
    </ScrollView>
  );
}

const fr = StyleSheet.create({
  addBox: { marginBottom: 16 },
  addLabel: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, marginBottom: 8 },
  addRow: { flexDirection: 'row', gap: 10 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.gray50,
  },
  atSign: { fontSize: 16, color: COLORS.gray400, fontWeight: '600', marginRight: 2 },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.gray900,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  addBtnDisabled: { backgroundColor: '#a8d5be' },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gray400,
    marginBottom: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
    gap: 10,
  },
  reqInfo: { flex: 1 },
  reqName: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  reqUsername: { fontSize: 13, color: COLORS.gray400, marginTop: 1 },
  acceptBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  acceptBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  declineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: { fontSize: 13, color: COLORS.gray400 },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#b2dfcc',
  },
  syncBannerEmoji: { fontSize: 24 },
  syncBannerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  syncBannerSub: { fontSize: 12, color: '#2d7a55', marginTop: 2 },
  syncBannerArrow: { fontSize: 22, color: COLORS.primary, fontWeight: '300' },
  syncedEmpty: { padding: 12, marginBottom: 12 },
  syncedEmptyText: { fontSize: 13, color: COLORS.gray400, textAlign: 'center' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

type TabKey = 'feed' | 'friends';

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('feed');

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Social</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabs}>
        {(['feed', 'friends'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'feed' ? 'Feed' : 'Friends'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'feed' ? <FeedTab /> : <FriendsTab />}
      </View>
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.gray50 },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: COLORS.gray900 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: COLORS.primary,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.gray400 },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: COLORS.gray900, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.gray600, textAlign: 'center', lineHeight: 21 },
});
