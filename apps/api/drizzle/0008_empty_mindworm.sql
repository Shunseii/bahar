ALTER TABLE `database` RENAME TO `databases`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_databases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`db_name` text NOT NULL,
	`hostname` text NOT NULL,
	`db_id` text NOT NULL,
	`access_token` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_databases`("id", "user_id", "db_name", "hostname", "db_id", "access_token") SELECT "id", "user_id", "db_name", "hostname", "db_id", "access_token" FROM `databases`;--> statement-breakpoint
DROP TABLE `databases`;--> statement-breakpoint
ALTER TABLE `__new_databases` RENAME TO `databases`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `databases_user_id_unique` ON `databases` (`user_id`);