CREATE TABLE IF NOT EXISTS `revlogs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`difficulty` real DEFAULT 0,
	`due` text NOT NULL,
	`due_timestamp_ms` integer NOT NULL,
	`review` text NOT NULL,
	`review_timestamp_ms` integer NOT NULL,
	`learning_steps` integer DEFAULT 0,
	`scheduled_days` integer DEFAULT 0,
	`stability` real DEFAULT 0,
	`state` integer DEFAULT 0,
	`direction` text DEFAULT 'forward' NOT NULL,
	`source` text DEFAULT 'review' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
