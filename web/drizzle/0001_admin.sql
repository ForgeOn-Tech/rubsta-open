CREATE TABLE `draw_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`draw_id` text NOT NULL,
	`position` integer NOT NULL,
	`entry_id` text,
	`seed` integer,
	FOREIGN KEY (`draw_id`) REFERENCES `draws`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draw_slots_draw_position` ON `draw_slots` (`draw_id`,`position`);--> statement-breakpoint
CREATE TABLE `draws` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`size` integer NOT NULL,
	`generated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draws_tournament_category` ON `draws` (`tournament_id`,`category`);--> statement-breakpoint
ALTER TABLE `entries` ADD `seed` integer;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `starts_on` text;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `ends_on` text;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `venue` text;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `schedule_confirmed` integer DEFAULT false NOT NULL;