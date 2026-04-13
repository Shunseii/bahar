DROP INDEX `consent_events_userId_idx`;--> statement-breakpoint
CREATE INDEX `consentEvents_userId_idx` ON `consent_events` (`user_id`);