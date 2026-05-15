import { $all, fillDatalist } from "./dom.js";
import type { Matchup, MatchupInput, RuneTree } from "./types.js";

export const MATCHUP_FIELDS = [
  "id",
  "champion",
  "opponent",
  "lane",
  "primary_tree",
  "primary_runes",
  "secondary_tree",
  "secondary_runes",
  "shards",
  "notes",
  "games_played",
  "wins",
  "confidence",
] as const satisfies readonly (keyof Matchup | "primary_runes" | "secondary_runes")[];

export type RunesByTree = Record<string, RuneTree>;

/** Re-populate the primary/secondary rune slot datalists from the currently selected trees. */
export function updateRuneDatalists(form: HTMLFormElement, runesByTree: RunesByTree): void {
  const primary = treeFromInput(form, "primary_tree", runesByTree);
  const secondary = treeFromInput(form, "secondary_tree", runesByTree);

  fillDatalist("primary-keystone-data", primary?.keystones ?? []);
  for (let i = 0; i < 3; i++) {
    fillDatalist(`primary-minor-${i}-data`, primary?.slots[i] ?? []);
  }
  fillDatalist("secondary-minors-data", secondary ? secondary.slots.flat() : []);
}

function treeFromInput(
  form: HTMLFormElement,
  name: "primary_tree" | "secondary_tree",
  runesByTree: RunesByTree,
): RuneTree | undefined {
  const input = form.elements.namedItem(name);
  if (!(input instanceof HTMLInputElement)) return undefined;
  return runesByTree[input.value];
}

export function runeGroupValues(form: HTMLFormElement, group: "primary" | "secondary"): string[] {
  return $all<HTMLInputElement>(`input[data-rune-group="${group}"]`, form).map((el) => el.value);
}

export function setRuneGroupValues(
  form: HTMLFormElement,
  group: "primary" | "secondary",
  joined: string,
): void {
  const values = joined.split(",").map((rune) => rune.trim());
  $all<HTMLInputElement>(`input[data-rune-group="${group}"]`, form).forEach((input, index) => {
    input.value = values[index] ?? "";
  });
}

/** Build the JSON payload (and the optional id) from the live form state. */
export function readForm(form: HTMLFormElement): { id: string; payload: MatchupInput } {
  const data = Object.fromEntries(new FormData(form));
  const id = String(data.id ?? "");
  const payload: MatchupInput = {
    champion: String(data.champion ?? ""),
    opponent: String(data.opponent ?? ""),
    lane: String(data.lane ?? ""),
    primary_tree: String(data.primary_tree ?? ""),
    primary_runes: runeGroupValues(form, "primary").join(", "),
    secondary_tree: String(data.secondary_tree ?? ""),
    secondary_runes: runeGroupValues(form, "secondary").join(", "),
    shards: String(data.shards ?? ""),
    notes: String(data.notes ?? ""),
    games_played: Number(data.games_played ?? 0),
    wins: Number(data.wins ?? 0),
    confidence: Number(data.confidence ?? 3),
  };
  return { id, payload };
}

export function fillForm(form: HTMLFormElement, matchup: Matchup, runesByTree: RunesByTree): void {
  for (const field of MATCHUP_FIELDS) {
    const el = form.elements.namedItem(field);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const value = (matchup as unknown as Record<string, unknown>)[field];
      el.value = value == null ? "" : String(value);
    }
  }
  updateRuneDatalists(form, runesByTree);
  setRuneGroupValues(form, "primary", matchup.primary_runes ?? "");
  setRuneGroupValues(form, "secondary", matchup.secondary_runes ?? "");
}

export function resetForm(form: HTMLFormElement, runesByTree: RunesByTree): void {
  form.reset();
  setInputValue(form, "id", "");
  setInputValue(form, "games_played", "0");
  setInputValue(form, "wins", "0");
  setInputValue(form, "confidence", "3");
  updateRuneDatalists(form, runesByTree);
}

function setInputValue(form: HTMLFormElement, name: string, value: string): void {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) el.value = value;
}
