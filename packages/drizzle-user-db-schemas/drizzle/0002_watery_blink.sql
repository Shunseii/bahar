CREATE TABLE `user_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`streak_count` integer DEFAULT 0,
	`longest_streak` integer DEFAULT 0,
	`last_review_date` text
);
