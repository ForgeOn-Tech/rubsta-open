DROP INDEX `fan_reactions_match_user_kind`;--> statement-breakpoint
CREATE INDEX `fan_reactions_match_user_time` ON `fan_reactions` (`match_id`,`user_id`,`created_at`);