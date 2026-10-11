CREATE TABLE `avatar_shares` (
	`user_id` text PRIMARY KEY NOT NULL,
	`avatar_version` integer NOT NULL,
	`png` text NOT NULL,
	`consent_at` integer NOT NULL,
	`consent_text` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
