// =============================================================================
// Exportación a Excel del módulo Gestión OC (todas las pestañas)
//
// Genera un archivo .xlsx con EXACTAMENTE las órdenes que la pestaña muestra en
// pantalla (según búsqueda / filtros activos). Cada OC ocupa una fila principal y
// sus artículos quedan agrupados (desplegables +/-) justo debajo.
//
// Las fórmulas de montos replican las de la pestaña "Valorizados" para que el
// Excel nunca difiera de lo que se ve en pantalla.
// =============================================================================
import { formatDate } from './dateFormatter';
import { formatISOToDisplay } from './plazosHelper';

const IVA = 1.19;

// Paleta (pensada para hoja blanca de Excel; colores equivalentes a los de la UI)
const C = {
  title: 'FF0F172A',
  header: 'FF1E3A5F',
  ocRow: 'FFE6F0FA',
  subHeader: 'FF64748B',
  artRow: 'FFFFFFFF',
  artRowAlt: 'FFF8FAFC',
  totalRow: 'FF0F172A',
  white: 'FFFFFFFF',
  text: 'FF0F172A',
  muted: 'FF64748B',
  border: 'FFCBD5E1',
  blue: 'FF2563EB',
  green: 'FF059669',
  orange: 'FFD97706',
  purple: 'FF9333EA',
  red: 'FFDC2626',
  rose: 'FFDB2777',
  yellow: 'FFCA8A04'
};

const FMT_CLP = '"$"#,##0';
const FMT_UN = '#,##0';
const FMT_PCT = '0%';

const num = (v) => Number(v) || 0;

// -----------------------------------------------------------------------------
// Métricas de una OC (mismas fórmulas que ocsValorizados en SeguimientoOCModule)
// -----------------------------------------------------------------------------
export const calcularMetricasOc = (oc) => {
  const arts = oc.ordenes_compra_articulos || [];
  const totalSol = arts.reduce((s, a) => s + num(a.cantidad), 0);
  const totalRec = arts.reduce((s, a) => s + num(a.cantidad_recepcionada), 0);
  const subtotalArts = oc.subtotal_articulos != null
    ? Number(oc.subtotal_articulos)
    : arts.reduce((s, a) => s + num(a.cantidad) * num(a.precio_unitario), 0);
  const totalNeto = oc.total_neto != null
    ? Number(oc.total_neto)
    : Math.max(0, subtotalArts - num(oc.descuento) + num(oc.cargo));
  const recepcionadoNeto = arts.reduce((s, a) => s + num(a.cantidad_recepcionada) * num(a.precio_unitario), 0);
  const saldoFaltanteNeto = Math.max(0, totalNeto - recepcionadoNeto);
  const saldoFaltanteIva = Math.round(saldoFaltanteNeto * IVA);
  const avance = totalSol > 0 ? totalRec / totalSol : 0;
  const articulosIncompletos = arts.filter(a => num(a.cantidad_recepcionada) < num(a.cantidad));
  return {
    totalSol, totalRec, totalNeto, recepcionadoNeto,
    saldoFaltanteNeto, saldoFaltanteIva, avance,
    totalArts: arts.length,
    totalArtsIncompletos: articulosIncompletos.length
  };
};

const nivelAlerta = (plazos = {}, oc = {}) => {
  if (plazos.isPurpura || oc.estado === 'Excepciones') return { label: 'Púrpura (excepción)', color: C.purple };
  if (plazos.isRosa) return { label: 'Rosa (insistencia SE)', color: C.rose };
  if (plazos.isExpired) return { label: 'Roja (plazo vencido)', color: C.red };
  if (plazos.isYellow) return { label: 'Amarilla', color: C.yellow };
  if (plazos.isOrange) return { label: 'Naranja (multa)', color: C.orange };
  return { label: 'Sin alerta', color: C.muted };
};

const colorAvance = (v) => (v >= 0.67 ? C.green : v >= 0.34 ? C.orange : C.red);

