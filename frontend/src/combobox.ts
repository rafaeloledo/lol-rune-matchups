import { $byId } from "./dom.js";
import type { ComboboxItem } from "./types.js";

// One floating popup shared by every combobox input on the page. Only one
// input owns the popup at a time; focusing another swaps ownership.
export class ComboboxController {
  private readonly popup: HTMLElement;
  private input: HTMLInputElement | null = null;
  private options: string[] = [];
  private filtered: ComboboxItem[] = [];
  private active = 0;

  constructor(popupId: string) {
    this.popup = $byId(popupId);
    this.popup.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const item = target.closest<HTMLElement>(".combobox-item");
      if (!item) return;
      event.preventDefault();
      this.commit(Number(item.dataset.index));
    });
    window.addEventListener("scroll", this.position, true);
    window.addEventListener("resize", this.position);
  }

  attach(input: HTMLInputElement): void {
    input.addEventListener("focus", () => this.open(input));
    input.addEventListener("input", () => {
      if (this.input !== input) this.open(input);
      else this.refresh();
    });
    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (this.input === input) this.close();
      }, 120);
    });
    input.addEventListener("keydown", (event) => {
      if (this.input !== input) return;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          this.move(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          this.move(-1);
          break;
        case "Enter":
          if (this.commit()) event.preventDefault();
          break;
        case "Tab":
          if (!event.shiftKey) this.commit();
          break;
        case "Escape":
          this.close();
          break;
      }
    });
  }

  /** Re-read the popup's options from the input's datalist source and re-render. */
  refresh(): void {
    if (!this.input) return;
    this.filtered = filterOptions(this.options, this.input.value);
    this.active = 0;
    this.render();
  }

  /** Returns true if the currently focused input lives inside a matching ancestor selector. */
  ownerMatches(selector: string): boolean {
    return !!this.input?.closest(selector);
  }

  private open(input: HTMLInputElement): void {
    this.input = input;
    this.options = readDatalistValues(input);
    this.filtered = filterOptions(this.options, input.value);
    this.active = 0;
    this.render();
    this.popup.hidden = false;
    this.position();
  }

  private close(): void {
    this.popup.hidden = true;
    this.input = null;
  }

  private commit(idx?: number): boolean {
    if (!this.input) return false;
    const target = this.filtered[idx ?? this.active];
    if (!target) return false;
    this.input.value = target.value;
    this.input.dispatchEvent(new Event("input", { bubbles: true }));
    this.input.dispatchEvent(new Event("change", { bubbles: true }));
    this.close();
    return true;
  }

  private move(delta: number): void {
    if (!this.filtered.length) return;
    const n = this.filtered.length;
    this.active = (this.active + delta + n) % n;
    this.render();
    const activeEl = this.popup.querySelector<HTMLElement>(".combobox-item.active");
    activeEl?.scrollIntoView({ block: "nearest" });
  }

  private render(): void {
    this.popup.replaceChildren();
    if (!this.filtered.length) {
      const empty = document.createElement("div");
      empty.className = "combobox-empty";
      empty.textContent = "Sem resultados";
      this.popup.append(empty);
      return;
    }
    this.filtered.forEach((entry, idx) => {
      const item = document.createElement("div");
      item.className = "combobox-item" + (idx === this.active ? " active" : "");
      item.setAttribute("role", "option");
      item.dataset.index = String(idx);
      const { value, match } = entry;
      if (match) {
        item.append(document.createTextNode(value.slice(0, match.start)));
        const mark = document.createElement("mark");
        mark.textContent = value.slice(match.start, match.end);
        item.append(mark);
        item.append(document.createTextNode(value.slice(match.end)));
      } else {
        item.textContent = value;
      }
      this.popup.append(item);
    });
  }

  // Arrow function so it can be used as an event listener without losing `this`.
  private position = (): void => {
    if (!this.input) return;
    const rect = this.input.getBoundingClientRect();
    this.popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
    this.popup.style.left = `${rect.left + window.scrollX}px`;
    this.popup.style.minWidth = `${rect.width}px`;
  };
}

function readDatalistValues(input: HTMLInputElement): string[] {
  const listId = input.dataset.list;
  if (!listId) return [];
  const datalist = document.getElementById(listId);
  if (!(datalist instanceof HTMLDataListElement)) return [];
  return Array.from(datalist.options, (o) => o.value);
}

interface ScoredOption {
  value: string;
  score: number;
  index: number;
}

function scoreOption(option: string, query: string): { score: number; index: number } | null {
  if (!query) return { score: 0, index: 0 };
  const lower = option.toLowerCase();
  if (lower === query) return { score: 0, index: 0 };
  if (lower.startsWith(query)) return { score: 1, index: 0 };
  const i = lower.indexOf(query);
  if (i >= 0) return { score: 2, index: i };
  return null;
}

export function filterOptions(options: readonly string[], rawQuery: string): ComboboxItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return options.map((value) => ({ value, match: null }));
  const scored: ScoredOption[] = [];
  for (const value of options) {
    const s = scoreOption(value, q);
    if (s) scored.push({ value, score: s.score, index: s.index });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.index - b.index ||
      a.value.localeCompare(b.value),
  );
  return scored.map(({ value, index }) => ({
    value,
    match: index >= 0 ? { start: index, end: index + q.length } : null,
  }));
}
