CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text NOT NULL,
	`payment_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_order` ON `payments` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_payment` ON `payments` (`payment_id`);--> statement-breakpoint
CREATE INDEX `payments_entry` ON `payments` (`entry_id`);