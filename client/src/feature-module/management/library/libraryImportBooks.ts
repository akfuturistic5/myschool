import * as XLSX from "xlsx";

/** Recognized column keys after header normalization */
const KNOWN = new Set([
  "book_title",
  "category",
  "category_id",
  "category_name",
  "total_copies",
  "book_code",
  "author",
  "isbn",
  "publisher",
  "publication_year",
  "available_copies",
  "book_price",
  "price",
  "book_location",
  "location",
  "description",
]);

export function normKey(k: string): string {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function rowToBook(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    let nk = normKey(k);
    if (nk === "location") nk = "book_location";
    if (nk === "price") nk = "book_price";
    if (!KNOWN.has(nk)) continue;
    const v = row[k];
    out[nk] = v === "" || v === undefined ? null : v;
  }
  return out;
}

function coerceNumbers(o: Record<string, unknown>) {
  const numFields = [
    "category_id",
    "total_copies",
    "available_copies",
    "publication_year",
    "book_price",
  ] as const;
  for (const f of numFields) {
    if (o[f] == null || o[f] === "") continue;
    const n = typeof o[f] === "number" ? o[f] : parseFloat(String(o[f]));
    if (Number.isFinite(n)) o[f] = f === "total_copies" || f === "available_copies" || f === "publication_year" ? Math.trunc(n) : n;
  }
}

/** Prefer sheet named "Data" (case-insensitive), else first sheet whose rows include book_title. */
function pickDataSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const names = wb.SheetNames || [];
  const byName = names.find((n) => n.trim().toLowerCase() === "data");
  if (byName) return wb.Sheets[byName];
  for (const name of names) {
    const ws = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (json.some((r) => Object.keys(r).some((k) => normKey(k) === "book_title"))) {
      return ws;
    }
  }
  return wb.Sheets[names[0]];
}

/** Parse uploaded .xlsx / .xls / .csv into book row objects for POST /library/books/import */
export function parseBooksImportFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const name = file.name.toLowerCase();
        const raw = e.target?.result;
        if (name.endsWith(".csv")) {
          const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
          resolve(parseCsvLoose(text));
          return;
        }
        const wb = XLSX.read(raw, { type: "array" });
        const ws = pickDataSheet(wb);
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const books = json
          .map((r) => {
            const o = rowToBook(r);
            coerceNumbers(o);
            return o;
          })
          .filter((o) => o.book_title != null && String(o.book_title).trim() !== "");
        resolve(books);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

function parseCsvLoose(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("File must include a header row and at least one data row.");
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        q = !q;
        continue;
      }
      if (!q && c === ",") {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const header = parseLine(lines[0]).map(normKey);
  const ti = header.indexOf("book_title");
  if (ti < 0) throw new Error('File must include a "book_title" column.');
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const o: Record<string, unknown> = {};
    header.forEach((h, j) => {
      if (!h) return;
      let key = h;
      if (key === "location") key = "book_location";
      if (key === "price") key = "book_price";
      if (!KNOWN.has(key)) return;
      o[key] = cells[j] ?? "";
    });
    if (o.book_title != null && String(o.book_title).trim() !== "") {
      coerceNumbers(o);
      rows.push(o);
    }
  }
  return rows;
}

/**
 * Excel template: Guide (required vs optional) + Data (headers + demo row).
 * Column "category" accepts category name or numeric id.
 */
export function downloadLibraryBooksImportTemplate() {
  const guide: (string | number)[][] = [
    ["Library books — import template"],
    [""],
    ["SECTION 1 — REQUIRED FIELDS (every data row must have these)"],
    ["book_title", "Full title of the book"],
    ["category", "Category name OR numeric category id (must exist in Library)"],
    ["total_copies", "Integer ≥ 1"],
    [""],
    ["SECTION 2 — OPTIONAL FIELDS"],
    [
      "book_code",
      "author",
      "isbn",
      "publisher",
      "publication_year",
      "book_price",
      "book_location",
      "description",
    ],
    [""],
    ["Enter your rows on the Data sheet. Remove the demo row or replace it with real data."],
  ];

  const dataHeaders = [
    "book_title",
    "category",
    "total_copies",
    "book_code",
    "author",
    "isbn",
    "publisher",
    "publication_year",
    "book_price",
    "book_location",
    "description",
  ];

  const demoRow = [
    "Demo: Introduction to Physics",
    "Science",
    5,
    "PHY-INT-01",
    "A. Kumar",
    "",
    "Pearson",
    2023,
    499.5,
    "Rack B2",
    "Lab use only",
  ];

  const wb = XLSX.utils.book_new();
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  XLSX.utils.book_append_sheet(wb, wsGuide, "Guide");
  const wsData = XLSX.utils.aoa_to_sheet([dataHeaders, demoRow]);
  XLSX.utils.book_append_sheet(wb, wsData, "Data");
  XLSX.writeFile(wb, "library-books-import-template.xlsx");
}
