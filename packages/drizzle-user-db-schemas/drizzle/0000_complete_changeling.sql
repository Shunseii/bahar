CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`filters` text
);
--> statement-breakpoint
CREATE TABLE `dictionary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`created_at_timestamp_ms` integer,
	`updated_at` text,
	`updated_at_timestamp_ms` integer,
	`word` text NOT NULL,
	`translation` text NOT NULL,
	`definition` text,
	`type` text NOT NULL,
	`root` text,
	`tags` text,
	`antonyms` text,
	`examples` text,
	`morphology` text
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` text PRIMARY KEY NOT NULL,
	`dictionary_entry_id` text NOT NULL,
	`difficulty` real DEFAULT 0,
	`due` text NOT NULL,
	`due_timestamp_ms` integer NOT NULL,
	`elapsed_days` integer DEFAULT 0,
	`lapses` integer DEFAULT 0,
	`last_review` text,
	`last_review_timestamp_ms` integer,
	`reps` integer DEFAULT 0,
	`scheduled_days` integer DEFAULT 0,
	`stability` real DEFAULT 0,
	`state` integer DEFAULT 0,
	`direction` text DEFAULT 'forward' NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`dictionary_entry_id`) REFERENCES `dictionary_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flashcards_entry_direction_unique` ON `flashcards` (`dictionary_entry_id`,`direction`);--> statement-breakpoint
CREATE INDEX `flashcards_due_timestamp_ms_index` ON `flashcards` (`due_timestamp_ms`);--> statement-breakpoint
CREATE TABLE `migrations` (
	`version` integer PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`applied_at_ms` integer NOT NULL,
	`status` text DEFAULT 'applied' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`show_antonyms_in_flashcard` text DEFAULT 'hidden',
	`show_reverse_flashcards` integer DEFAULT false
);
