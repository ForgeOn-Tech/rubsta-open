CREATE TABLE `event_fees` (
	`tournament_id` text NOT NULL,
	`category` text NOT NULL,
	`fee_cents` integer NOT NULL,
	PRIMARY KEY(`tournament_id`, `category`),
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- The Rubsta Open 2026 fees, in paise. Organisers change them in /admin/settings.
INSERT INTO `event_fees` (`tournament_id`, `category`, `fee_cents`)
SELECT `id`, 'OS', 300000 FROM `tournaments`
UNION ALL SELECT `id`, 'W30', 250000 FROM `tournaments`
UNION ALL SELECT `id`, 'U15', 200000 FROM `tournaments`
UNION ALL SELECT `id`, 'OD', 400000 FROM `tournaments`
UNION ALL SELECT `id`, 'S40', 300000 FROM `tournaments`;
--> statement-breakpoint
-- Move the old events onto the Rubsta Open events. Both doubles events become Open doubles.
UPDATE `entries` SET `category` = CASE `category` WHEN 'MS' THEN 'OS' WHEN 'WS' THEN 'W30' ELSE 'OD' END
WHERE `category` IN ('MS', 'WS', 'MD', 'WD');
--> statement-breakpoint
UPDATE `draws` SET `category` = CASE `category` WHEN 'MS' THEN 'OS' WHEN 'WS' THEN 'W30' ELSE 'OD' END
WHERE `category` IN ('MS', 'WS', 'MD', 'WD');
--> statement-breakpoint
ALTER TABLE `tournaments` DROP COLUMN `fee_cents`;