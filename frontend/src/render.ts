import { $ } from "./dom.js";
import type { Matchup } from "./types.js";

export interface ListRefs {
  list: HTMLElement;
  template: HTMLTemplateElement;
  status: HTMLElement;
  total: HTMLElement;
  avgWinrate: HTMLElement;
}

export function renderMatchups(refs: ListRefs, matchups: readonly Matchup[]): void {
  refs.list.replaceChildren();
  refs.total.textContent = String(matchups.length);

  const games = matchups.reduce((sum, item) => sum + item.games_played, 0);
  const wins = matchups.reduce((sum, item) => sum + item.wins, 0);
  refs.avgWinrate.textContent = games ? `${Math.round((wins / games) * 100)}%` : "0%";
  refs.status.textContent = matchups.length ? "" : "Nenhuma entrada encontrada.";

  for (const matchup of matchups) {
    refs.list.append(renderCard(refs.template, matchup));
  }
}

function renderCard(template: HTMLTemplateElement, matchup: Matchup): DocumentFragment {
  const node = template.content.cloneNode(true) as DocumentFragment;
  const article = $("article", node);
  article.dataset.id = matchup.id;

  $("h3", node).textContent = `${matchup.champion} vs ${matchup.opponent}`;
  $(".meta", node).textContent = [
    matchup.lane,
    `${matchup.wins}/${matchup.games_played} W`,
    `Confianca ${matchup.confidence}/5`,
  ]
    .filter(Boolean)
    .join(" - ");

  $('[data-field="primary"]', node).textContent = `${matchup.primary_tree}: ${matchup.primary_runes}`;
  $('[data-field="secondary"]', node).textContent = `${matchup.secondary_tree}: ${matchup.secondary_runes}`;
  $('[data-field="shards"]', node).textContent = matchup.shards;
  $(".notes", node).textContent = matchup.notes || "Sem notas.";
  return node;
}
