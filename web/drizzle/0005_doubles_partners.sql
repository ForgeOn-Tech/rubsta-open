ALTER TABLE `entries` ADD `partner_status` text;--> statement-breakpoint
ALTER TABLE `entries` ADD `partner_user_id` text REFERENCES users(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `entries` ADD `partner_responded_at` integer;--> statement-breakpoint
UPDATE `entries` SET `partner_status` = 'pending' WHERE `partner_email` IS NOT NULL;
