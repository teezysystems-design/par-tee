import {
  boolean,
  customType,
  decimal,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users as teezyUsers } from './users';

// PostGIS geography type (read-only in Drizzle; managed by DB trigger)
const geography = customType<{ data: string }>({
  dataType() {
    return 'geography(POINT, 4326)';
  },
});

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  locationLat: decimal('location_lat', { precision: 9, scale: 6 }).notNull(),
  locationLng: decimal('location_lng', { precision: 9, scale: 6 }).notNull(),
  location: geography('location'), // auto-populated by DB trigger
  address: text('address').notNull(),
  moodTags: jsonb('mood_tags').$type<string[]>().default([]),
  amenities: jsonb('amenities').$type<string[]>().default([]),
  photoUrls: jsonb('photo_urls').$type<string[]>().default([]),
  holeCount: integer('hole_count').notNull().default(18),
  parScore: integer('par_score').notNull().default(72),
  websiteUrl: text('website_url'),
  phoneNumber: text('phone_number'),
  stripeAccountId: text('stripe_account_id'),
  createdByUserId: uuid('created_by_user_id').references(() => teezyUsers.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teeTimeSlots = pgTable('tee_time_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  capacity: integer('capacity').notNull().default(4),
  bookedCount: integer('booked_count').notNull().default(0),
  priceInCents: integer('price_in_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
