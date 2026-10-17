ALTER TABLE `draws` ADD `qualifiers_per_group` integer;--> statement-breakpoint
-- Group draws made before admins chose their groups sent 8 (Open singles) or 4 (40+ singles) on in all.
UPDATE `draws` SET `qualifiers_per_group` = (CASE `category` WHEN 'OS' THEN 8 WHEN 'S40' THEN 4 END) / (SELECT COUNT(DISTINCT `group_number`) FROM `draw_slots` WHERE `draw_slots`.`draw_id` = `draws`.`id` AND `group_number` IS NOT NULL) WHERE EXISTS (SELECT 1 FROM `draw_slots` WHERE `draw_slots`.`draw_id` = `draws`.`id` AND `group_number` IS NOT NULL);
