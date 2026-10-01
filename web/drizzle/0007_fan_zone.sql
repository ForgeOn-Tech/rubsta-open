CREATE TABLE `fan_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`court_number` integer NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`hidden_at` integer,
	`hidden_by` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fan_messages_court` ON `fan_messages` (`tournament_id`,`court_number`,`created_at`);--> statement-breakpoint
CREATE TABLE `fan_mutes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`muted_by` text NOT NULL,
	`muted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fan_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`user_id` text NOT NULL,
	`side` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fan_predictions_match_set_user` ON `fan_predictions` (`match_id`,`set_number`,`user_id`);--> statement-breakpoint
CREATE TABLE `fan_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fan_reactions_match_user_kind` ON `fan_reactions` (`match_id`,`user_id`,`kind`);--> statement-breakpoint
ALTER TABLE `courts` ADD `stream_url` text;