const valueText = (value) => {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  if (typeof value === "object") return "—";
  return String(value);
};

const appendText = (document, parent, tag, value, className) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = valueText(value);
  parent.appendChild(element);
  return element;
};

export function openSafePrintReport({
  title,
  subtitle = "",
  resultCount,
  sections = [],
  windowObject = globalThis.window,
}) {
  const printWindow = windowObject?.open?.("", "_blank");
  if (!printWindow) return false;
  const { document } = printWindow;
  document.documentElement.dir = "rtl";
  document.documentElement.lang = "he";
  document.title = valueText(title);

  const style = document.createElement("style");
  style.textContent = `
    @page { size: A4; margin: 14mm 11mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, "Segoe UI", sans-serif; color:#222; margin:0; direction:rtl; }
    h1 { color:#8b0000; text-align:center; font-size:22px; margin:0 0 5px; }
    .subtitle,.print-meta { text-align:center; color:#555; margin-bottom:12px; font-size:12px; }
    section { margin:14px 0; break-inside:avoid-page; }
    h2 { color:#8b0000; font-size:16px; border-bottom:2px solid #8b0000; padding-bottom:5px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    thead { display:table-header-group; }
    tr { break-inside:avoid; page-break-inside:avoid; }
    th { background:#8b0000; color:#fff; }
    th,td { border:1px solid #bbb; padding:5px; text-align:right; vertical-align:top; }
    tbody tr:nth-child(even) { background:#faf7f5; }
    dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 18px; }
    .pair { display:grid; grid-template-columns:120px 1fr; border-bottom:1px solid #eee; padding:4px 0; }
    dt { font-weight:700; } dd { margin:0; overflow-wrap:anywhere; }
    .empty { color:#777; font-style:italic; padding:8px; }
  `;
  document.head.appendChild(style);
  appendText(document, document.body, "h1", title);
  if (subtitle) appendText(document, document.body, "div", subtitle, "subtitle");
  const meta = `${new Date().toLocaleString("he-IL")}${resultCount == null ? "" : ` • ${resultCount} רשומות`}`;
  appendText(document, document.body, "div", meta, "print-meta");

  sections.forEach((section) => {
    const wrapper = document.createElement("section");
    appendText(document, wrapper, "h2", section.title);
    if (section.kind === "metadata") {
      const list = document.createElement("dl");
      (section.entries || []).forEach(([label, value]) => {
        const pair = document.createElement("div");
        pair.className = "pair";
        appendText(document, pair, "dt", label);
        appendText(document, pair, "dd", value);
        list.appendChild(pair);
      });
      wrapper.appendChild(list);
    } else if (!(section.rows || []).length) {
      appendText(document, wrapper, "div", "אין נתונים", "empty");
    } else {
      const table = document.createElement("table");
      const head = document.createElement("thead");
      const headerRow = document.createElement("tr");
      (section.columns || []).forEach(([, label]) => appendText(document, headerRow, "th", label));
      head.appendChild(headerRow);
      table.appendChild(head);
      const body = document.createElement("tbody");
      section.rows.forEach((row) => {
        const tr = document.createElement("tr");
        section.columns.forEach(([key]) => appendText(document, tr, "td", row[key]));
        body.appendChild(tr);
      });
      table.appendChild(body);
      wrapper.appendChild(table);
    }
    document.body.appendChild(wrapper);
  });

  windowObject.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 100);
  return true;
}

export { valueText as safePrintValue };
