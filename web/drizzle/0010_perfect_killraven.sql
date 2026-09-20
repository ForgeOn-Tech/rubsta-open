CREATE TABLE `avatar_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `avatar_attempts_user_time` ON `avatar_attempts` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `player_avatars` (
	`user_id` text PRIMARY KEY NOT NULL,
	`png` text,
	`updated_at` integer DEFAULT 0 NOT NULL,
	`consent_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
