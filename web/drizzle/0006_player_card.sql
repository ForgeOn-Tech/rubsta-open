ALTER TABLE `profiles` ADD `plays` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `player_number` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_player_number` ON `profiles` (`player_number`);--> statement-breakpoint
-- Existing profiles take numbers in the order they were made.
UPDATE `profiles` SET `player_number` = (SELECT COUNT(*) FROM `profiles` AS `earlier` WHERE `earlier`.`created_at` < `profiles`.`created_at` OR (`earlier`.`created_at` = `profiles`.`created_at` AND `earlier`.`id` <= `profiles`.`id`));
