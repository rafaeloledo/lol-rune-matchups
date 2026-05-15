// Data shapes shared between the API and the UI. All field names mirror the
// JSON the Rust server actually emits (snake_case for matchup fields).

export interface RuneTree {
  name: string;
  keystones: string[];
  slots: [string[], string[], string[]];
}

export interface EnumsResponse {
  champions: string[];
  lanes: string[];
  runeTrees: RuneTree[];
  shardPresets: string[];
  shardSlots: string[][];
}

export interface Matchup {
  id: string;
  champion: string;
  opponent: string;
  lane: string;
  primary_tree: string;
  primary_runes: string;
  secondary_tree: string;
  secondary_runes: string;
  shards: string;
  notes: string;
  games_played: number;
  wins: number;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface MatchupInput {
  champion: string;
  opponent: string;
  lane: string;
  primary_tree: string;
  primary_runes: string;
  secondary_tree: string;
  secondary_runes: string;
  shards: string;
  notes: string;
  games_played: number;
  wins: number;
  confidence: number;
}

export interface MatchSpan {
  start: number;
  end: number;
}

export interface ComboboxItem {
  value: string;
  match: MatchSpan | null;
}
