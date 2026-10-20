// Helper centralizado de fechas tope y semáforo de plazos para Solicitudes y OCs.
// Todas las comparaciones se hacen con strings 'YYYY-MM-DD' en fecha LOCAL
// (nunca con new Date('YYYY-MM-DD'), que se interpreta como UTC y en Chile se corre un día).

export const TIPOS_OC = ['AG', 'SE', 'CM', 'L1', 'PEDIDO ESPECIAL', 'OC ESPECIAL'];

const pad = (n) => String(n).padStart(2, '0');

export const toLocalISO = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const normalizeISO = (value) => {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export const addDaysISO = (iso, n) => {
  const norm = normalizeISO(iso);
  if (!norm) return null;
  const [y, m, d] = norm.split('-').map(Number);
  return toLocalISO(new Date(y, m - 1, d + n));
};

export const formatISOToDisplay = (iso) => {
  const norm = normalizeISO(iso);
  if (!norm) return '-';
  const [y, m, d] = norm.split('-');
  return `${d}/${m}/${y}`;
};

export const validarOrdenFechas = ({ fecha_tope_aceptacion, fecha_tope_entrega, fecha_tope_multa } = {}) => {
  const a = normalizeISO(fecha_tope_aceptacion);
  const e = normalizeISO(fecha_tope_entrega);
  const m = normalizeISO(fecha_tope_multa);
  if (a && e && a > e) return 'La fecha tope de aceptación no puede ser posterior a la fecha tope de entrega.';
  if (e && m && e > m) return 'La fecha tope de entrega no puede ser posterior a la fecha tope máxima con multa.';
  if (a && m && a > m) return 'La fecha tope de aceptación no puede ser posterior a la fecha tope máxima con multa.';
  return null;
};

const COLORS = {
  azul: '#3b82f6',
  verde: '#10b981',
  amarillo: '#eab308',
  multa: '#fb923c',
  naranjo: '#ea580c',
  rojo: '#ef4444',
  rosa: '#f4c2c2',
  purpura: '#c080c0',
  gris: '#94a3b8'
};

const hexToRgba = (hex, alpha) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const build = (nivel, colorHex, glosa) => ({
  nivel,
  color: colorHex,
  bg: hexToRgba(colorHex, 0.18),
  glosa,
  isYellow: nivel === 'amarillo',
  isOrange: nivel === 'multa' || nivel === 'naranjo',
  isExpired: nivel === 'rojo',
  isRosa: nivel === 'rosa',
  isPurpura: nivel === 'purpura'
});

const ESTADOS_FINALES = ['Cancelado', 'Cancelada', 'Recepción Conforme', 'Recepción Con Multa'];

export const evaluarPlazos = (oc = {}, hoyISO = toLocalISO()) => {
  const hoy = normalizeISO(hoyISO) || toLocalISO();
  const estado = oc.estado;

  // 1. Estado Excepciones: Recepción autorizada fuera de plazo (color Púrpura #C080C0)
  if (estado === 'Excepciones' || estado === 'Excepción') {
    return build('purpura', COLORS.purpura, '🟣 Régimen de Excepción: Aceptada para recepción fuera de plazo');
  }

  // 2. Estados finales cerrados
  if (ESTADOS_FINALES.includes(estado)) {
    return build('final', COLORS.gris, estado);
  }

  const isAG = (oc.tipo_oc === 'AG');

  // 3. Estado Enviada: Evalúa plazo de aceptación para todos los tipos de OC
  if (estado === 'Enviada') {
    const tA = normalizeISO(oc.fecha_tope_aceptacion);
    if (!tA) return build('sin_fecha', COLORS.gris, 'Sin fecha tope de aceptación definida');
    const f = formatISOToDisplay(tA);
    if (hoy > tA) return build('rojo', COLORS.rojo, `⛔ Venció el plazo de aceptación (tope ${f})`);
    if (hoy >= addDaysISO(tA, -1)) return build('amarillo', COLORS.amarillo, `⚠️ Pronta a vencer el plazo de aceptación (tope ${f})`);
    return build('ok', COLORS.azul, `Enviada, dentro del plazo de aceptación (tope ${f})`);
  }

  // 4. Estado Aceptada
  if (estado === 'Aceptada') {
    // Caso especial AG: No tiene fecha tope de entrega ni multa; se guía por fecha_insistencia
    if (isAG) {
      const tI = normalizeISO(oc.fecha_insistencia);
      if (!tI) {
        return build('ok', COLORS.verde, 'Aceptada (AG: sin fecha de insistencia definida)');
      }
      const fI = formatISOToDisplay(tI);
      // 1 día antes de la fecha seleccionada cambia a color Rosa Bebé #F4C2C2
      if (hoy >= addDaysISO(tI, -1)) {
        return build('rosa', COLORS.rosa, `🌸 Insistir por correo: despacho parcializado requerido (insistencia ${fI})`);
      }
      return build('ok', COLORS.verde, `Aceptada (AG: próxima insistencia el ${fI})`);
    }

    // Para los demás tipos de OC (SE, CM, L1, Pedido Especial, OC Especial)
    const tE = normalizeISO(oc.fecha_tope_entrega);
    const tM = normalizeISO(oc.fecha_tope_multa);
    if (!tE) return build('sin_fecha', COLORS.gris, 'Sin fecha tope de entrega definida');
    const fE = formatISOToDisplay(tE);

    if (hoy <= tE) {
      if (hoy >= addDaysISO(tE, -1)) return build('amarillo', COLORS.amarillo, `⚠️ Pronta a vencer el plazo de entrega (tope ${fE})`);
      return build('ok', COLORS.verde, `Aceptada, dentro del plazo de entrega (tope ${fE})`);
    }

    // hoy > tope de entrega → período de multa
    if (!tM) return build('multa', COLORS.multa, 'Atrasado con multa (sin fecha tope de multa)');
    const fM = formatISOToDisplay(tM);
    if (hoy > tM) return build('rojo', COLORS.rojo, '⛔ Venció el plazo máximo de multa: pase a Excepciones o cancele manualmente');
    if (hoy >= addDaysISO(tM, -1)) return build('naranjo', COLORS.naranjo, `⚠️ Atrasado con multa: pronto vence el plazo máximo de multa (${fM})`);
    return build('multa', COLORS.multa, `Atrasado con multa (tope de multa ${fM})`);
  }

  return build('sin_fecha', COLORS.gris, 'Sin fecha tope definida');
};
