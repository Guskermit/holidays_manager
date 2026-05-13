const XLSX = require("xlsx");
const path = require("path");

const EXCEL_FILE = path.join(
  "/Users/Gustavo.LopezMartinez/Library/CloudStorage/OneDrive-EY/Documents/code/holidays_manager",
  "Imputaciones NH 2026migracion.xlsx"
);

const wb = XLSX.readFile(EXCEL_FILE);
const firstSheet = wb.SheetNames[0];
const data = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1 });
const headers = data[3] || [];

console.log("Columnas con nombre (fila 3):");
headers.forEach((h, idx) => {
  if (h && typeof h === "string") {
    const col = String.fromCharCode(65 + idx); // A, B, C...
    const normalized = h.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
    console.log(`  col ${String(idx).padStart(2)} (${col}): ${JSON.stringify(normalized)}`);
  }
});
