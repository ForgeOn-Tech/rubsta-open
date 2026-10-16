CREATE TABLE `certificate_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`kind` text NOT NULL,
	`recipient` text NOT NULL,
	`request_body` text NOT NULL,
	`queued_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	`first_attempt_at` integer,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`provider_id` text,
	`last_error` text,
	`needs_review` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `certificate_emails_certificate` ON `certificate_emails` (`user_id`,`entry_id`,`kind`);