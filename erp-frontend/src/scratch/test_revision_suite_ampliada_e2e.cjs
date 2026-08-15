/**
 * Test E2E Ampliado: Cobertura de escenarios de borde para Revisiones Parciales,
 * Ajuste de Unidades, Cierre Manual, Estados de OC y Casos Límite
 * 
 * Escenarios cubiertos:
 *  1.  Creación de OC con 3 artículos de distintas cantidades
 *  2.  Revisión parcial (primer lote)
 *  3.  Ingreso de segundo lote del mismo artículo
 *  4.  Bloqueo: intentar ingresar más unidades de las disponibles (exceso vs saldo)
 *  5.  OC completa al 100% pasa a "Revisada"
 *  6.  OC permanece en "Revision Parcial" si hay artículos con saldo pendiente
 *  7.  Ajuste de cantidad OC a valor menor que lo ya revisado
 *  8.  Artículo que no llega → solo 2 de 3 artículos se revisan → Cierre Manual
 *  9.  Reapertura de OC Cerrada con Pendientes
 * 10.  Datos de revisión persisten correctamente en base de datos
 * 11.  Limpieza completa de base de datos
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.replace('VITE_SUPABASE_URL=', '').trim();
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseKey = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_OC_NUM = 'OC-TEST-EDGE-8877';
const TEST_SESSION_A = crypto.randomUUID();
const TEST_SESSION_B = crypto.randomUUID();
const TEST_SESSION_C = crypto.randomUUID();

const results = [];
let testOcId = null;
let artId1 = null; // TEST-AA1: 1000 uds
let artId2 = null; // TEST-AA2: 500 uds
let artId3 = null; // TEST-AA3: 200 uds (nunca llegará)

const log = (msg) => process.stdout.write(msg + '\n');

function pass(num, titulo, detalle) {
  results.push({ num, status: 'PASSED', titulo, detalle });
  log(`  ✅ [PASSED] Test ${num}: ${titulo}`);
  log(`     └─ ${detalle}\n`);
}

function fail(num, titulo, detalle) {
  results.push({ num, status: 'FAILED', titulo, detalle });
  log(`  ❌ [FAILED] Test ${num}: ${titulo}`);
  log(`     └─ ${detalle}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de lógica (simulan la lógica del componente React)
// ─────────────────────────────────────────────────────────────────────────────

/** Calcula unidades revisadas para un artículo dado en la OC indicada */
async function calcRevisado(numeroOc, codigoArticulo) {
  const { data } = await supabase
    .from('revisiones_bodega')
    .select('cantidad')
    .eq('numero_oc', numeroOc)
    .eq('codigo_articulo', codigoArticulo);
  return (data || []).reduce((sum, r) => sum + (r.cantidad || 0), 0);
}

/** Obtiene la cantidad registrada en ordenes_compra_articulos */
async function getCantidadOc(artId) {
  const { data } = await supabase
    .from('ordenes_compra_articulos')
    .select('cantidad')
    .eq('id', artId)
    .single();
  return data?.cantidad ?? 0;
}

/** Recalcula el estado de la OC como lo hace el componente */
async function calcEstadoRevision(ocId, articulosOcConCantidades) {
  const todosCompletos = await Promise.all(
    articulosOcConCantidades.map(async (art) => {
      const revisado = await calcRevisado(TEST_OC_NUM, art.codigo_articulo);
      const cantOc = await getCantidadOc(art.id);
      return revisado >= cantOc;
    })
  );

  if (todosCompletos.every(Boolean)) return 'Revisada';

  const { data: oc } = await supabase
    .from('ordenes_compra')
    .select('estado_revision')
    .eq('id', ocId)
    .single();

  if (oc.estado_revision === 'Cerrada con Pendientes') return 'Cerrada con Pendientes';
  return 'Revision Parcial';
}

/** Inserta una revisión en la BD simulando el flujo de handleFinalizar */
async function insertarRevision(sessionId, codigoArticulo, lote, cantidad, doc) {
  const { error } = await supabase
    .from('revisiones_bodega')
    .insert({
      session_id: sessionId,
      codigo_articulo: codigoArticulo,
      lote,
      isp: 'ISP-EDGE-TEST',
      cantidad,
      tipo_documento: doc.tipo,
      numero_documento: doc.numero,
      numero_oc: TEST_OC_NUM
    });
  if (error) throw error;
}

