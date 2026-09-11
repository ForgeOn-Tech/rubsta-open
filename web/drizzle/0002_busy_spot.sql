CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`draw_id` text NOT NULL,
	`match_number` integer NOT NULL,
	`round_index` integer NOT NULL,
	`round_name` text NOT NULL,
	`top_slot` text NOT NULL,
	`bottom_slot` text NOT NULL,
	`events` text DEFAULT '[]' NOT NULL,
	`deciding_set` text DEFAULT 'set' NOT NULL,
	`first_server` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`winner_entry_id` text,
	`court` integer,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`draw_id`) REFERENCES `draws`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_draw_number` ON `matches` (`draw_id`,`match_number`);