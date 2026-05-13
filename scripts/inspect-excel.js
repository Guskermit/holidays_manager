const XLSX = require('xlsx');
const wb = XLSX.readFile('Imputaciones NH 2026migracion.xlsx');

// Excel serial date → JS Date
function excelSerialToDate(serial) {
  // Excel epoch: Dec 30, 1899
  const msPerDay = 86400000;
  const excelEpoch = new Date(1899, 11, 30);
  return new Date(excelEpoch.getTime() + serial * msPerDay);
}

// Parse week_start from row 0 of a sheet
function parseWeekStart(row0val) {
  if (typeof row0val === 'string') {
    // "06.01 al 10.01 del 2025" or "02.02 al 06.02 del 2026"
    const m = row0val.match(/(\d{2})\.(\d{2}).*del (\d{4})/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  if (typeof row0val === 'number' && row0val > 40000) {
    const d = excelSerialToDate(row0val);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return null;
}

// Is this a weekly sheet (not a monthly summary)?
function isWeeklySheet(name) {
  return /^[Ss]emana\s?\d{4}$/.test(name);
}

console.log('Hojas semanales y sus week_start parseados:\n');
let unparseable = [];
wb.SheetNames.forEach(name => {
  if (!isWeeklySheet(name)) return;
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row0 = data[0] && data[0][0];
  const weekStart = parseWeekStart(row0);
  // Find "Minor Hotels Request" column index in row 3
  const headers = data[3] || [];
  const minorColIdx = headers.findIndex(h => typeof h === 'string' && h.toLowerCase().includes('minor'));
  if (!weekStart) {
    unparseable.push({ name, row0 });
  } else {
    console.log(`  ${name.padEnd(16)} → ${weekStart}  minor_col=${minorColIdx >= 0 ? minorColIdx + ' ("' + headers[minorColIdx] + '")' : 'NOT FOUND'}`);
  }
});

if (unparseable.length) {
  console.log('\nSin parsear:');
  unparseable.forEach(u => console.log('  ', u.name, '→ row0:', JSON.stringify(u.row0)));
}

