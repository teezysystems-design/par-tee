/**
 * Rank-Up Celebration Screen
 *
 * Full-screen animated celebration when a player ranks up.
 * Spring-scaled badge, particle confetti, tier colors, and points summary.
 * Navigated to from the round summary when a rank-up is detected.
 */
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RANK_TIERS } from '@par-tee/shared/types';
import { RANK_COLORS } from '@par-tee/shared/colors';
import type { RankTier } from '@par-tee/shared/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COUNT = 40;

interface ConfettiPiece {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  color: string;
  size: number;
}

function useConfetti(colors: string[]): ConfettiPiece[] {
  const pieces = useRef<ConfettiPiece[]>([]);

  if (pieces.current.length === 0) {
    pieces.current = Array.from({ length: CONFETTI_COUNT }, () => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20 - Math.random() * 200),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0.5 + Math.random() * 0.8),
      color: colors[Math.floor(Math.random() * colors.length)] ?? '#FFD700',
      size: 6 + Math.random() * 8,
    }));
  }

  useEffect(() => {
    const animations = pieces.current.map((p) =>
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: SCREEN_HEIGHT + 50,
          duration: 2500 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(p.x, {
          toValue: (p.x as unknown as { _value: number })._value + (Math.random() - 0.5) * 120,
          duration: 2500 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: Math.random() * 8 - 4,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(40, animations).start();
  }, []);

  return pieces.current;
}

export default function RankUpScreen() {
  const { fromTier, toTier, points, pointsEarned } = useLocalSearchParams<{
    fromTier: string;
    toTier: string;
    points: string;
    pointsEarned: string;
  }>();
  const router = useRouter();

  const tier = (toTier ?? 'bronze_1') as RankTier;
  const prevTier = (fromTier ?? 'bronze_1') as RankTier;
  const tierInfo = RANK_TIERS.find((r) => r.tier === tier);
  const prevTierInfo = RANK_TIERS.find((r) => r.tier === prevTier);
  const colors = RANK_COLORS[tier] ?? RANK_COLORS.bronze_1;
  const prevColors = RANK_COLORS[prevTier] ?? RANK_COLORS.bronze_1;

  // Confetti colors based on new tier
  const confettiColors = [colors.border, colors.text, '#FFD700', '#fff', colors.bg];
  const confetti = useConfetti(confettiColors);

  // Animations
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotate = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const tierNameOpacity = useRef(new Animated.Value(0)).current;
  const detailsOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const prevBadgeOpacity = useRef(new Animated.Value(1)).current;
  const prevBadgeScale = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Show previous tier briefly
      Animated.delay(300),
      // Shrink previous badge
      Animated.parallel([
        Animated.timing(prevBadgeScale, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(prevBadgeOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      // Pop in new badge with spring
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        Animated.spring(badgeRotate, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1, tension: 40, friction: 5, useNativeDriver: true }),
      ]),
      // Fade in text
      Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(tierNameOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(detailsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      {/* Confetti */}
      {confetti.map((piece, i) => (
        <Animated.View
          key={i}
          style={[
            s.confetti,
            {
              width: piece.size,
              height: piece.size,
              borderRadius: piece.size / 2,
              backgroundColor: piece.color,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                { rotate: piece.rotate.interpolate({ inputRange: [-4, 4], outputRange: ['-720deg', '720deg'] }) },
                { scale: piece.scale },
              ],
            },
          ]}
        />
      ))}

      {/* Previous tier badge (fades out) */}
      <Animated.View style={[s.prevBadge, { opacity: prevBadgeOpacity, transform: [{ scale: prevBadgeScale }] }]}>
        <View style={[s.badgeCircle, { backgroundColor: prevColors.bg, borderColor: prevColors.border }]}>
          <Text style={s.badgeIcon}>{prevTierInfo?.icon ?? '🥉'}</Text>
        </View>
        <Text style={[s.prevLabel, { color: prevColors.text }]}>{prevTierInfo?.label}</Text>
      </Animated.View>

      {/* Glow ring */}
      <Animated.View style={[
        s.glowRing,
        {
          borderColor: colors.border,
          transform: [{ scale: glowScale.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.5] }) }],
          opacity: glowScale.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.4, 0] }),
        },
      ]} />

      {/* New tier badge */}
      <Animated.View style={[s.mainBadge, {
        transform: [
          { scale: badgeScale },
          { rotate: badgeRotate.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] }) },
        ],
      }]}>
        <View style={[s.badgeCircleLg, { backgroundColor: colors.bg, borderColor: colors.border, shadowColor: colors.glow !== 'transparent' ? colors.glow : colors.border }]}>
          <Text style={s.badgeIconLg}>{tierInfo?.icon ?? '🥉'}</Text>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.Text style={[s.title, { opacity: titleOpacity }]}>RANK UP!</Animated.Text>

      {/* Tier name */}
      <Animated.Text style={[s.tierName, { opacity: tierNameOpacity, color: colors.text }]}>
        {tierInfo?.label}
      </Animated.Text>

      {/* Details */}
      <Animated.View style={[s.detailsBox, { opacity: detailsOpacity, borderColor: colors.border }]}>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Points earned</Text>
          <Text style={[s.detailValue, { color: colors.text }]}>+{pointsEarned ?? '0'}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Total points</Text>
          <Text style={[s.detailValue, { color: colors.text }]}>{Number(points ?? 0).toLocaleString()}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Previous tier</Text>
          <Text style={s.detailValue}>{prevTierInfo?.icon} {prevTierInfo?.label}</Text>
        </View>
      </Animated.View>

      {/* Continue button */}
      <Animated.View style={{ opacity: buttonOpacity, width: '100%', paddingHorizontal: 32 }}>
        <TouchableOpacity
          style={[s.continueBtn, { backgroundColor: colors.border }]}
          onPress={() => router.replace('/(tabs)/compete')}
          activeOpacity={0.85}
        >
          <Text style={[s.continueBtnText, { color: tier === 'unreal' ? '#e9d5ff' : '#fff' }]}>Continue →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  confetti: { position: 'absolute' },

  prevBadge: { position: 'absolute', alignItems: 'center' },
  prevLabel: { fontSize: 14, fontWeight: '700', marginTop: 8 },

  glowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },

  mainBadge: { marginBottom: 20 },
  badgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: { fontSize: 36 },

  badgeCircleLg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 10,
  },
  badgeIconLg: { fontSize: 52 },

  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 4,
    marginBottom: 8,
  },

  tierName: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 24,
  },

  detailsBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    marginHorizontal: 32,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#111' },

  continueBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  continueBtnText: { fontSize: 16, fontWeight: '700' },
});
