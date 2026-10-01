CREATE TABLE `courts` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`number` integer NOT NULL,
	`name` text,
	`surface` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courts_tournament_number` ON `courts` (`tournament_id`,`number`);--> statement-breakpoint
CREATE TABLE `schedule_days` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`day` text NOT NULL,
	`published_at` integer NOT NULL,
	`items` text NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_days_tournament_day` ON `schedule_days` (`tournament_id`,`day`);--> statement-breakpoint
CREATE TABLE `schedule_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`day` text NOT NULL,
	`court_number` integer NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`match_id` text,
	`title` text,
	`note` text,
	`timing` text NOT NULL,
	`time` text,
	`end_time` text,
	`umpire_email` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_items_match` ON `schedule_items` (`match_id`);--> statement-breakpoint
CREATE INDEX `schedule_items_tournament_day` ON `schedule_items` (`tournament_id`,`day`);