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
