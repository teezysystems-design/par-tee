/**
 * Teezy Design Tokens — shared color palette used across web and mobile.
 *
 * Web usage:  import { COLORS } from '@teezy/shared/colors'
 * Mobile:     import { COLORS } from '@teezy/shared/colors'
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
