DROP INDEX `entries_user_category`;
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_user_category` ON `entries` (`user_id`,`category`) WHERE "entries"."status" != 'cancelled';
