CREATE TABLE `entry_bundles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tournament_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entry_bundles_user` ON `entry_bundles` (`user_id`);
--> statement-breakpoint
ALTER TABLE `entries` ADD `bundle_id` text REFERENCES `entry_bundles`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `entries_bundle` ON `entries` (`bundle_id`);
