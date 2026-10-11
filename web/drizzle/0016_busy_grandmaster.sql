CREATE TABLE `court_broadcasts` (
	`court_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'off' NOT NULL,
	`replay_url` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE cascade
);
