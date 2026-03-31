import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { users } from './users';

export const gameModeEnum = pgEnum('game_mode', ['chill', 'fun', 'competitive']);

export const challengeTypeEnum = pgEnum('challenge_type', ['none', 'head_to_head', 'scramble_2v2']);

export const partyStatusEnum = pgEnum('party_status', ['forming', 'in_progress', 'completed', 'cancelled']);

export const partyMemberStatusEnum = pgEnum('party_member_status', ['invited', 'accepted', 'declined']);

export const parties = pgTable('parties', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  gameMode: gameModeEnum('game_mode').notNull().default('fun'),
  challengeType: challengeTypeEnum('challenge_type').notNull().default('none'),
  status: partyStatusEnum('status').notNull().default('forming'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const partyMembers = pgTable('party_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  partyId: uuid('party_id')
    .notNull()
    .references(() => parties.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: partyMemberStatusEnum('status').notNull().default('invited'),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
});

export const holeScores = pgTable('hole_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  partyId: uuid('party_id')
    .notNull()
    .references(() => parties.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  holeNumber: integer('hole_number').notNull(),
  strokes: integer('strokes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
