/**
 * PAR-Tee Design Tokens — shared color palette used across web and mobile.
 *
 * Web usage:  import { COLORS } from '@par-tee/shared/colors'
 * Mobile:     import { COLORS } from '@par-tee/shared/colors'
 *
 * NOTE: Mobile StyleSheet values must be plain strings (no CSS variables).
 * Use these tokens directly in both React and React Native style objects.
 */

export const COLORS = {
  // Brand greens
  primary: '#1a7f4b',
  primaryDark: '#155f38',
  primaryLight: '#2db870',
  primaryPale: '#e8f5ee',
  primaryPale2: '#f0faf4',

  // Neutrals
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Semantic
  success: '#1a7f4b',
  warning: '#f59e0b',
  error: '#ef4444',
  errorLight: '#fca5a5',

  // Mobile-specific aliases (slightly higher contrast for small screens)
  mobileText: '#111111',
  mobileSubtext: '#666666',
  mobileBorder: '#e0e0e0',
  mobileDisabled: '#a8d5be',
} as const;

export type ColorKey = keyof typeof COLORS;

/** MOODS constant — single source of truth for mood keys and display labels */
export const MOODS = [
  { key: 'relaxed', emoji: '😌', label: 'Relaxed', desc: 'Leisurely pace, no pressure' },
  { key: 'competitive', emoji: '🏆', label: 'Competitive', desc: 'Match play, keep score' },
  { key: 'social', emoji: '👥', label: 'Social', desc: 'Great for groups & friends' },
  { key: 'scenic', emoji: '🌅', label: 'Scenic', desc: 'Beautiful views, take it in' },
  { key: 'beginner', emoji: '🌱', label: 'Beginner-friendly', desc: 'Learning-friendly courses' },
  { key: 'advanced', emoji: '🔥', label: 'Advanced', desc: 'Challenging play for skilled golfers' },
  { key: 'fast-paced', emoji: '⚡', label: 'Fast-paced', desc: 'Quick rounds, efficient play' },
  { key: 'challenging', emoji: '💪', label: 'Challenging', desc: 'Tough conditions, test yourself' },
] as const;

export type MoodKey = (typeof MOODS)[number]['key'];

/** Rank tier visual tokens — bg, text, border colors per tier */
export const RANK_COLORS = {
  rookie:      { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db', glow: 'transparent' },
  amateur:     { bg: '#fef9c3', text: '#854d0e', border: '#fde047', glow: '#fef08a' },
  club_player: { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd', glow: '#bfdbfe' },
  scratch:     { bg: '#dcfce7', text: '#14532d', border: '#86efac', glow: '#bbf7d0' },
  pro:         { bg: '#ede9fe', text: '#4c1d95', border: '#c4b5fd', glow: '#ddd6fe' },
  elite:       { bg: '#fce7f3', text: '#831843', border: '#f9a8d4', glow: '#fbcfe8' },
  champion:    { bg: '#fff7ed', text: '#7c2d12', border: '#fb923c', glow: '#fed7aa' },
  unreal:      { bg: '#0f0f1a', text: '#e9d5ff', border: '#7c3aed', glow: '#7c3aed' },
} as const;

export type RankTierKey = keyof typeof RANK_COLORS;
