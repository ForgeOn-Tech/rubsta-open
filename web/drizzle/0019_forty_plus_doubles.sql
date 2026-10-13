INSERT INTO `event_fees` (`tournament_id`, `category`, `fee_cents`)
SELECT `id`, 'D40', 300000 FROM `tournaments`
WHERE true
ON CONFLICT (`tournament_id`, `category`) DO NOTHING;
