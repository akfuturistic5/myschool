import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportDesignationsExcel(filename: string, rows: Record<string, string | number>[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No data available for Excel export.");
  }
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Designations");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportDesignationsPdf(title: string, filename: string, rows: Record<string, string | number>[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No data available for PDF export.");
  }
  const headers = Object.keys(rows[0]);
  const doc = new jsPDF();
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));
  doc.text(title, 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [headers],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
  });
  doc.save(`${filename}.pdf`);
}

/** Opens a print dialog with a simple table (escapes cell text; no backend). */
export function printDesignationsTable(title: string, rows: Record<string, string | number>[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No data to print.");
  }
  const headers = Object.keys(rows[0]);
  const thead = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map(
      (r) =>
        `<tr>${headers.map((h) => `<td>${escapeHtml(String(r[h] ?? ""))}</td>`).join("")}</tr>`
    )
    .join("");

  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    throw new Error("Pop-up blocked. Allow pop-ups for this site to print.");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #2980b9; color: #fff; }
    @media print {
      body { margin: 12px; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
  win.addEventListener(
    "afterprint",
    () => {
      try {
        win.close();
      } catch {
        /* ignore */
      }
    },
    { once: true }
  );
  setTimeout(() => {
    win.print();
  }, 100);
}
