DROP TABLE `sessions`;--> statement-breakpoint
CREATE TABLE `sessions` (
    `id` text PRIMARY KEY NOT NULL,
    `expiresAt` integer NOT NULL,
    `token` text NOT NULL,
    `createdAt` integer NOT NULL,
    `updatedAt` integer NOT NULL,
    `ipAddress` text,
    `userAgent` text,
    `userId` text NOT NULL,
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN "username" TO "name";--> statement-breakpoint
CREATE TABLE `accounts` (
    `id` text PRIMARY KEY NOT NULL,
    `accountId` text NOT NULL,
    `providerId` text NOT NULL,
    `userId` text NOT NULL,
    `accessToken` text,
    `refreshToken` text,
    `idToken` text,
    `accessTokenExpiresAt` integer,
    `refreshTokenExpiresAt` integer,
    `scope` text,
    `password` text,
    `createdAt` integer NOT NULL,
    `updatedAt` integer NOT NULL,
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE `verifications` (
    `id` text PRIMARY KEY NOT NULL,
    `identifier` text NOT NULL,
    `value` text NOT NULL,
    `expiresAt` integer NOT NULL,
    `createdAt` integer,
    `updatedAt` integer
);--> statement-breakpoint
DROP INDEX IF EXISTS `users_github_id_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `username_idx`;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `image` text;--> statement-breakpoint
ALTER TABLE `users` ADD `createdAt` integer NOT NULL DEFAULT (1733627920);--> statement-breakpoint
ALTER TABLE `users` ADD `updatedAt` integer NOT NULL DEFAULT (1733627920);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `github_id`;
