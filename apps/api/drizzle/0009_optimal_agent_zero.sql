CREATE TABLE `migrations` (
	`version` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`sql_script` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
