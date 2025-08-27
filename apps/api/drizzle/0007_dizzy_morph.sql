CREATE TABLE `database` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`db_name` text NOT NULL,
	`hostname` text NOT NULL,
	`db_id` text NOT NULL,
	`access_token` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `database_user_id_unique` ON `database` (`user_id`);