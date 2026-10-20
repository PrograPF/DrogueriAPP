const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');
let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (k === 'VITE_SUPABASE_URL') supabaseUrl = v;
        if (k === 'VITE_SUPABASE_ANON_KEY') supabaseKey = v;
      }
    }
  });
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Colores del sistema
const COLORS = {
  amarillo: '#eab308',
  naranja: '#fb923c',
  naranjaIntenso: '#ea580c',
  rojo: '#ef4444',
  verde: '#10b981',
  azul: '#3b82f6',
  rosa: '#f4c2c2',
  purpura: '#c080c0'
};

const getTodayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toISODateOnly = (val) => {
  if (!val) return null;
  if (typeof val === 'string') {
    if (val.length >= 10 && val[4] === '-' && val[7] === '-') {
      return val.slice(0, 10);
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
};

const addDaysISO = (isoDate, deltaDays) => {
  if (!isoDate) return null;
  const parts = isoDate.split('-');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
  d.setDate(d.getDate() + deltaDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Motor idéntico a plazosHelper.js con SE / AG ajustados
const evaluarPlazos = (item) => {
  if (!item) return { nivel: 'sin_fecha', glosa: 'Sin datos', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };

  const estado = item.estado || '';
  if (estado === 'Cancelado' || estado === 'Cancelada' || estado === 'Recepción Conforme') {
    return { nivel: 'ok', glosa: 'Cerrada / Conforme', color: COLORS.verde, bg: 'rgba(16, 185, 129, 0.1)', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
  }

  if (estado === 'Excepciones') {
    return {
      nivel: 'purpura',
      glosa: '🟣 Régimen de Excepción: Aceptada para recepción fuera de plazo',
      color: COLORS.purpura,
      bg: 'rgba(192, 128, 192, 0.15)',
      isExpired: false,
      isYellow: false,
      isOrange: false,
      isRosa: false,
      isPurpura: true
    };
  }

  const hoy = getTodayISO();
  const isSE = (item.tipo_oc === 'SE');
  const fA = toISODateOnly(item.fecha_tope_aceptacion);
  const fE = toISODateOnly(item.fecha_tope_entrega);
  const fM = toISODateOnly(item.fecha_tope_multa);
  const fI = toISODateOnly(item.fecha_insistencia);

  // Estado Enviada
  if (estado === 'Enviada') {
    if (!fA) return { nivel: 'sin_fecha', glosa: 'Sin fecha tope de aceptación', color: '#94a3b8', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
    if (hoy > fA) return { nivel: 'rojo', glosa: `🔴 Tope de aceptación vencido (${fA})`, color: COLORS.rojo, isExpired: true, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
    if (hoy >= addDaysISO(fA, -1)) return { nivel: 'amarillo', glosa: `🟡 Próximo a vencer tope de aceptación (${fA})`, color: COLORS.amarillo, isExpired: false, isYellow: true, isOrange: false, isRosa: false, isPurpura: false };
    return { nivel: 'ok', glosa: 'Enviada: dentro de plazo de aceptación', color: COLORS.verde, isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
  }

  // Estado Aceptada (o por defecto)
  // 1. Si venció plazo máximo con multa -> Rojo
  if (fM && hoy > fM) {
    return { nivel: 'rojo', glosa: `🔴 Plazo máximo con multa vencido (${fM})`, color: COLORS.rojo, isExpired: true, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
  }

  // 2. Caso especial SE: Alerta Rosa Bebé 1 día antes de la fecha de insistencia
  if (isSE && fI && hoy >= addDaysISO(fI, -1)) {
    return {
      nivel: 'rosa',
      glosa: `🌸 Insistir por correo: despacho parcializado requerido (insistencia ${fI})`,
      color: COLORS.rosa,
      bg: 'rgba(244, 194, 194, 0.15)',
      isExpired: false,
      isYellow: false,
      isOrange: false,
      isRosa: true,
      isPurpura: false
    };
  }

  // 3. Reglas de entrega y multa estándar (para todos los tipos, incluidos AG y SE)
  if (!fE) return { nivel: 'sin_fecha', glosa: 'Sin fecha tope de entrega definida', color: '#94a3b8', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
  if (hoy <= fE) {
    if (hoy >= addDaysISO(fE, -1)) {
      return { nivel: 'amarillo', glosa: `🟡 Próximo a vencer plazo de entrega (${fE})`, color: COLORS.amarillo, isExpired: false, isYellow: true, isOrange: false, isRosa: false, isPurpura: false };
    }
    return { nivel: 'ok', glosa: 'En plazo', color: COLORS.verde, isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
  }

  // hoy > fE -> período de multas
  if (!fM) return { nivel: 'naranja', glosa: 'Atrasado con multa (sin tope)', color: COLORS.naranja, isExpired: false, isYellow: false, isOrange: true, isRosa: false, isPurpura: false };
  if (hoy >= addDaysISO(fM, -1)) {
    return { nivel: 'naranjo', glosa: `⚠️ Atrasado con multa: pronto vence plazo máximo (${fM})`, color: COLORS.naranjaIntenso, isExpired: false, isYellow: false, isOrange: true, isRosa: false, isPurpura: false };
  }
  return { nivel: 'naranja', glosa: `🟠 En período de multas (tope ${fM})`, color: COLORS.naranja, isExpired: false, isYellow: false, isOrange: true, isRosa: false, isPurpura: false };
};

async function runTests() {
  console.log('🚀 Iniciando Suite de Pruebas Autónomas E2E - Ajuste SE (Rosa) y AG (Estándar)...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const hoy = getTodayISO();
  const manana = addDaysISO(hoy, 1);
  const pasadoManana = addDaysISO(hoy, 2);
  const ayer = addDaysISO(hoy, -1);
  const antier = addDaysISO(hoy, -2);

  // 1. Validaciones Unitarias del Motor de Plazos
  console.log('--- TEST GROUP 1: Lógica del Motor de Plazos (SE vs AG vs Otros) ---');

  // Caso 1.1: SE con insistencia mañana -> debe ser Rosa Bebé
  const evalRosa1 = evaluarPlazos({ tipo_oc: 'SE', fecha_insistencia: manana, fecha_tope_entrega: pasadoManana, fecha_tope_multa: addDaysISO(hoy, 5), estado: 'Aceptada' });
  assert(evalRosa1.nivel === 'rosa' && evalRosa1.isRosa === true && evalRosa1.color === '#f4c2c2', 'OC SE con insistencia mañana activa alerta Rosa Bebé (#F4C2C2)');

  // Caso 1.2: SE con insistencia hoy -> debe ser Rosa Bebé
  const evalRosa2 = evaluarPlazos({ tipo_oc: 'SE', fecha_insistencia: hoy, fecha_tope_entrega: pasadoManana, fecha_tope_multa: addDaysISO(hoy, 5), estado: 'Aceptada' });
  assert(evalRosa2.nivel === 'rosa' && evalRosa2.isRosa === true, 'OC SE con insistencia hoy activa alerta Rosa Bebé');

  // Caso 1.3: SE con insistencia en 2 días -> no es rosa, sigue en plazo normal verde
  const evalNormalSE = evaluarPlazos({ tipo_oc: 'SE', fecha_insistencia: pasadoManana, fecha_tope_entrega: pasadoManana, fecha_tope_multa: addDaysISO(hoy, 5), estado: 'Aceptada' });
  assert(evalNormalSE.isRosa === false && evalNormalSE.nivel === 'ok', 'OC SE con insistencia en 2 días NO activa rosa y se mantiene en plazo');

  // Caso 1.4: SE con multa vencida -> Rojo prevalece sobre insistencia rosa
  const evalSEVencida = evaluarPlazos({ tipo_oc: 'SE', fecha_insistencia: hoy, fecha_tope_entrega: antier, fecha_tope_multa: ayer, estado: 'Aceptada' });
  assert(evalSEVencida.nivel === 'rojo' && evalSEVencida.isExpired === true, 'OC SE con multa vencida prioriza alerta Roja sobre insistencia rosa');

  // Caso 1.5: AG ahora es estándar (NO activa rosa con insistencia, evalúa plazos normales)
  const evalAGStand = evaluarPlazos({ tipo_oc: 'AG', fecha_insistencia: hoy, fecha_tope_entrega: pasadoManana, fecha_tope_multa: addDaysISO(hoy, 5), estado: 'Aceptada' });
  assert(evalAGStand.isRosa === false && evalAGStand.nivel === 'ok', 'OC AG restaurada al flujo estándar: NO activa alerta rosa');

  // Caso 1.6: AG en período de multas -> Naranja
  const evalAGMulta = evaluarPlazos({ tipo_oc: 'AG', fecha_tope_entrega: ayer, fecha_tope_multa: pasadoManana, estado: 'Aceptada' });
  assert(evalAGMulta.nivel === 'naranja' && evalAGMulta.isOrange === true && evalAGMulta.color === '#fb923c', 'OC AG atrasada activa período de multa Naranja estándar');

  // Caso 1.7: Estado Excepciones -> Púrpura
  const evalExcep = evaluarPlazos({ tipo_oc: 'SE', estado: 'Excepciones', fecha_tope_multa: ayer });
  assert(evalExcep.nivel === 'purpura' && evalExcep.isPurpura === true && evalExcep.color === '#c080c0', 'OC en estado Excepciones activa alerta Púrpura (#C080C0)');

  // 2. Base de Datos E2E: Inserción, Consulta y Limpieza
  console.log('\n--- TEST GROUP 2: Integración Supabase (SE con insistencia y AG estándar) ---');

  const testSolNum = 'S-TEST-E2E-SE-AG';
  const testOcNum = 'OC-TEST-E2E-SE-AG';

  try {
    // 2.1 Insertar solicitud de prueba tipo SE con fecha_insistencia y fechas tope
    const { data: solData, error: solErr } = await supabase
      .from('solicitudes_compra')
      .insert([{
        numero_solicitud: testSolNum,
        codigo_articulo: 'TEST-ART-SE',
        tipo_oc: 'SE',
        fecha_tope_aceptacion: manana,
        fecha_tope_entrega: pasadoManana,
        fecha_tope_multa: addDaysISO(hoy, 5),
        fecha_insistencia: manana,
        estado: 'Pendiente'
      }])
      .select();

    if (solErr) console.error('Detalle solErr:', solErr);
    assert(!solErr && solData && solData[0]?.fecha_insistencia === manana && solData[0]?.tipo_oc === 'SE', 'Inserción y lectura de solicitud SE con fechas completas y fecha_insistencia');

    // 2.2 Insertar orden de compra de prueba con tipo_oc SE y fecha_insistencia
    const { data: ocData, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert([{
        numero_oc: testOcNum,
        solicitud_compra: testSolNum,
        proveedor: 'PROVEEDOR TEST SE E2E',
        tipo_oc: 'SE',
        fecha_tope_aceptacion: manana,
        fecha_tope_entrega: pasadoManana,
        fecha_tope_multa: addDaysISO(hoy, 5),
        fecha_insistencia: manana,
        estado: 'Aceptada',
        fecha_envio: new Date().toISOString()
      }])
      .select();

    assert(!ocErr && ocData && ocData[0]?.fecha_insistencia === manana && ocData[0]?.tipo_oc === 'SE', 'Inserción y lectura de OC tipo SE con fecha_insistencia exitosa');

    // 2.3 Actualizar orden de compra a estado 'Excepciones'
    const { data: ocUpdated, error: updErr } = await supabase
      .from('ordenes_compra')
      .update({ estado: 'Excepciones' })
      .eq('numero_oc', testOcNum)
      .select();

    assert(!updErr && ocUpdated && ocUpdated[0]?.estado === 'Excepciones', 'Actualización de OC SE a estado Excepciones exitosa');

  } finally {
    // 3. Limpieza total de datos de prueba
    console.log('\n--- TEST GROUP 3: Limpieza Total de Datos en Base de Datos ---');
    const { error: delOcErr } = await supabase
      .from('ordenes_compra')
      .delete()
      .eq('numero_oc', testOcNum);

    const { error: delSolErr } = await supabase
      .from('solicitudes_compra')
      .delete()
      .eq('numero_solicitud', testSolNum);

    assert(!delOcErr && !delSolErr, 'Limpieza 100% completada: registros temporales eliminados de Supabase');
  }

  console.log(`\n===========================================`);
  console.log(`Resumen de Resultados: ${passed} pasadas, ${failed} fallidas`);
  console.log(`===========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