// -----------------------------------------------------------------------------
// Definición de columnas por pestaña. Las 5 primeras son iguales en todas para que
// el bloque de artículos (merge B:D) calce siempre con los mismos anchos.
// get(ctx) -> valor ; color(valor, ctx) -> color de fuente opcional
// -----------------------------------------------------------------------------
const COL_BASE = [
  { header: 'N° OC', width: 16, get: ({ oc }) => oc.numero_oc || '', bold: true, color: () => C.blue },
  { header: 'Tipo', width: 10, align: 'center', get: ({ oc }) => oc.tipo_oc || '' },
  { header: 'Estado', width: 26, get: ({ oc }) => oc.estado || '' },
  { header: 'Proveedor', width: 38, get: ({ oc }) => oc.proveedor || '', bold: true },
  { header: 'RUT', width: 16, get: ({ oc }) => oc.rut_proveedor || 'No registrado' }
];

const COLS_GENERAL = [
  ...COL_BASE,
  { header: 'Solicitud', width: 16, get: ({ oc }) => oc.solicitud_compra || '' },
  { header: 'F. Envío', width: 14, align: 'center', get: ({ oc }) => formatDate(oc.fecha_envio) },
  { header: 'F. Aceptación', width: 14, align: 'center', get: ({ oc }) => formatDate(oc.fecha_aceptacion) },
  { header: 'Tope Aceptación', width: 15, align: 'center', get: ({ oc }) => oc.fecha_tope_aceptacion ? formatISOToDisplay(oc.fecha_tope_aceptacion) : '' },
  { header: 'Tope Entrega', width: 15, align: 'center', get: ({ oc }) => oc.fecha_tope_entrega ? formatISOToDisplay(oc.fecha_tope_entrega) : '' },
  { header: 'Tope Multa', width: 15, align: 'center', get: ({ oc }) => oc.fecha_tope_multa ? formatISOToDisplay(oc.fecha_tope_multa) : '' },
  { header: 'Insistencia (SE)', width: 15, align: 'center', get: ({ oc }) => (oc.tipo_oc === 'SE' && oc.fecha_insistencia) ? formatISOToDisplay(oc.fecha_insistencia) : '' },
  { header: 'Nivel de alerta', width: 22, get: ({ oc, plazos }) => nivelAlerta(plazos, oc).label, color: (_v, { oc, plazos }) => nivelAlerta(plazos, oc).color, bold: true },
  { header: 'Detalle del plazo / alerta', width: 48, wrap: true, get: ({ plazos }) => (plazos && plazos.alertMessage) || '' },
  { header: 'Un. solicitadas', width: 15, fmt: FMT_UN, total: true, get: ({ m }) => m.totalSol },
  { header: 'Un. recibidas', width: 15, fmt: FMT_UN, total: true, get: ({ m }) => m.totalRec, color: () => C.green },
  { header: '% Avance', width: 12, fmt: FMT_PCT, align: 'center', get: ({ m }) => m.avance, color: (v) => colorAvance(v), bold: true },
  { header: 'Total neto', width: 16, fmt: FMT_CLP, total: true, get: ({ m }) => m.totalNeto },
  { header: 'Recepcionado neto', width: 18, fmt: FMT_CLP, total: true, get: ({ m }) => m.recepcionadoNeto, color: () => C.green },
  { header: 'Saldo faltante neto', width: 18, fmt: FMT_CLP, total: true, get: ({ m }) => m.saldoFaltanteNeto, color: () => C.orange },
  { header: 'Saldo c/IVA', width: 16, fmt: FMT_CLP, total: true, get: ({ m }) => m.saldoFaltanteIva, color: () => C.purple },
  { header: 'N° artículos', width: 13, fmt: FMT_UN, align: 'center', total: true, get: ({ m }) => m.totalArts }
];

