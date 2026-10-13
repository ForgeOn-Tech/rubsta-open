CREATE TABLE `challenge_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`score` integer NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`voided_at` integer,
	`voided_by` text,
	`void_reason` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `challenge_attempts_tournament_kind` ON `challenge_attempts` (`tournament_id`,`kind`);