const form = document.querySelector("#matchupForm");
const filters = document.querySelector("#filters");
const list = document.querySelector("#matchupList");
const template = document.querySelector("#matchupTemplate");
const statusText = document.querySelector("#status");
const totalText = document.querySelector("#total");
const avgWinrateText = document.querySelector("#avgWinrate");
const resetButton = document.querySelector("#resetButton");
const formTitle = document.querySelector("#formTitle");

let matchups = [];

const enumOptions = { champions: [], lanes: [], runeTrees: [], shardPresets: [] };
const runesByTree = {};

const fields = [
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
];

function fillDatalist(id, values) {
  const datalist = document.getElementById(id);
  if (!datalist) return;
  datalist.replaceChildren(...values.map((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    return opt;
  }));
}

function updateRuneDatalists() {
  const primaryTree = runesByTree[form.elements.primary_tree?.value];
  const secondaryTree = runesByTree[form.elements.secondary_tree?.value];
  fillDatalist("primary-keystone-data", primaryTree?.keystones ?? []);
  for (let i = 0; i < 3; i++) {
    fillDatalist(`primary-minor-${i}-data`, primaryTree?.slots[i] ?? []);
  }
  fillDatalist("secondary-minors-data", secondaryTree ? secondaryTree.slots.flat() : []);
}

function handleTabComplete(event) {
  if (event.key !== "Tab" || event.shiftKey) return;
  const input = event.currentTarget;
  const listId = input.getAttribute("list");
  if (!listId) return;
  const datalist = document.getElementById(listId);
  if (!datalist) return;
  const options = Array.from(datalist.options, (o) => o.value);
  const query = input.value.trim().toLowerCase();
  if (!query) return;
  if (options.some((o) => o.toLowerCase() === query)) return;
  const match =
    options.find((o) => o.toLowerCase().startsWith(query)) ??
    options.find((o) => o.toLowerCase().includes(query));
  if (!match) return;
  input.value = match;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function runeGroupValues(group) {
  return Array.from(form.querySelectorAll(`input[data-rune-group="${group}"]`), (el) => el.value);
}

function setRuneGroupValues(group, value) {
  const values = value.split(",").map((rune) => rune.trim());
  const inputs = form.querySelectorAll(`input[data-rune-group="${group}"]`);
  inputs.forEach((input, index) => {
    input.value = values[index] ?? "";
  });
}

async function loadMatchups() {
  const params = new URLSearchParams(new FormData(filters));
  statusText.textContent = "Carregando...";

  const response = await fetch(`/api/matchups?${params.toString()}`);
  if (!response.ok) {
    statusText.textContent = "Falha ao carregar.";
    return;
  }

  matchups = await response.json();
  renderMatchups();
}

function renderMatchups() {
  list.replaceChildren();
  totalText.textContent = matchups.length;

  const games = matchups.reduce((sum, item) => sum + item.games_played, 0);
  const wins = matchups.reduce((sum, item) => sum + item.wins, 0);
  avgWinrateText.textContent = games ? `${Math.round((wins / games) * 100)}%` : "0%";
  statusText.textContent = matchups.length ? "" : "Nenhuma entrada encontrada.";

  for (const matchup of matchups) {
    const node = template.content.cloneNode(true);
    node.querySelector("article").dataset.id = matchup.id;
    node.querySelector("h3").textContent = `${matchup.champion} vs ${matchup.opponent}`;
    node.querySelector(".meta").textContent = [
      matchup.lane,
      `${matchup.wins}/${matchup.games_played} W`,
      `Confianca ${matchup.confidence}/5`,
    ].filter(Boolean).join(" - ");
    node.querySelector('[data-field="primary"]').textContent = `${matchup.primary_tree}: ${matchup.primary_runes}`;
    node.querySelector('[data-field="secondary"]').textContent = `${matchup.secondary_tree}: ${matchup.secondary_runes}`;
    node.querySelector('[data-field="shards"]').textContent = matchup.shards;
    node.querySelector(".notes").textContent = matchup.notes || "Sem notas.";
    list.append(node);
  }
}

function readForm() {
  const data = Object.fromEntries(new FormData(form));
  data.primary_runes = runeGroupValues("primary").join(", ");
  data.secondary_runes = runeGroupValues("secondary").join(", ");
  data.games_played = Number(data.games_played || 0);
  data.wins = Number(data.wins || 0);
  data.confidence = Number(data.confidence || 3);
  return data;
}

function fillForm(matchup) {
  for (const field of fields) {
    if (form.elements[field]) {
      form.elements[field].value = matchup[field] ?? "";
    }
  }
  updateRuneDatalists();
  setRuneGroupValues("primary", matchup.primary_runes ?? "");
  setRuneGroupValues("secondary", matchup.secondary_runes ?? "");
  formTitle.textContent = "Editar entrada";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.games_played.value = 0;
  form.elements.wins.value = 0;
  form.elements.confidence.value = 3;
  updateRuneDatalists();
  formTitle.textContent = "Nova entrada";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = readForm();
  const id = payload.id;
  delete payload.id;

  const response = await fetch(id ? `/api/matchups/${id}` : "/api/matchups", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    statusText.textContent = body.error;
    return;
  }

  resetForm();
  await loadMatchups();
});

filters.addEventListener("input", loadMatchups);
filters.addEventListener("change", loadMatchups);
resetButton.addEventListener("click", resetForm);

list.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  const article = event.target.closest(".matchup");
  if (!button || !article) return;

  const matchup = matchups.find((item) => item.id === article.dataset.id);
  if (!matchup) return;

  if (button.dataset.action === "edit") {
    fillForm(matchup);
  }

  if (button.dataset.action === "delete") {
    const response = await fetch(`/api/matchups/${matchup.id}`, { method: "DELETE" });
    if (response.ok) {
      await loadMatchups();
    }
  }
});

async function loadEnums() {
  const response = await fetch("/api/enums");
  if (!response.ok) throw new Error("failed to load enums");
  const data = await response.json();
  enumOptions.champions = data.champions;
  enumOptions.lanes = data.lanes;
  enumOptions.runeTrees = data.runeTrees.map((t) => t.name);
  enumOptions.shardPresets = data.shardPresets;
  for (const tree of data.runeTrees) {
    runesByTree[tree.name] = { keystones: tree.keystones, slots: tree.slots };
  }

  fillDatalist("champions-data", data.champions);
  fillDatalist("lanes-data", data.lanes);
  fillDatalist("trees-data", enumOptions.runeTrees);
  fillDatalist("shards-data", data.shardPresets);

  for (const treeInput of form.querySelectorAll('input[name$="_tree"]')) {
    treeInput.addEventListener("change", updateRuneDatalists);
    treeInput.addEventListener("input", updateRuneDatalists);
  }
  updateRuneDatalists();

  for (const input of document.querySelectorAll("input[list]")) {
    input.addEventListener("keydown", handleTabComplete);
  }
}

(async () => {
  try {
    await loadEnums();
  } catch (err) {
    statusText.textContent = "Falha ao carregar dados.";
    return;
  }
  await loadMatchups();
})();