// Pestaña Valorizados: replica las columnas visibles en pantalla
const COLS_VALORIZADOS = [
  ...COL_BASE,
  { header: 'Solicitud', width: 16, get: ({ oc }) => oc.solicitud_compra || '' },
  { header: '% Avance', width: 12, fmt: FMT_PCT, align: 'center', get: ({ m }) => m.avance, color: (v) => colorAvance(v), bold: true },
  { header: 'Un. recibidas', width: 15, fmt: FMT_UN, total: true, get: ({ m }) => m.totalRec, color: () => C.green },
  { header: 'Un. solicitadas', width: 15, fmt: FMT_UN, total: true, get: ({ m }) => m.totalSol },
  { header: 'Total neto', width: 16, fmt: FMT_CLP, total: true, get: ({ m }) => m.totalNeto },
  { header: 'Recepcionado neto', width: 18, fmt: FMT_CLP, total: true, get: ({ m }) => m.recepcionadoNeto, color: () => C.green },
  { header: 'Saldo faltante neto', width: 18, fmt: FMT_CLP, total: true, get: ({ m }) => m.saldoFaltanteNeto, color: () => C.orange },
  { header: 'Saldo c/IVA', width: 16, fmt: FMT_CLP, total: true, get: ({ m }) => m.saldoFaltanteIva, color: () => C.purple },
  { header: 'Artículos pendientes', width: 18, fmt: FMT_UN, align: 'center', total: true, get: ({ m }) => m.totalArtsIncompletos }
];

const TAB_CONFIG = {
  list: { sheetName: 'Listado OC', title: 'Gestión OC · Seguimiento y Registro', file: 'Listado', columns: COLS_GENERAL },
  alertas: { sheetName: 'Alertas OC', title: 'Gestión OC · Alertas', file: 'Alertas', columns: COLS_GENERAL },
  recepcion: { sheetName: 'Recepcion OC', title: 'Gestión OC · Recepción de Productos', file: 'Recepcion', columns: COLS_GENERAL },
  valorizados: { sheetName: 'Valorizados', title: 'Gestión OC · Órdenes de Compra Valorizadas', file: 'Valorizados', columns: COLS_VALORIZADOS }
};

// Columnas del bloque de artículos (posiciones fijas: A, B:D fusionadas, E..K)
const ART_HEADERS = [
  { col: 1, header: 'Código', align: 'left' },
  { col: 2, header: 'Descripción', align: 'left', mergeTo: 4 },
  { col: 5, header: 'Solicitado', align: 'right' },
  { col: 6, header: 'Recibido', align: 'right' },
  { col: 7, header: 'Faltante', align: 'right' },
  { col: 8, header: 'Precio unit.', align: 'right' },
  { col: 9, header: 'Saldo faltante neto', align: 'right' },
  { col: 10, header: 'Saldo c/IVA', align: 'right' },
  { col: 11, header: 'Estado artículo', align: 'center' }
];

// -----------------------------------------------------------------------------
// Utilidades de estilo
// -----------------------------------------------------------------------------
const thinBorder = () => ({
  top: { style: 'thin', color: { argb: C.border } },
  left: { style: 'thin', color: { argb: C.border } },
  bottom: { style: 'thin', color: { argb: C.border } },
  right: { style: 'thin', color: { argb: C.border } }
});

const styleCell = (cell, { fill, color = C.text, bold = false, size = 10, align = 'left', fmt, wrap = false, italic = false } = {}) => {
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.font = { name: 'Calibri', size, bold, italic, color: { argb: color } };
  cell.alignment = { vertical: 'middle', horizontal: align, wrapText: wrap };
  cell.border = thinBorder();
  if (fmt) cell.numFmt = fmt;
};

const estadoArticulo = (cant, rec) => (rec >= cant && cant > 0 ? 'Completo' : rec > 0 ? 'Parcial' : 'Pendiente');
const colorEstadoArt = (e) => (e === 'Completo' ? C.green : e === 'Parcial' ? C.orange : C.red);

