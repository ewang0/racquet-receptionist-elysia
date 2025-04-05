import { pgTable, varchar, integer, date } from 'drizzle-orm/pg-core';

export const courtAvailability = pgTable('court_availability', {
  date: date('date').notNull(),
  time: varchar('time', { length: 10 }).notNull(),
  availableCourts: integer('available_courts'), // can be 0–4 or null
});
