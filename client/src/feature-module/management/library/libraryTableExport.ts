import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportCell = string | number | boolean | null | undefined;

/**
 * Excel export; yields to the event loop first so the UI can show a loading state.
 */
export function exportRowsToXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: ExportCell[][]
): Promise<void> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try {
        const safeName = (sheetName || "Sheet1").slice(0, 31);
        const aoa: ExportCell[][] = [headers, ...rows.map((r) => r.map((c) => (c == null ? "" : c)))];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, safeName);
        const name = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
        XLSX.writeFile(wb, name);
        resolve();
      } catch (e) {
        reject(e);
      }
    }, 0);
  });
}

/**
 * PDF table via jsPDF + autoTable (multi-page for large datasets).
 */
export function exportRowsToPdf(title: string, headers: string[], rows: ExportCell[][]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(12);
  doc.text(title, 40, 36);
  autoTable(doc, {
    startY: 48,
    head: [headers],
    body: rows.map((r) => r.map((c) => (c == null ? "" : String(c)))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [66, 139, 202] },
    margin: { left: 40, right: 40 },
  });
  const safe = title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "export";
  doc.save(`${safe}.pdf`);
}
