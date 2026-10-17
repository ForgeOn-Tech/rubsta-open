CREATE TABLE `umpire_links` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `umpire_links_email_unique` ON `umpire_links` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `umpire_links_token_unique` ON `umpire_links` (`token`);