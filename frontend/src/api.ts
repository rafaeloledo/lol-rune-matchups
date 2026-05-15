import type { EnumsResponse, Matchup, MatchupInput } from "./types.js";

export async function fetchEnums(): Promise<EnumsResponse> {
  const response = await fetch("/api/enums");
  if (!response.ok) throw new Error("failed to load enums");
  return (await response.json()) as EnumsResponse;
}

export async function fetchMatchups(filters: URLSearchParams): Promise<Matchup[]> {
  const response = await fetch(`/api/matchups?${filters.toString()}`);
  if (!response.ok) throw new Error("failed to load matchups");
  return (await response.json()) as Matchup[];
}

export interface SaveError {
  ok: false;
  message: string;
}

export interface SaveSuccess {
  ok: true;
  matchup: Matchup;
}

export type SaveResult = SaveSuccess | SaveError;

export async function saveMatchup(payload: MatchupInput, id: string | null): Promise<SaveResult> {
  const url = id ? `/api/matchups/${id}` : "/api/matchups";
  const method = id ? "PUT" : "POST";
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, message: body?.error ?? "Erro desconhecido" };
  }
  return { ok: true, matchup: (await response.json()) as Matchup };
}

export async function deleteMatchup(id: string): Promise<boolean> {
  const response = await fetch(`/api/matchups/${id}`, { method: "DELETE" });
  return response.ok;
}
