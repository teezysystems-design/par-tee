import { pgTable, text, timestamp, decimal, jsonb, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  handicap: decimal('handicap', { precision: 4, scale: 1 }),
  moodPreferences: jsonb('mood_preferences').$type<string[]>().default([]),
  locationLat: decimal('location_lat', { precision: 9, scale: 6 }),
  locationLng: decimal('location_lng', { precision: 9, scale: 6 }),
  supabaseUserId: text('supabase_user_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
