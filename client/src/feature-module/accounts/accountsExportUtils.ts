import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type AccountsExportColumn = { key: string; header: string };

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportAccountsExcel(
  rows: Record<string, unknown>[],
  columns: AccountsExportColumn[],
  baseName: string
) {
  const data = rows.map((row) => {
    const o: Record<string, unknown> = {};
    for (const c of columns) o[c.header] = row[c.key];
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  XLSX.writeFile(wb, `${baseName}.xlsx`);
}

export function exportAccountsPdf(
  rows: Record<string, unknown>[],
  columns: AccountsExportColumn[],
  baseName: string,
  title?: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  let y = 14;
  if (title) {
    doc.setFontSize(11);
    doc.text(title, 40, y);
    y += 18;
  }
  const body = rows.map((row) => columns.map((c) => String(row[c.key] ?? "")));
  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: body.length ? body : [["—"]],
    startY: y,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [61, 94, 225] },
  });
  doc.save(`${baseName}.pdf`);
}

/** Opens a print dialog with a simple HTML table built from current data. */
export function printAccountsData(title: string, columns: AccountsExportColumn[], rows: Record<string, unknown>[]) {
  const w = window.open("", "_blank");
  if (!w) return;
  const head = `<thead><tr>${columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("")}</tr></thead>`;
  const body =
    `<tbody>` +
    rows
      .map(
        (row) =>
          `<tr>${columns.map((c) => `<td>${escapeHtml(String(row[c.key] ?? ""))}</td>`).join("")}</tr>`
      )
      .join("") +
    `</tbody>`;
  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:16px;}
    h2{font-size:18px;margin:0 0 12px;}
    table{border-collapse:collapse;width:100%;font-size:12px;}
    th,td{border:1px solid #ccc;padding:6px;text-align:left;}
    th{background:#f5f5f5;}
  </style></head><body>
  <h2>${escapeHtml(title)}</h2>
  <table>${head}${body}</table>
  </body></html>`);
  w.document.close();
  setTimeout(() => {
    if (w && !w.closed) {
      w.focus();
      w.print();
      w.close();
    }
  }, 250);
}
