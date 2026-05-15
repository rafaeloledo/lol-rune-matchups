import { $all, $byId, fillDatalist } from "./dom.js";
import { ComboboxController } from "./combobox.js";
import {
  fetchEnums,
  fetchMatchups,
  saveMatchup,
  deleteMatchup,
} from "./api.js";
import {
  fillForm,
  readForm,
  resetForm,
  updateRuneDatalists,
  type RunesByTree,
} from "./form.js";
import { renderMatchups, type ListRefs } from "./render.js";
import type { Matchup } from "./types.js";

const form = $byId<HTMLFormElement>("matchupForm");
const filters = $byId<HTMLFormElement>("filters");
const resetButton = $byId<HTMLButtonElement>("resetButton");
const formTitle = $byId("formTitle");

const refs: ListRefs = {
  list: $byId("matchupList"),
  template: $byId<HTMLTemplateElement>("matchupTemplate"),
  status: $byId("status"),
  total: $byId("total"),
  avgWinrate: $byId("avgWinrate"),
};

const combobox = new ComboboxController("combobox-popup");

let matchups: Matchup[] = [];
const runesByTree: RunesByTree = {};

async function loadMatchups(): Promise<void> {
  refs.status.textContent = "Carregando...";
  try {
    const params = new URLSearchParams(new FormData(filters) as unknown as Record<string, string>);
    matchups = await fetchMatchups(params);
    renderMatchups(refs, matchups);
  } catch {
    refs.status.textContent = "Falha ao carregar.";
  }
}

async function loadEnums(): Promise<void> {
  const data = await fetchEnums();

  fillDatalist("champions-data", data.champions);
  fillDatalist("lanes-data", data.lanes);
  fillDatalist("trees-data", data.runeTrees.map((t) => t.name));
  fillDatalist("shards-data", data.shardPresets);

  for (const tree of data.runeTrees) {
    runesByTree[tree.name] = tree;
  }

  for (const treeInput of $all<HTMLInputElement>('input[name$="_tree"]', form)) {
    treeInput.addEventListener("change", () => {
      updateRuneDatalists(form, runesByTree);
      if (combobox.ownerMatches("[data-rune-group]")) combobox.refresh();
    });
  }
  updateRuneDatalists(form, runesByTree);

  for (const input of $all<HTMLInputElement>("input[data-list]")) {
    combobox.attach(input);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { id, payload } = readForm(form);
  const result = await saveMatchup(payload, id || null);
  if (!result.ok) {
    refs.status.textContent = result.message;
    return;
  }
  resetForm(form, runesByTree);
  formTitle.textContent = "Nova entrada";
  await loadMatchups();
});

filters.addEventListener("input", loadMatchups);
filters.addEventListener("change", loadMatchups);

resetButton.addEventListener("click", () => {
  resetForm(form, runesByTree);
  formTitle.textContent = "Nova entrada";
});

refs.list.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("button");
  const article = target.closest<HTMLElement>(".matchup");
  if (!button || !article) return;

  const matchup = matchups.find((item) => item.id === article.dataset.id);
  if (!matchup) return;

  if (button.dataset.action === "edit") {
    fillForm(form, matchup, runesByTree);
    formTitle.textContent = "Editar entrada";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (button.dataset.action === "delete") {
    if (await deleteMatchup(matchup.id)) {
      await loadMatchups();
    }
  }
});

void (async () => {
  try {
    await loadEnums();
  } catch {
    refs.status.textContent = "Falha ao carregar dados.";
    return;
  }
  await loadMatchups();
})();
