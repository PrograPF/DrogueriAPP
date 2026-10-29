const ExcelJS = require('exceljs');
const path = require('path');

async function inspect() {
  const filePath = path.join(__dirname, '../../../TAREAS_QF_DROGUERÍA_ACTUAL.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log('Sheet Names:', workbook.worksheets.map(w => w.name));

  const sheet1 = workbook.getWorksheet(1);
  console.log('\n--- Sheet 1 Name:', sheet1.name, '---');
  console.log('Row count:', sheet1.rowCount);
  console.log('Column count:', sheet1.columnCount);

  for (let r = 1; r <= Math.min(sheet1.rowCount, 60); r++) {
    const row = sheet1.getRow(r);
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      let val = cell.value;
      if (val && typeof val === 'object') {
        if (val.result !== undefined) val = val.result;
        else if (val.richText) val = val.richText.map(t => t.text).join('');
        else if (val.text) val = val.text;
      }
      values.push(`[C${colNumber}]: ${val}`);
    });
    if (values.length > 0) {
      console.log(`R${r}: ` + values.join(' | '));
    }
  }
}

inspect().catch(console.error);
