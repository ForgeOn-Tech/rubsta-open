CREATE TABLE `group_places` (
	`id` text PRIMARY KEY NOT NULL,
	`draw_id` text NOT NULL,
	`group_number` integer NOT NULL,
	`place` integer NOT NULL,
	`entry_id` text NOT NULL,
	`decided_by` text NOT NULL,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`draw_id`) REFERENCES `draws`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_places_draw_group_place` ON `group_places` (`draw_id`,`group_number`,`place`);--> statement-breakpoint
ALTER TABLE `draw_slots` ADD `group_number` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `group_number` integer;