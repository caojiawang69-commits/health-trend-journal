// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const meals = sqliteTable('meals', {id:text('id').primaryKey(),type:text('type').notNull(),occurred:text('occurred').notNull(),timezone:text('timezone').notNull(),note:text('note').notNull(),beforeKey:text('before_key'),afterKey:text('after_key'),afterOccurred:text('after_occurred'),created:text('created').notNull()});
export const health = sqliteTable('health', {id:text('id').primaryKey(),date:text('date').notNull(),kind:text('kind').notNull(),payload:text('payload').notNull(),updated:text('updated').notNull()}, table=>[index('health_date_kind_idx').on(table.date,table.kind)]);
export const reports = sqliteTable('reports', {date:text('date').primaryKey(),body:text('body').notNull(),created:text('created').notNull()});
export const settings = sqliteTable('settings', {key:text('key').primaryKey(),value:text('value').notNull()});
