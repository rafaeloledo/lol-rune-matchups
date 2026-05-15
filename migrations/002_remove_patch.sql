DROP TRIGGER IF EXISTS trg_rune_matchups_updated_at;

CREATE TABLE rune_matchups_new (
    id TEXT PRIMARY KEY NOT NULL,
    champion TEXT NOT NULL,
    opponent TEXT NOT NULL,
    lane TEXT NOT NULL,
    primary_tree TEXT NOT NULL,
    primary_runes TEXT NOT NULL,
    secondary_tree TEXT NOT NULL,
    secondary_runes TEXT NOT NULL,
    shards TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    confidence INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rune_matchups_new (
    id, champion, opponent, lane, primary_tree, primary_runes,
    secondary_tree, secondary_runes, shards, notes, games_played,
    wins, confidence, created_at, updated_at
)
SELECT
    id, champion, opponent, lane, primary_tree, primary_runes,
    secondary_tree, secondary_runes, shards, notes, games_played,
    wins, confidence, created_at, updated_at
FROM rune_matchups;

DROP TABLE rune_matchups;
ALTER TABLE rune_matchups_new RENAME TO rune_matchups;

CREATE INDEX IF NOT EXISTS idx_rune_matchups_pair
ON rune_matchups (champion, opponent, lane);

CREATE TRIGGER IF NOT EXISTS trg_rune_matchups_updated_at
AFTER UPDATE ON rune_matchups
FOR EACH ROW
BEGIN
    UPDATE rune_matchups SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
