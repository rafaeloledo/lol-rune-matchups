// Small DOM helpers that fail loudly when an expected element is missing,
// keeping the rest of the code free of `!` non-null assertions.

export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`element not found: ${selector}`);
  return el;
}

export function $byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element not found: #${id}`);
  return el as T;
}

export function $all<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function fillDatalist(id: string, values: readonly string[]): void {
  const datalist = document.getElementById(id);
  if (!datalist) return;
  datalist.replaceChildren(
    ...values.map((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      return opt;
    }),
  );
}
