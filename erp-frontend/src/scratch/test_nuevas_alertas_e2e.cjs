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

// Import plazosHelper logic (ESM / CJS adaptation)
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
  const tipo = item.tipo_oc || '';
  const fA = toISODateOnly(item.fecha_tope_aceptacion);
  const fE = toISODateOnly(item.fecha_tope_entrega);
  const fM = toISODateOnly(item.fecha_tope_multa);
  const fI = toISODateOnly(item.fecha_insistencia);

  if (tipo === 'AG') {
    if (fI) {
      const umbralRosa = addDaysISO(fI, -1);
      if (hoy >= umbralRosa) {
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
    }
    if (fA) {
      const umbralAcept = addDaysISO(fA, -1);
      if (hoy > fA) {
        return { nivel: 'rojo', glosa: `🔴 Tope de aceptación vencido (${fA})`, color: COLORS.rojo, bg: 'rgba(239, 68, 68, 0.1)', isExpired: true, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
      }
      if (hoy >= umbralAcept) {
        return { nivel: 'amarillo', glosa: `🟡 Próximo a vencer tope de aceptación (${fA})`, color: COLORS.amarillo, bg: 'rgba(234, 179, 8, 0.1)', isExpired: false, isYellow: true, isOrange: false, isRosa: false, isPurpura: false };
      }
    }
    return { nivel: 'ok', glosa: 'En plazo', color: COLORS.verde, bg: 'rgba(16, 185, 129, 0.1)', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
  }

  // Non-AG standard logic
  if (fM && hoy > fM) {
    return { nivel: 'rojo', glosa: `🔴 Plazo máximo con multa vencido (${fM})`, color: COLORS.rojo, bg: 'rgba(239, 68, 68, 0.1)', isExpired: true, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
  }
  if (fE && hoy > fE) {
    return { nivel: 'naranja', glosa: `🟠 En período de multas`, color: COLORS.naranja, bg: 'rgba(251, 146, 60, 0.1)', isExpired: false, isYellow: false, isOrange: true, isRosa: false, isPurpura: false };
  }

  return { nivel: 'ok', glosa: 'En plazo', color: COLORS.verde, bg: 'rgba(16, 185, 129, 0.1)', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false };
};

async function runTests() {
  console.log('🚀 Iniciando Suite de Pruebas Autónomas E2E - Nuevas Alertas y Excepciones...\n');
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

  // 1. Validaciones Unitarias de Plazos
  console.log('--- TEST GROUP 1: Lógica del Motor de Plazos (plazosHelper) ---');
  
  // Caso 1.1: AG con insistencia mañana -> debe ser Rosa Bebé
  const evalRosa1 = evaluarPlazos({ tipo_oc: 'AG', fecha_insistencia: manana, estado: 'Enviada' });
  assert(evalRosa1.nivel === 'rosa' && evalRosa1.isRosa === true && evalRosa1.color === '#f4c2c2', 'OC AG con insistencia mañana activa alerta Rosa Bebé');

  // Caso 1.2: AG con insistencia hoy -> debe ser Rosa Bebé
  const evalRosa2 = evaluarPlazos({ tipo_oc: 'AG', fecha_insistencia: hoy, estado: 'Enviada' });
  assert(evalRosa2.nivel === 'rosa' && evalRosa2.isRosa === true, 'OC AG con insistencia hoy activa alerta Rosa Bebé');

  // Caso 1.3: AG con insistencia en 2 días -> aún no es Rosa
  const evalNormalAG = evaluarPlazos({ tipo_oc: 'AG', fecha_insistencia: pasadoManana, estado: 'Enviada' });
  assert(evalNormalAG.isRosa === false, 'OC AG con insistencia en 2 días NO activa alerta Rosa');

  // Caso 1.4: Estado Excepciones -> debe ser Púrpura
  const evalExcep = evaluarPlazos({ tipo_oc: 'CM', estado: 'Excepciones', fecha_tope_multa: ayer });
  assert(evalExcep.nivel === 'purpura' && evalExcep.isPurpura === true && evalExcep.color === '#c080c0', 'OC con estado Excepciones activa alerta Púrpura independientemente de fechas');

  // Caso 1.5: OC normal fuera de plazo entrega -> Alerta Naranja (Multa)
  const evalNaranja = evaluarPlazos({ tipo_oc: 'CM', estado: 'Enviada', fecha_tope_entrega: ayer, fecha_tope_multa: pasadoManana });
  assert(evalNaranja.nivel === 'naranja' && evalNaranja.isOrange === true && evalNaranja.color === '#fb923c', 'OC normal fuera de entrega activa Alerta Naranja (Multas)');

  // 2. Base de Datos E2E: Inserción, Consulta y Limpieza
  console.log('\n--- TEST GROUP 2: Integración Supabase (solicitudes_compra y ordenes_compra) ---');

  const testSolNum = 'S-TEST-E2E-ALERT';
  const testOcNum = 'OC-TEST-E2E-ALERT';

  try {
    // 2.1 Insertar solicitud de prueba con fecha_insistencia
    const { data: solData, error: solErr } = await supabase
      .from('solicitudes_compra')
      .insert([{
        numero_solicitud: testSolNum,
        codigo_articulo: 'TEST-ART',
        tipo_oc: 'AG',
        fecha_tope_aceptacion: manana,
        fecha_insistencia: manana,
        estado: 'Pendiente'
      }])
      .select();

    if (solErr) console.error('Detalle solErr:', solErr);
    assert(!solErr && solData && solData[0]?.fecha_insistencia === manana, 'Inserción y lectura de solicitud con fecha_insistencia exitosa');

    // 2.2 Insertar orden de compra de prueba con tipo_oc AG y fecha_insistencia
    const { data: ocData, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert([{
        numero_oc: testOcNum,
        solicitud_compra: testSolNum,
        proveedor: 'PROVEEDOR TEST E2E',
        tipo_oc: 'AG',
        fecha_tope_aceptacion: manana,
        fecha_insistencia: manana,
        estado: 'Enviada',
        fecha_envio: new Date().toISOString()
      }])
      .select();

    assert(!ocErr && ocData && ocData[0]?.fecha_insistencia === manana, 'Inserción y lectura de OC AG con fecha_insistencia exitosa');

    // 2.3 Actualizar orden de compra a estado 'Excepciones'
    const { data: ocUpdated, error: updErr } = await supabase
      .from('ordenes_compra')
      .update({ estado: 'Excepciones' })
      .eq('numero_oc', testOcNum)
      .select();

    assert(!updErr && ocUpdated && ocUpdated[0]?.estado === 'Excepciones', 'Actualización de OC a estado Excepciones exitosa');

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

    assert(!delOcErr && !delSolErr, 'Limpieza 100% completada: registros de prueba eliminados correctamente de Supabase');
  }

  console.log(`\n===========================================`);
  console.log(`Resumen de Resultados: ${passed} pasadas, ${failed} fallidas`);
  console.log(`===========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
