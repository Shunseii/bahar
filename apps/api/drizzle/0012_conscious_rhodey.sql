DROP INDEX IF EXISTS "accounts_userId_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_token_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_userId_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "users_email_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "verifications_identifier_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "databases_user_id_unique";--> statement-breakpoint
ALTER TABLE `accounts` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `databases_user_id_unique` ON `databases` (`user_id`);--> statement-breakpoint
ALTER TABLE `sessions` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "email_verified" TO "email_verified" integer NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "banned" TO "banned" integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `verifications` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
ALTER TABLE `verifications` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));