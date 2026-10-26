CREATE TABLE `gallery_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`player_id` text NOT NULL,
	`second_player_id` text,
	`title` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'gallery' NOT NULL,
	`category` text,
	`jpeg` text NOT NULL,
	`published_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`second_player_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gallery_tournament_publication` ON `gallery_photos` (`tournament_id`,`published_at`);