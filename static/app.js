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

const combobox = {
  popup: document.getElementById("combobox-popup"),
  input: null,
  options: [],
  filtered: [],
  active: 0,
};

function comboboxValues(input) {
  const listId = input.dataset.list;
  if (!listId) return [];
  const datalist = document.getElementById(listId);
  if (!datalist) return [];
  return Array.from(datalist.options, (o) => o.value);
}

function scoreOption(option, query) {
  const lower = option.toLowerCase();
  if (!query) return { score: 0, index: 0 };
  if (lower === query) return { score: 0, index: 0 };
  if (lower.startsWith(query)) return { score: 1, index: 0 };
  const i = lower.indexOf(query);
  if (i >= 0) return { score: 2, index: i };
  return null;
}

function filterOptions(options, query) {
  const q = query.trim().toLowerCase();
  if (!q) return options.map((value) => ({ value, match: null }));
  const scored = [];
  for (const value of options) {
    const s = scoreOption(value, q);
    if (s) scored.push({ value, score: s.score, index: s.index });
  }
  scored.sort((a, b) => a.score - b.score || a.index - b.index || a.value.localeCompare(b.value));
  return scored.map(({ value, index }) => ({
    value,
    match: q && index >= 0 ? { start: index, end: index + q.length } : null,
  }));
}

function renderCombobox() {
  combobox.popup.replaceChildren();
  if (!combobox.filtered.length) {
    const empty = document.createElement("div");
    empty.className = "combobox-empty";
    empty.textContent = "Sem resultados";
    combobox.popup.append(empty);
    return;
  }
  combobox.filtered.forEach(({ value, match }, idx) => {
    const item = document.createElement("div");
    item.className = "combobox-item" + (idx === combobox.active ? " active" : "");
    item.setAttribute("role", "option");
    item.dataset.index = String(idx);
    if (match) {
      item.append(
        document.createTextNode(value.slice(0, match.start)),
      );
      const mark = document.createElement("mark");
      mark.textContent = value.slice(match.start, match.end);
      item.append(mark);
      item.append(document.createTextNode(value.slice(match.end)));
    } else {
      item.textContent = value;
    }
    combobox.popup.append(item);
  });
}

function positionCombobox() {
  if (!combobox.input) return;
  const rect = combobox.input.getBoundingClientRect();
  combobox.popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
  combobox.popup.style.left = `${rect.left + window.scrollX}px`;
  combobox.popup.style.minWidth = `${rect.width}px`;
}

function openCombobox(input) {
  combobox.input = input;
  combobox.options = comboboxValues(input);
  refreshCombobox();
  combobox.popup.hidden = false;
  positionCombobox();
}

function refreshCombobox() {
  if (!combobox.input) return;
  combobox.filtered = filterOptions(combobox.options, combobox.input.value);
  combobox.active = 0;
  renderCombobox();
}

function closeCombobox() {
  combobox.popup.hidden = true;
  combobox.input = null;
}

function commitCombobox(idx) {
  if (!combobox.input) return false;
  const target = combobox.filtered[idx ?? combobox.active];
  if (!target) return false;
  const input = combobox.input;
  input.value = target.value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  closeCombobox();
  return true;
}

function moveActive(delta) {
  if (!combobox.filtered.length) return;
  combobox.active = (combobox.active + delta + combobox.filtered.length) % combobox.filtered.length;
  renderCombobox();
  const activeEl = combobox.popup.querySelector(".combobox-item.active");
  if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
}

function attachCombobox(input) {
  input.addEventListener("focus", () => openCombobox(input));
  input.addEventListener("input", () => {
    if (combobox.input !== input) openCombobox(input);
    else refreshCombobox();
  });
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (combobox.input === input) closeCombobox();
    }, 120);
  });
  input.addEventListener("keydown", (event) => {
    if (combobox.input !== input) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Enter":
        if (commitCombobox()) event.preventDefault();
        break;
      case "Tab":
        if (!event.shiftKey) commitCombobox();
        break;
      case "Escape":
        closeCombobox();
        break;
    }
  });
}

combobox.popup.addEventListener("mousedown", (event) => {
  const item = event.target.closest(".combobox-item");
  if (!item) return;
  event.preventDefault();
  commitCombobox(Number(item.dataset.index));
});

window.addEventListener("scroll", positionCombobox, true);
window.addEventListener("resize", positionCombobox);

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
    treeInput.addEventListener("change", () => {
      updateRuneDatalists();
      if (combobox.input && combobox.input.closest("[data-rune-group]")) refreshCombobox();
    });
  }
  updateRuneDatalists();

  for (const input of document.querySelectorAll("input[data-list]")) {
    attachCombobox(input);
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
