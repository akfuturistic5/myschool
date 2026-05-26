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

export type DepartmentExportRow = Record<string, string>;

export function buildDepartmentExportRows(
  rows: Array<{
    id?: string | number;
    department?: string;
    departmentCode?: string;
    headOfDepartment?: string;
    status?: string;
  }>
): DepartmentExportRow[] {
  return rows.map((row) => ({
    ID: String(row.id ?? ""),
    Department: String(row.department ?? ""),
    Code: row.departmentCode === "—" ? "" : String(row.departmentCode ?? ""),
    "Head of department":
      row.headOfDepartment === "—" ? "" : String(row.headOfDepartment ?? ""),
    Status: String(row.status ?? ""),
  }));
}

export function exportDepartmentsExcel(filename: string, rows: DepartmentExportRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No departments available for Excel export.");
  }
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Departments");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportDepartmentsPdf(
  title: string,
  filename: string,
  rows: DepartmentExportRow[]
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No departments available for PDF export.");
  }
  const headers = Object.keys(rows[0]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(title, 40, 34);
  doc.setFontSize(9);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 50);
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));
  autoTable(doc, {
    startY: 62,
    head: [headers],
    body,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: {
      fillColor: [67, 97, 238],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${filename}.pdf`);
}

/** Opens a print dialog with a simple table (escapes cell text; client-side only). */
export function printDepartmentsTable(title: string, rows: DepartmentExportRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No departments to print.");
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
    th { background: #4361ee; color: #fff; }
    @media print {
      body { margin: 12px; }
      @page { size: landscape; }
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
