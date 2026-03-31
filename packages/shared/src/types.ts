// ============================================================
// Core Domain Types — shared across mobile, web, and API
// ============================================================

export type Mood =
  | 'competitive'
  | 'relaxed'
  | 'beginner'
  | 'advanced'
  | 'fast-paced'
  | 'social'
  | 'scenic'
  | 'challenging';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  handicap: number | null;
  moodPreferences: Mood[];
  location: GeoPoint | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Course {
  id: string;
  name: string;
  description: string | null;
  location: GeoPoint;
  address: string;
  moodTags: Mood[];
  amenities: string[];
  photoUrls: string[];
  rating: number | null;
  reviewCount: number;
  holeCount: 9 | 18 | 27 | 36;
  parScore: number;
  websiteUrl: string | null;
  phoneNumber: string | null;
  stripeAccountId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeeTimeSlot {
  id: string;
  courseId: string;
  startsAt: Date;
  capacity: number;
  bookedCount: number;
  priceInCents: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export interface Booking {
  id: string;
  userId: string;
  slotId: string;
  courseId: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  partySize: number;
  totalPriceInCents: number;
  stripePaymentIntentId: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Round {
  id: string;
  userId: string;
  courseId: string;
  bookingId: string | null;
  playedAt: Date;
  scoreCard: HoleScore[];
  totalScore: number | null;
  moodRating: number | null;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HoleScore {
  hole: number;
  par: number;
  strokes: number | null;
}

// ============================================================
// Competitive Feature Types (V2)
// ============================================================

export type RankTier =
  | 'rookie'
  | 'amateur'
  | 'club_player'
  | 'scratch'
  | 'pro'
  | 'elite'
  | 'champion'
  | 'unreal';

export interface RankInfo {
  tier: RankTier;
  label: string;
  icon: string;
  minPoints: number;
  maxPoints: number | null;
}

export const RANK_TIERS: RankInfo[] = [
  { tier: 'rookie',      label: 'Rookie',      icon: '🌱', minPoints: 0,    maxPoints: 199 },
  { tier: 'amateur',     label: 'Amateur',     icon: '🔰', minPoints: 200,  maxPoints: 499 },
  { tier: 'club_player', label: 'Club Player', icon: '🏌️', minPoints: 500,  maxPoints: 999 },
  { tier: 'scratch',     label: 'Scratch',     icon: '⛳', minPoints: 1000, maxPoints: 1999 },
  { tier: 'pro',         label: 'Pro',         icon: '🎯', minPoints: 2000, maxPoints: 3499 },
  { tier: 'elite',       label: 'Elite',       icon: '🔥', minPoints: 3500, maxPoints: 5999 },
  { tier: 'champion',    label: 'Champion',    icon: '🏆', minPoints: 6000, maxPoints: 9999 },
  { tier: 'unreal',      label: 'Unreal',      icon: '⚡', minPoints: 10000, maxPoints: null },
];

export interface PlayerRanking {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  tier: RankTier;
  points: number;
  rank: number;
  roundsPlayed: number;
  avgScore: number | null;
  winRate: number | null;
}

export type LeaderboardType = 'main' | '1v1' | '2v2';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  tier: RankTier;
  points: number;
  wins: number;
  losses: number;
  avgScore: number | null;
}

export type LeagueStatus = 'recruiting' | 'active' | 'playoffs' | 'completed';

export interface League {
  id: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  status: LeagueStatus;
  maxMembers: number;
  currentMembers: number;
  seasonStartDate: Date | null;
  seasonEndDate: Date | null;
  courseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueStanding {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  matchesPlayed: number;
}

export interface BracketMatch {
  id: string;
  round: number;
  matchNumber: number;
  player1Id: string | null;
  player2Id: string | null;
  player1Name: string | null;
  player2Name: string | null;
  winnerId: string | null;
  scheduledAt: Date | null;
  score1: number | null;
  score2: number | null;
}

export type TournamentStatus = 'upcoming' | 'registration' | 'live' | 'completed';
export type TournamentFormat = 'stroke_play' | 'match_play' | 'stableford';

export interface Tournament {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date;
  endDate: Date | null;
  maxEntrants: number;
  currentEntrants: number;
  entryFeeInCents: number;
  prizePoolInCents: number;
  isOptedIn: boolean;
  createdAt: Date;
}

export interface TournamentLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  totalScore: number;
  holesCompleted: number;
  scoreToPar: number;
  roundScores: number[];
}

// ============================================================
// API Request/Response shapes
// ============================================================

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
  };
}

export interface DiscoverQuery {
  mood?: Mood;
  lat: number;
  lng: number;
  radiusKm?: number;
  page?: number;
  pageSize?: number;
}