const pad2 = (n) => String(n).padStart(2, '0');
const stampForFile = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`;
const stampForHuman = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const descargarBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

// -----------------------------------------------------------------------------
// Exportación principal
// tab:       'list' | 'alertas' | 'recepcion' | 'valorizados'
// ocs:       lista YA filtrada tal como se ve en pantalla
// catalog:   { codigo_articulo: descripcion }
// getPlazos: función checkPlazos(oc) del módulo (para nivel de alerta)
// filtros:   [[etiqueta, valor], ...] se muestran en la hoja "Filtros aplicados"
// -----------------------------------------------------------------------------
export const exportarOcsExcel = async ({ tab, ocs = [], catalog = {}, getPlazos, filtros = [] }) => {
  const cfg = TAB_CONFIG[tab];
  if (!cfg) throw new Error(`Pestaña desconocida para exportar: ${tab}`);

  const mod = await import('exceljs');
  const ExcelJS = mod.default || mod;

  const now = new Date();
  const columns = cfg.columns;
  const lastCol = columns.length;

  // Ancho mínimo en las columnas donde caen los números del bloque de artículos (E..K)
  const widths = columns.map((c, i) => (i >= 4 && i <= 10 ? Math.max(c.width, 16) : c.width));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DrogueriApp ERP';
  wb.created = now;

  const ws = wb.addWorksheet(cfg.sheetName, {
    properties: { outlineProperties: { summaryBelow: false, summaryRight: false } },
    views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  ws.columns = widths.map(w => ({ width: w }));

  // --- Fila 1: título ---
  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = cfg.title;
  styleCell(t, { fill: C.title, color: C.white, bold: true, size: 16 });
  t.border = {};
  ws.getRow(1).height = 32;

  // --- Fila 2: subtítulo ---
  const totalArticulos = ocs.reduce((s, o) => s + (o.ordenes_compra_articulos || []).length, 0);
  ws.mergeCells(2, 1, 2, lastCol);
  const st = ws.getCell(2, 1);
  st.value = `Exportado el ${stampForHuman(now)}  ·  ${ocs.length} órdenes de compra  ·  ${totalArticulos} artículos  ·  Use los botones [+]/[-] de la izquierda para desplegar el desglose de artículos`;
  styleCell(st, { color: C.muted, italic: true, size: 10 });
  st.border = {};
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 6;

  // --- Fila 4: encabezados de OC ---
  const headRow = ws.getRow(4);
  headRow.height = 32;
  columns.forEach((col, i) => {
    const cell = headRow.getCell(i + 1);
    cell.value = col.header;
    styleCell(cell, {
      fill: C.header, color: C.white, bold: true, size: 10,
      align: col.fmt || col.align === 'center' ? 'center' : 'left', wrap: true
    });
  });

  // --- Filas de OC + artículos ---
  const sumas = columns.map(() => 0);
  let r = 5;

  ocs.forEach((oc) => {
    const m = calcularMetricasOc(oc);
    const plazos = typeof getPlazos === 'function' ? getPlazos(oc) : null;
    const ctx = { oc, m, plazos };

    // Fila principal de la OC
    const ocRow = ws.getRow(r);
    ocRow.height = 24;
    columns.forEach((col, i) => {
      const value = col.get(ctx);
      const cell = ocRow.getCell(i + 1);
      cell.value = value;
      styleCell(cell, {
        fill: C.ocRow,
        color: col.color ? col.color(value, ctx) : C.text,
        bold: col.bold !== false && (col.bold || !!col.fmt),
        align: col.align || (col.fmt ? 'right' : 'left'),
        fmt: col.fmt,
        wrap: !!col.wrap
      });
      if (col.total) sumas[i] += num(value);
    });
    r += 1;

    // Sub-encabezado de artículos (agrupado)
    const arts = oc.ordenes_compra_articulos || [];
    if (arts.length > 0) {
      const subRow = ws.getRow(r);
      subRow.outlineLevel = 1;
      subRow.height = 20;
      ART_HEADERS.forEach(h => {
        const cell = subRow.getCell(h.col);
        cell.value = h.header;
        styleCell(cell, { fill: C.subHeader, color: C.white, bold: true, size: 9, align: h.align, wrap: true });
        if (h.mergeTo) {
          for (let c = h.col + 1; c <= h.mergeTo; c++) styleCell(subRow.getCell(c), { fill: C.subHeader });
          ws.mergeCells(r, h.col, r, h.mergeTo);
        }
      });
      r += 1;

      arts.forEach((a, idx) => {
        const cant = num(a.cantidad);
        const rec = num(a.cantidad_recepcionada);
        const precio = num(a.precio_unitario);
        const faltante = Math.max(0, cant - rec);
        const saldoNeto = faltante * precio;
        const saldoIva = Math.round(saldoNeto * IVA);
        const estado = estadoArticulo(cant, rec);
        const fill = idx % 2 === 0 ? C.artRow : C.artRowAlt;

        const row = ws.getRow(r);
        row.outlineLevel = 1;
        row.height = 20;

        const put = (col, value, opts = {}) => {
          const cell = row.getCell(col);
          cell.value = value;
          styleCell(cell, { fill, size: 10, ...opts });
        };
        put(1, a.codigo_articulo || '', { color: C.blue, bold: true });
        put(2, catalog[a.codigo_articulo] || a.descripcion || '', { wrap: true });
        styleCell(row.getCell(3), { fill });
        styleCell(row.getCell(4), { fill });
        ws.mergeCells(r, 2, r, 4);
        put(5, cant, { fmt: FMT_UN, align: 'right', bold: true });
        put(6, rec, { fmt: FMT_UN, align: 'right', color: C.green, bold: true });
        put(7, faltante, { fmt: FMT_UN, align: 'right', color: faltante > 0 ? C.orange : C.muted, bold: true });
        put(8, precio, { fmt: FMT_CLP, align: 'right' });
        put(9, saldoNeto, { fmt: FMT_CLP, align: 'right', color: C.orange, bold: true });
        put(10, saldoIva, { fmt: FMT_CLP, align: 'right', color: C.purple, bold: true });
        put(11, estado, { align: 'center', color: colorEstadoArt(estado), bold: true });
        r += 1;
      });
    }
  });

  // --- Fila de totales ---
  const totalRow = ws.getRow(r);
  totalRow.height = 26;
  columns.forEach((col, i) => {
    const cell = totalRow.getCell(i + 1);
    if (i === 0) cell.value = `TOTAL (${ocs.length} OC)`;
    else if (col.total) cell.value = sumas[i];
    else cell.value = '';
    styleCell(cell, {
      fill: C.totalRow, color: C.white, bold: true, size: 11,
      align: col.fmt ? 'right' : 'left', fmt: col.total ? col.fmt : undefined
    });
  });
  // Los totales de % no se suman: se recalcula el avance global si existe la columna
  const idxPct = columns.findIndex(c => c.fmt === FMT_PCT);
  const idxSol = columns.findIndex(c => c.header === 'Un. solicitadas');
  const idxRec = columns.findIndex(c => c.header === 'Un. recibidas');
  if (idxPct >= 0 && idxSol >= 0 && idxRec >= 0) {
    const cell = totalRow.getCell(idxPct + 1);
    cell.value = sumas[idxSol] > 0 ? sumas[idxRec] / sumas[idxSol] : 0;
    cell.numFmt = FMT_PCT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // --- Hoja 2: filtros aplicados ---
  const wf = wb.addWorksheet('Filtros aplicados', { views: [{ showGridLines: false }] });
  wf.columns = [{ width: 34 }, { width: 70 }];
  wf.mergeCells(1, 1, 1, 2);
  const ft = wf.getCell(1, 1);
  ft.value = 'Filtros aplicados al momento de exportar';
  styleCell(ft, { fill: C.title, color: C.white, bold: true, size: 14 });
  ft.border = {};
  wf.getRow(1).height = 28;

  const filas = [
    ['Pestaña exportada', cfg.title],
    ...filtros,
    ['Órdenes de compra exportadas', ocs.length],
    ['Artículos exportados', totalArticulos],
    ['Fecha y hora de exportación', stampForHuman(now)]
  ];
  filas.forEach(([k, v], i) => {
    const row = wf.getRow(3 + i);
    row.height = 22;
    styleCell(row.getCell(1), { fill: C.ocRow, bold: true });
    styleCell(row.getCell(2), { fill: C.white, align: 'left', wrap: true });
    row.getCell(1).value = k;
    row.getCell(2).value = (v === '' || v == null) ? '(sin filtro)' : v;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `Gestion_OC_${cfg.file}_${stampForFile(now)}.xlsx`;
  descargarBlob(blob, filename);
  return { filename, ocs: ocs.length, articulos: totalArticulos };
};
