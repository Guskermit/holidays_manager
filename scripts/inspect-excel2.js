const XLSX = require("xlsx");
const path = require("path");

const EXCEL_FILE = path.join(
  "/Users/Gustavo.LopezMartinez/Library/CloudStorage/OneDrive-EY/Documents/code/holidays_manager",
  "Imputaciones NH 2026migracion.xlsx"
);

const wb = XLSX.readFile(EXCEL_FILE);
console.log("Total hojas:", wb.SheetNames.length);
console.log("Nombres:", JSON.stringify(wb.SheetNames, null, 2));

// Inspect all sheets
wb.SheetNames.forEach((name) => {
  const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
  console.log("\n=== " + name + " === (" + data.length + " filas)");
  data.slice(0, 4).forEach((r, i) => console.log("  fila", i, ":", JSON.stringify(r)));
});
