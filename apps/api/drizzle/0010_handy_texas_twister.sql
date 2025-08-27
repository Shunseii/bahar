ALTER TABLE `accounts` RENAME COLUMN "accountId" TO "account_id";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "providerId" TO "provider_id";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "accessToken" TO "access_token";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "refreshToken" TO "refresh_token";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "idToken" TO "id_token";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "accessTokenExpiresAt" TO "access_token_expires_at";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "refreshTokenExpiresAt" TO "refresh_token_expires_at";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
DROP TABLE IF EXISTS `sessions`;--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN "emailVerified" TO "email_verified";--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE `verifications` RENAME COLUMN "expiresAt" TO "expires_at";--> statement-breakpoint
ALTER TABLE `verifications` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `verifications` RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE `accounts` ALTER COLUMN "user_id" TO "user_id" text NOT NULL REFERENCES users(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text;--> statement-breakpoint
ALTER TABLE `users` ADD `banned` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `ban_expires` integer;--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_token_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "users_email_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "databases_user_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "settings_user_id_unique";--> statement-breakpoint
ALTER TABLE `migrations` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (unixepoch());--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `databases_user_id_unique` ON `databases` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settings_user_id_unique` ON `settings` (`user_id`);