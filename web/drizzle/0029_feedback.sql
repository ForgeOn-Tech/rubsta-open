CREATE TABLE `feedback_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`user_id` text,
	`ratings` text NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_responses_tournament_user` ON `feedback_responses` (`tournament_id`,`user_id`);