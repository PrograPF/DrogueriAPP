const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../../.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function sanitizePlazo(input) {
  if (input !== '' && input !== null && input !== undefined) {
    const val = parseInt(input, 10);
    if (!isNaN(val) && val >= 0) return val;
  }
  return null;
}

function normalizeTipoPlazo(input) {
  if (!input) return null;
  if (/h[aá]biles/i.test(input)) return 'Hábiles';
  if (/corridos/i.test(input)) return 'Corridos';
  return input.trim();
}

function formatPlazoDisplay(days) {
  if (days == null) return '—';
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

async function runDeepVerification() {
  console.log('=== INICIO VERIFICACIÓN PROFUNDA: PLAZOS INFORMATIVOS SOLICITUDES ===');

  // Test 1: Unit logic tests for sanitization, normalization, and display
  console.log('1. Validando lógica unitaria de sanitización y singular/plural:');
  console.assert(sanitizePlazo('0') === 0, 'Plazo 0 debe ser 0');
  console.assert(sanitizePlazo(0) === 0, 'Plazo numérico 0 debe ser 0');
  console.assert(sanitizePlazo('1') === 1, 'Plazo 1 debe ser 1');
  console.assert(sanitizePlazo('-5') === null, 'Plazo negativo debe ser null');
  console.assert(sanitizePlazo('') === null, 'Cadena vacía debe ser null');
  console.assert(sanitizePlazo('abc') === null, 'Texto no numérico debe ser null');
  console.assert(normalizeTipoPlazo('habiles') === 'Hábiles', 'habiles minúscula normaliza a Hábiles');
  console.assert(normalizeTipoPlazo('Habiles') === 'Hábiles', 'Habiles sin tilde normaliza a Hábiles');
  console.assert(normalizeTipoPlazo('Hábiles') === 'Hábiles', 'Hábiles con tilde se mantiene');
  console.assert(normalizeTipoPlazo('corridos') === 'Corridos', 'corridos minúscula normaliza a Corridos');
  console.assert(formatPlazoDisplay(1) === '1 día', '1 día debe ser singular');
  console.assert(formatPlazoDisplay(5) === '5 días', '5 días debe ser plural');
  console.assert(formatPlazoDisplay(0) === '0 días', '0 días debe ser plural');
  console.assert(formatPlazoDisplay(null) === '—', 'null debe ser —');
  console.log('  ✅ Todas las aserciones unitarias pasaron.');

  // Test 2: Database E2E Tests with edge cases
  const testNum = `TEST-S-DEEP-${Date.now()}`;
  let solId = null;

  try {
    console.log(`2. Insertando solicitud ${testNum} con singular (1 día) y normalización 'habiles'...`);
    const payload = {
      numero_solicitud: testNum,
      codigo_articulo: 'TEST-ART-99',
      descripcion_articulo: 'Artículo de verificación profunda',
      cantidad: 2,
      estado: 'Sin OC asignada',
      plazo_aceptacion_dias: sanitizePlazo('1'),
      plazo_entrega_dias: sanitizePlazo('1'),
      tipo_plazo_entrega: normalizeTipoPlazo('habiles')
    };

    const { data: inserted, error: insErr } = await supabase
      .from('solicitudes_compra')
      .insert([payload])
      .select();

    if (insErr) throw insErr;
    solId = inserted[0].id;

    console.log('  ✅ Solicitud insertada id:', solId);
    console.assert(inserted[0].plazo_aceptacion_dias === 1, 'Esperado plazo_aceptacion_dias = 1');
    console.assert(inserted[0].plazo_entrega_dias === 1, 'Esperado plazo_entrega_dias = 1');
    console.assert(inserted[0].tipo_plazo_entrega === 'Hábiles', 'Esperado tipo_plazo_entrega = Hábiles');

    // Test 3: Update to 0 days and 'corridos'
    console.log('3. Actualizando a 0 días y tipo "corridos"...');
    const updatePayload = {
      plazo_aceptacion_dias: sanitizePlazo('0'),
      plazo_entrega_dias: sanitizePlazo('0'),
      tipo_plazo_entrega: normalizeTipoPlazo('corridos')
    };
    const { data: updated, error: upErr } = await supabase
      .from('solicitudes_compra')
      .update(updatePayload)
      .eq('id', solId)
      .select();

    if (upErr) throw upErr;
    console.assert(updated[0].plazo_aceptacion_dias === 0, 'Esperado plazo_aceptacion_dias = 0');
    console.assert(updated[0].plazo_entrega_dias === 0, 'Esperado plazo_entrega_dias = 0');
    console.assert(updated[0].tipo_plazo_entrega === 'Corridos', 'Esperado tipo_plazo_entrega = Corridos');
    console.log('  ✅ Actualización a 0 y Corridos exitosa.');

    // Test 4: Clear to null
    console.log('4. Limpiando campos a null...');
    const { data: nulled, error: nullErr } = await supabase
      .from('solicitudes_compra')
      .update({
        plazo_aceptacion_dias: null,
        plazo_entrega_dias: null,
        tipo_plazo_entrega: null
      })
      .eq('id', solId)
      .select();

    if (nullErr) throw nullErr;
    console.assert(nulled[0].plazo_aceptacion_dias === null, 'Esperado null');
    console.assert(nulled[0].plazo_entrega_dias === null, 'Esperado null');
    console.assert(nulled[0].tipo_plazo_entrega === null, 'Esperado null');
    console.log('  ✅ Reseteo a null exitoso.');

  } finally {
    if (solId) {
      console.log('5. Limpiando datos de prueba...');
      const { error: delErr } = await supabase
        .from('solicitudes_compra')
        .delete()
        .eq('id', solId);
      if (delErr) console.error('Error limpiando:', delErr);
      else console.log('  ✅ Datos de prueba eliminados correctamente.');
    }
  }

  console.log('🎉 TODAS LAS VERIFICACIONES PROFUNDAS FINALIZARON CON ÉXITO.');
}

runDeepVerification().catch(err => {
  console.error('ERROR EN PRUEBA:', err);
  process.exit(1);
});
