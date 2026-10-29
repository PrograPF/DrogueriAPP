// Prueba autónoma del exportador Excel (datos temporales en memoria, NO toca la base de datos)
// Uso: npx -y tsx src/scratch/test_export_excel.mjs
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

// --- Stubs mínimos del navegador para capturar la descarga ---
let captured = null;
globalThis.document = {
  createElement: () => ({ click() { captured = { href: this.href, name: this.download }; }, set href(v) { this._h = v; }, get href() { return this._h; } }),
  body: { appendChild() {}, removeChild() {} }
};
const blobs = new Map();
const origCreate = URL.createObjectURL;
URL.createObjectURL = (b) => { const u = 'blob:test/' + blobs.size; blobs.set(u, b); return u; };
URL.revokeObjectURL = () => {};

const { exportarOcsExcel, calcularMetricasOc } = await import('../utils/exportOcExcel.js');

const catalog = { '419': 'GUANTES NITRILO S (CAJA X 100)', '418': 'GUANTES NITRILO M (CAJA X 100)', '417': 'GUANTES NITRILO L (CAJA X 100)' };
const oc = {
  id: 'tmp-1', numero_oc: '2332-40-CM26', tipo_oc: 'CM', estado: 'Aceptada',
  proveedor: 'HOSPITALIA PRODUCTOS MEDICOS SPA', rut_proveedor: '78233420-4', solicitud_compra: 'SC-1',
  fecha_envio: '2026-10-01T12:00:00Z', fecha_aceptacion: '2026-10-02T12:00:00Z',
  fecha_tope_entrega: '2026-11-10', total_neto: 18213280,
  ordenes_compra_articulos: [
    { id: 'a1', codigo_articulo: '419', cantidad: 6000, cantidad_recepcionada: 2000, precio_unitario: 1699 },
    { id: 'a2', codigo_articulo: '418', cantidad: 4000, cantidad_recepcionada: 1500, precio_unitario: 1699 },
    { id: 'a3', codigo_articulo: '417', cantidad: 720, cantidad_recepcionada: 240, precio_unitario: 1699 }
  ]
};
const oc2 = { ...oc, id: 'tmp-2', numero_oc: '9999-1-AG26', tipo_oc: 'AG', total_neto: null,
  ordenes_compra_articulos: [{ id: 'b1', codigo_articulo: '419', cantidad: 10, cantidad_recepcionada: 4, precio_unitario: 100 }] };

const ok = []; const fail = [];
const check = (name, cond, extra = '') => (cond ? ok : fail).push(`${name}${extra ? ' → ' + extra : ''}`);

// 1) Métricas (deben coincidir con la imagen del usuario)
const m = calcularMetricasOc(oc);
check('Total neto = 18.213.280', m.totalNeto === 18213280, m.totalNeto);
check('Recepcionado neto = 6.354.260', m.recepcionadoNeto === 6354260, m.recepcionadoNeto);
check('Saldo faltante neto = 11.859.020', m.saldoFaltanteNeto === 11859020, m.saldoFaltanteNeto);
check('Saldo c/IVA = 14.112.234', m.saldoFaltanteIva === 14112234, m.saldoFaltanteIva);
check('Un. recibidas 3740 de 10720', m.totalRec === 3740 && m.totalSol === 10720);
check('Avance 35%', Math.round(m.avance * 100) === 35);

const outDir = path.resolve('src/scratch/_out'); fs.mkdirSync(outDir, { recursive: true });
const plazosFake = (o) => ({ isYellow: o.id === 'tmp-2', isExpired: false, isOrange: false, isRosa: false, isPurpura: false, alertMessage: 'Mensaje de plazo' });

for (const tab of ['list', 'alertas', 'recepcion', 'valorizados']) {
  captured = null;
  const res = await exportarOcsExcel({ tab, ocs: [oc, oc2], catalog, getPlazos: plazosFake, filtros: [['Búsqueda', ''], ['Estado', 'Todos los estados']] });
  check(`[${tab}] descarga generada`, !!captured && /^Gestion_OC_.*\.xlsx$/.test(captured.name), captured?.name);
  const buf = Buffer.from(await blobs.get(captured.href).arrayBuffer());
  const file = path.join(outDir, captured.name); fs.writeFileSync(file, buf);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  check(`[${tab}] 2 hojas (datos + filtros)`, wb.worksheets.length === 2, wb.worksheets.map(w => w.name).join(' | '));
  const ws = wb.worksheets[0];
  // fila 5 = primera OC ; 6 = subheader ; 7..9 = artículos ; 10 = OC2
  check(`[${tab}] OC1 en fila 5`, ws.getRow(5).getCell(1).value === '2332-40-CM26');
  check(`[${tab}] subheader artículos agrupado`, ws.getRow(6).outlineLevel === 1 && ws.getRow(6).getCell(1).value === 'Código');
  check(`[${tab}] 3 artículos con descripción`, ws.getRow(7).getCell(2).value === catalog['419'] && ws.getRow(9).getCell(1).value === '417');
  check(`[${tab}] faltante/saldo art 419`, ws.getRow(7).getCell(7).value === 4000 && ws.getRow(7).getCell(9).value === 6796000 && ws.getRow(7).getCell(10).value === 8087240);
  check(`[${tab}] OC2 en fila 10`, ws.getRow(10).getCell(1).value === '9999-1-AG26');
  const last = ws.getRow(13); // 10 OC2, 11 sub, 12 art, 13 total
  check(`[${tab}] fila TOTAL`, String(last.getCell(1).value).startsWith('TOTAL (2 OC)'), last.getCell(1).value);
  const hdr = ws.getRow(4).values.slice(1);
  if (tab === 'valorizados') {
    const iSaldo = hdr.indexOf('Saldo faltante neto') + 1;
    check('[valorizados] saldo neto OC1', ws.getRow(5).getCell(iSaldo).value === 11859020);
    const iIva = hdr.indexOf('Saldo c/IVA') + 1;
    check('[valorizados] saldo c/IVA OC1', ws.getRow(5).getCell(iIva).value === 14112234);
  }
  const wf = wb.worksheets[1];
  check(`[${tab}] hoja filtros con datos`, wf.getRow(3).getCell(1).value === 'Pestaña exportada');
}

console.log(`\nOK: ${ok.length}  FALLAS: ${fail.length}`);
ok.forEach(x => console.log('  ✔', x)); fail.forEach(x => console.log('  ✘', x));
console.log('Archivos de muestra en:', outDir);
process.exit(fail.length ? 1 : 0);
