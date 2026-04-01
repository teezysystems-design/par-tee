import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { courses } from './courses';

export const tournamentStatusEnum = pgEnum('tournament_status', [
  'upcoming',
  'registration',
  'live',
  'completed',
]);

export const tournamentFormatEnum = pgEnum('tournament_format', [
  'stroke_play',
  'match_play',
  'stableford',
]);

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'restrict' }),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  format: tournamentFormatEnum('format').notNull().default('stroke_play'),
  status: tournamentStatusEnum('status').notNull().default('upcoming'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  maxEntrants: integer('max_entrants').notNull().default(64),
  entryFeeInCents: integer('entry_fee_in_cents').notNull().default(0),
  prizePoolInCents: integer('prize_pool_in_cents').notNull().default(0),
  prizeName: text('prize_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tournamentEntries = pgTable('tournament_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  totalScore: integer('total_score'),
  holesCompleted: integer('holes_completed').notNull().default(0),
  scoreToPar: integer('score_to_par'),
  roundScores: jsonb('round_scores').$type<number[]>().default([]),
  finalRank: integer('final_rank'),
  enteredAt: timestamp('entered_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
