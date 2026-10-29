const ExcelJS = require('exceljs');
const path = require('path');

function getCellStr(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if (cell.value.result !== undefined) return String(cell.value.result);
    if (cell.value.richText) return cell.value.richText.map(t => t.text).join('');
    if (cell.value.text) return String(cell.value.text);
    if (cell.value.formula) return `[Formula: ${cell.value.formula} | Res: ${cell.value.result}]`;
    return JSON.stringify(cell.value);
  }
  return String(cell.value);
}

async function inspectAll() {
  const filePath = path.join(__dirname, '../../../TAREAS_QF_DROGUERÍA_ACTUAL.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet1 = workbook.getWorksheet(1);
  console.log('=== CALENDARIO COMPLETO (Sheet 1) ===');
  for (let r = 1; r <= sheet1.rowCount; r++) {
    const row = sheet1.getRow(r);
    const cells = [];
    for (let c = 1; c <= 14; c++) {
      const val = getCellStr(row.getCell(c)).trim();
      if (val) {
        cells.push(`C${c}: "${val}"`);
      }
    }
    if (cells.length > 0) {
      console.log(`Fila ${r}: ${cells.join(' | ')}`);
    }
  }

  console.log('\n=== REVISANDO OTRAS HOJAS PARA CONTEXTO ===');
  for (let i = 2; i <= workbook.worksheets.length; i++) {
    const ws = workbook.getWorksheet(i);
    console.log(`\n--- Hoja ${i}: ${ws.name} (Filas: ${ws.rowCount}) ---`);
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const row = ws.getRow(r);
      const cells = [];
      for (let c = 1; c <= 10; c++) {
        const val = getCellStr(row.getCell(c)).trim();
        if (val) cells.push(`C${c}: "${val}"`);
      }
      if (cells.length > 0) console.log(`  R${r}: ${cells.join(' | ')}`);
    }
  }
}

inspectAll().catch(console.error);
