CREATE TABLE `profile_photos` (
	`user_id` text PRIMARY KEY NOT NULL,
	`jpeg` text NOT NULL,
	`updated_at` integer NOT NULL,
	`consent_at` integer NOT NULL,
	`consent_text` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