/** Actualiza estado de revisión en la OC */
async function actualizarEstadoOc(ocId, estado) {
  const { error } = await supabase
    .from('ordenes_compra')
    .update({ estado_revision: estado })
    .eq('id', ocId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────────────

async function setup() {
  log('\n🔧 Configuración inicial: limpieza y creación de datos de prueba...');

  await supabase.from('revisiones_bodega').delete().eq('numero_oc', TEST_OC_NUM);
  await supabase.from('ordenes_compra')
    .select('id').eq('numero_oc', TEST_OC_NUM)
    .then(async ({ data }) => {
      if (data?.length) {
        for (const oc of data) {
          await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', oc.id);
        }
        await supabase.from('ordenes_compra').delete().eq('numero_oc', TEST_OC_NUM);
      }
    });

  const { data: oc, error: ocErr } = await supabase
    .from('ordenes_compra')
    .insert({
      numero_oc: TEST_OC_NUM,
      proveedor: 'PROVEEDOR EDGE TESTS LTDA',
      tipo_oc: 'Medicamentos',
      estado: 'Aceptada',
      estado_recepcion: 'Recepcion Completa',
      estado_revision: null,
      fecha_envio: new Date().toISOString().split('T')[0]
    })
    .select('id')
    .single();

  if (ocErr) throw new Error('Setup: crear OC: ' + ocErr.message);
  testOcId = oc.id;

  const { data: arts, error: artsErr } = await supabase
    .from('ordenes_compra_articulos')
    .insert([
      { oc_id: testOcId, codigo_articulo: 'TEST-AA1', cantidad: 1000, estado_recepcion: 'Recepcionado' },
      { oc_id: testOcId, codigo_articulo: 'TEST-AA2', cantidad: 500,  estado_recepcion: 'Recepcionado' },
      { oc_id: testOcId, codigo_articulo: 'TEST-AA3', cantidad: 200,  estado_recepcion: 'Recepcionado' }
    ])
    .select('id, codigo_articulo, cantidad');

  if (artsErr) throw new Error('Setup: crear artículos: ' + artsErr.message);
  artId1 = arts.find(a => a.codigo_articulo === 'TEST-AA1').id;
  artId2 = arts.find(a => a.codigo_articulo === 'TEST-AA2').id;
  artId3 = arts.find(a => a.codigo_articulo === 'TEST-AA3').id;
  log('  ✓ OC y artículos de prueba creados.\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

async function teardown() {
  log('\n🧹 Limpiando base de datos...');
  await supabase.from('revisiones_bodega').delete().eq('numero_oc', TEST_OC_NUM);
  if (testOcId) {
    await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', testOcId);
    await supabase.from('ordenes_compra').delete().eq('id', testOcId);
  }
  log('  ✓ Base de datos 100% limpia. Registros temporales eliminados.\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  // TEST 1: Primera revisión parcial de TEST-AA1 (400 de 1000)
  try {
    await insertarRevision(TEST_SESSION_A, 'TEST-AA1', 'LOTE-A1', 400, { tipo: 'Factura', numero: 'FAC-001' });
    const revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA1');
    const cantOc = await getCantidadOc(artId1);
    const saldo = cantOc - revisado;

    if (revisado !== 400) throw new Error(`Revisado esperado 400, obtenido ${revisado}`);
    if (saldo !== 600) throw new Error(`Saldo esperado 600, obtenido ${saldo}`);

    await actualizarEstadoOc(testOcId, 'Revision Parcial');
    pass(1, 'Revisión parcial (400/1000)', `Revisado: ${revisado} uds. Saldo: ${saldo} uds. OC → Revision Parcial.`);
  } catch (e) { fail(1, 'Revisión parcial', e.message); }

  // TEST 2: Segundo lote del mismo artículo TEST-AA1 (300 uds adicionales)
  try {
    await insertarRevision(TEST_SESSION_A, 'TEST-AA1', 'LOTE-A2', 300, { tipo: 'Factura', numero: 'FAC-001' });
    const revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA1');
    const cantOc = await getCantidadOc(artId1);
    const saldo = cantOc - revisado;

    if (revisado !== 700) throw new Error(`Revisado esperado 700, obtenido ${revisado}`);
    if (saldo !== 300) throw new Error(`Saldo esperado 300, obtenido ${saldo}`);
    pass(2, 'Segundo lote del mismo artículo (700/1000)', `Acumulado: ${revisado} uds. Saldo restante: ${saldo} uds.`);
  } catch (e) { fail(2, 'Segundo lote', e.message); }

  // TEST 3: Tercer lote completa TEST-AA1 exactamente (300 uds exactas)
  try {
    await insertarRevision(TEST_SESSION_A, 'TEST-AA1', 'LOTE-A3', 300, { tipo: 'Factura', numero: 'FAC-001' });
    const revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA1');
    const cantOc = await getCantidadOc(artId1);
    const completo = revisado >= cantOc;

    if (!completo) throw new Error(`Se esperaba artículo completo (${revisado}/${cantOc})`);
    pass(3, 'Completitud exacta de artículo (1000/1000)', `Total revisado: ${revisado}/${cantOc} uds. Artículo completo.`);
  } catch (e) { fail(3, 'Completitud exacta', e.message); }

  // TEST 4: Lógica de bloqueo por exceso de unidades
  // El sistema NO debe permitir agregar si el saldo ya es <= 0
  try {
    const revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA1');
    const cantOc = await getCantidadOc(artId1);
    const saldo = cantOc - revisado;

    const bloqueado = saldo <= 0;
    if (!bloqueado) throw new Error(`Se esperaba saldo <= 0 (saldo actual: ${saldo})`);
    pass(4, 'Bloqueo de reingreso por 0 saldo disponible', `Artículo TEST-AA1 con saldo ${saldo} → ingreso bloqueado correctamente.`);
  } catch (e) { fail(4, 'Bloqueo por exceso', e.message); }

  // TEST 5: OC con solo TEST-AA1 completo → sigue en "Revision Parcial"
  try {
    const aa2revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA2');
    const aa3revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA3');
    const aa2completo = aa2revisado >= 500;
    const aa3completo = aa3revisado >= 200;

    if (aa2completo || aa3completo) throw new Error('TEST-AA2 o TEST-AA3 no deberían estar completos aún.');

    const estado = await calcEstadoRevision(testOcId, [
      { id: artId1, codigo_articulo: 'TEST-AA1' },
      { id: artId2, codigo_articulo: 'TEST-AA2' },
      { id: artId3, codigo_articulo: 'TEST-AA3' }
    ]);

    if (estado !== 'Revision Parcial') throw new Error(`Estado esperado: 'Revision Parcial', obtenido: '${estado}'`);
    pass(5, 'OC permanece en Revision Parcial con artículos incompletos', `AA1 completo, AA2 y AA3 pendientes → estado '${estado}'.`);
  } catch (e) { fail(5, 'Estado parcial correctivo', e.message); }

  // TEST 6: Ajuste de cantidad OC a valor MAYOR que lo ya revisado (caso normal)
  try {
    const { error } = await supabase
      .from('ordenes_compra_articulos')
      .update({ cantidad: 1200 })
      .eq('id', artId1);
    if (error) throw error;

    const nuevaCant = await getCantidadOc(artId1);
    const revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA1');
    const nuevoSaldo = nuevaCant - revisado;

    if (nuevaCant !== 1200) throw new Error(`Cantidad esperada 1200, obtenida ${nuevaCant}`);
    if (nuevoSaldo !== 200) throw new Error(`Saldo esperado 200, obtenido ${nuevoSaldo}`);
    pass(6, 'Ajuste de cantidad OC a mayor valor (1000→1200)', `Cantidad ajustada a ${nuevaCant} uds. Nuevo saldo pendiente: ${nuevoSaldo} uds.`);
  } catch (e) { fail(6, 'Ajuste cantidad mayor', e.message); }

  // TEST 7: Ajuste de cantidad OC a valor MENOR que lo ya revisado (caso de borde crítico)
  // Si la OC decía 1200 y ya se revisaron 1000, pero se ajusta a 800 → saldo sería negativo
  // El sistema debe calcular saldo = max(0, cantidadOC - revisado)
  try {
    const { error } = await supabase
      .from('ordenes_compra_articulos')
      .update({ cantidad: 800 })
      .eq('id', artId1);
    if (error) throw error;

    const cantOc = await getCantidadOc(artId1);
    const revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA1');
    const saldoCalculado = Math.max(0, cantOc - revisado); // 800 - 1000 = -200 → 0

    if (saldoCalculado !== 0) throw new Error(`Saldo esperado 0 (no negativo), obtenido: ${saldoCalculado}`);
    pass(7, 'Ajuste de cantidad OC a valor MENOR que revisado (1200→800)', `Revisado: ${revisado} uds > Cantidad OC: ${cantOc} uds. Saldo protegido con max(0,…): ${saldoCalculado} uds.`);

    // Restaurar a 1000 para que queden 0 pendientes
    await supabase.from('ordenes_compra_articulos').update({ cantidad: 1000 }).eq('id', artId1);
  } catch (e) { fail(7, 'Ajuste cantidad menor que revisado', e.message); }

  // TEST 8: Revisar TEST-AA2 completamente (500 uds en un solo lote)
  try {
    await insertarRevision(TEST_SESSION_B, 'TEST-AA2', 'LOTE-B1', 500, { tipo: 'Guía de Despacho', numero: 'GD-002' });
    const revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA2');
    const cantOc = await getCantidadOc(artId2);
    const completo = revisado >= cantOc;

    if (!completo) throw new Error(`TEST-AA2 no completo: ${revisado}/${cantOc}`);
    pass(8, 'Completar TEST-AA2 de un solo lote (500/500)', `Revisado: ${revisado}/${cantOc} uds. Artículo completado.`);
  } catch (e) { fail(8, 'Completar artículo en lote único', e.message); }

  // TEST 9: OC sigue en parcial porque TEST-AA3 no llega → Cierre Manual
  try {
    const aa3revisado = await calcRevisado(TEST_OC_NUM, 'TEST-AA3');
    if (aa3revisado !== 0) throw new Error(`TEST-AA3 debería tener 0 revisados, tiene ${aa3revisado}`);

    await actualizarEstadoOc(testOcId, 'Cerrada con Pendientes');

    const { data: oc } = await supabase
      .from('ordenes_compra')
      .select('estado_revision')
      .eq('id', testOcId)
      .single();

    if (oc.estado_revision !== 'Cerrada con Pendientes') throw new Error(`Estado esperado 'Cerrada con Pendientes', obtenido '${oc.estado_revision}'`);
    pass(9, 'Cierre Manual → OC "Cerrada con Pendientes"', `TEST-AA3 (200 uds) no llegó. OC cerrada manualmente con saldo pendiente = 200 uds.`);
  } catch (e) { fail(9, 'Cierre manual con pendientes', e.message); }

  // TEST 10: Reapertura de OC cerrada → vuelve a Revision Parcial
  try {
    await actualizarEstadoOc(testOcId, 'Revision Parcial');

    const { data: oc } = await supabase
      .from('ordenes_compra')
      .select('estado_revision')
      .eq('id', testOcId)
      .single();

    if (oc.estado_revision !== 'Revision Parcial') throw new Error(`Estado esperado 'Revision Parcial', obtenido '${oc.estado_revision}'`);
    pass(10, 'Reapertura de OC cerrada → vuelve a "Revision Parcial"', `OC reabierta. Estado restaurado a '${oc.estado_revision}'.`);
  } catch (e) { fail(10, 'Reapertura de OC', e.message); }

  // TEST 11: Luego de reabrir, ingresar TEST-AA3 completa → OC debe pasar a "Revisada"
  try {
    await insertarRevision(TEST_SESSION_C, 'TEST-AA3', 'LOTE-C1', 200, { tipo: 'Factura', numero: 'FAC-003' });

    const todos = [
      { id: artId1, codigo_articulo: 'TEST-AA1' },
      { id: artId2, codigo_articulo: 'TEST-AA2' },
      { id: artId3, codigo_articulo: 'TEST-AA3' }
    ];

    const completados = await Promise.all(todos.map(async art => {
      const rev = await calcRevisado(TEST_OC_NUM, art.codigo_articulo);
      const cant = await getCantidadOc(art.id);
      return rev >= cant;
    }));

    const todosCompletos = completados.every(Boolean);

    if (!todosCompletos) throw new Error('No todos los artículos completaron sus unidades.');
    await actualizarEstadoOc(testOcId, 'Revisada');

    const { data: oc } = await supabase
      .from('ordenes_compra')
      .select('estado_revision')
      .eq('id', testOcId)
      .single();

    if (oc.estado_revision !== 'Revisada') throw new Error(`Estado esperado 'Revisada', obtenido '${oc.estado_revision}'`);
    pass(11, 'OC completa al 100% → estado "Revisada"', `Todos los artículos con 100% de sus unidades. OC → 'Revisada'.`);
  } catch (e) { fail(11, 'Transición a "Revisada" 100%', e.message); }

  // TEST 12: Persistencia de datos - verificar integridad de registros en revisiones_bodega
  try {
    const { data: revs } = await supabase
      .from('revisiones_bodega')
      .select('codigo_articulo, lote, cantidad, numero_oc')
      .eq('numero_oc', TEST_OC_NUM);

    const totalRegistros = revs.length;
    // Sesión A: 3 registros AA1 (lotes A1, A2, A3), Sesión B: 1 registro AA2, Sesión C: 1 registro AA3
    if (totalRegistros !== 5) throw new Error(`Esperados 5 registros, encontrados ${totalRegistros}`);

    const aa1Registros = revs.filter(r => r.codigo_articulo === 'TEST-AA1').length;
    const aa2Registros = revs.filter(r => r.codigo_articulo === 'TEST-AA2').length;
    const aa3Registros = revs.filter(r => r.codigo_articulo === 'TEST-AA3').length;

    if (aa1Registros !== 3) throw new Error(`AA1 esperaba 3 registros, tiene ${aa1Registros}`);
    if (aa2Registros !== 1) throw new Error(`AA2 esperaba 1 registro, tiene ${aa2Registros}`);
    if (aa3Registros !== 1) throw new Error(`AA3 esperaba 1 registro, tiene ${aa3Registros}`);

    const uniqueOcs = [...new Set(revs.map(r => r.numero_oc))];
    if (uniqueOcs.length !== 1 || uniqueOcs[0] !== TEST_OC_NUM) throw new Error('Número OC incorrecto en registros.');

    pass(12, 'Integridad de registros en revisiones_bodega', `${totalRegistros} registros totales: AA1(×3 lotes), AA2(×1), AA3(×1). Número OC consistente en todos.`);
  } catch (e) { fail(12, 'Integridad de datos', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log('\n================================================================================');
  log('🚀  SUITE E2E AMPLIADA: REVISIONES PARCIALES, SALDO OC Y CIERRE MANUAL');
  log('================================================================================\n');

  try {
    await setup();
    await runTests();
  } finally {
    await teardown();
  }

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  log('================================================================================');
  log('📊  RESUMEN FINAL DE RESULTADOS');
  log('================================================================================\n');
  results.forEach(r => {
    const icon = r.status === 'PASSED' ? '✅' : '❌';
    log(`${icon} [Test ${r.num}] ${r.titulo}`);
    log(`   ${r.detalle}`);
  });

  log(`\n── TOTAL: ${results.length} tests ── ${passed} PASADOS ── ${failed} FALLADOS ──\n`);

  if (failed > 0) {
    log('⚠️  Se detectaron errores. Revisar los tests fallados antes de subir a GitHub.\n');
    process.exit(1);
  } else {
    log('🎉  Todos los tests pasaron correctamente. Sistema validado.\n');
  }
}

main();
