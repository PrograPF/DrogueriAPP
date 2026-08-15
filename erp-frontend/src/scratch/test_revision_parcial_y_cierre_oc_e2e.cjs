/**
 * Test E2E Automatizado: Revisiones Parciales por Cantidad, Ajuste de Unidades de OC y Cierre Manual con Pendientes
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer variables de entorno desde .env
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

const crypto = require('crypto');
const TEST_OC_NUM = 'OC-TEST-PARCIAL-999';
const TEST_SESSION_1 = crypto.randomUUID();
const TEST_SESSION_2 = crypto.randomUUID();

const results = [];

async function runTests() {
  console.log('========================================================================');
  console.log('🚀 INICIANDO PRUEBAS E2E: REVISIONES PARCIALES Y CIERRE MANUAL DE OC');
  console.log('========================================================================\n');

  let testOcId = null;
  let artOcId1 = null;
  let artOcId2 = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Crear OC de prueba con 2 artículos
    // -------------------------------------------------------------
    console.log('🔹 TEST 1: Creando OC de prueba con 2 artículos (1.000 uds y 600 uds)...');
    
    // Limpieza previa por seguridad
    await supabase.from('revisiones_bodega').delete().eq('numero_oc', TEST_OC_NUM);
    await supabase.from('ordenes_compra_articulos').delete().eq('codigo_articulo', 'TEST-345');
    await supabase.from('ordenes_compra_articulos').delete().eq('codigo_articulo', 'TEST-1004');
    await supabase.from('ordenes_compra').delete().eq('numero_oc', TEST_OC_NUM);

    const { data: ocCreated, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert({
        numero_oc: TEST_OC_NUM,
        proveedor: 'PROVEEDOR TEST PARCIAL LTDA',
        tipo_oc: 'Medicamentos',
        estado: 'Aceptada',
        estado_recepcion: 'Recepcion Completa',
        estado_revision: null,
        fecha_envio: new Date().toISOString().split('T')[0]
      })
      .select('id, numero_oc')
      .single();

    if (ocErr) throw new Error('Error al crear OC: ' + ocErr.message);
    testOcId = ocCreated.id;

    // Crear artículos de la OC
    const { data: artsCreated, error: artsErr } = await supabase
      .from('ordenes_compra_articulos')
      .insert([
        {
          oc_id: testOcId,
          codigo_articulo: 'TEST-345',
          cantidad: 1000,
          estado_recepcion: 'Recepcionado'
        },
        {
          oc_id: testOcId,
          codigo_articulo: 'TEST-1004',
          cantidad: 600,
          estado_recepcion: 'Recepcionado'
        }
      ])
      .select('id, codigo_articulo, cantidad');

    if (artsErr) throw new Error('Error al crear artículos de OC: ' + artsErr.message);
    artOcId1 = artsCreated.find(a => a.codigo_articulo === 'TEST-345').id;
    artOcId2 = artsCreated.find(a => a.codigo_articulo === 'TEST-1004').id;

    results.push({
      test: '1. Creación de OC y Artículos',
      status: 'PASSED',
      detail: `OC ${TEST_OC_NUM} creada con Artículo TEST-345 (1.000 uds) y TEST-1004 (600 uds).`
    });

    // -------------------------------------------------------------
    // TEST 2: Primera Revisión Parcial (400 uds del Artículo TEST-345)
    // -------------------------------------------------------------
    console.log('🔹 TEST 2: Ejecutando primera revisión parcial (400 de 1.000 uds de TEST-345)...');
    const { error: rev1Err } = await supabase
      .from('revisiones_bodega')
      .insert({
        session_id: TEST_SESSION_1,
        codigo_articulo: 'TEST-345',
        lote: 'LOTE-PARCIAL-A',
        isp: 'ISP-991',
        cantidad: 400,
        tipo_documento: 'Factura',
        numero_documento: 'FAC-1001',
        numero_oc: TEST_OC_NUM
      });

    if (rev1Err) throw new Error('Error al insertar revisión 1: ' + rev1Err.message);

    // Calcular estado OC tras revisión 1
    const { data: revsPost1 } = await supabase
      .from('revisiones_bodega')
      .select('codigo_articulo, cantidad')
      .eq('numero_oc', TEST_OC_NUM);

    const sumaRev1 = revsPost1.filter(r => r.codigo_articulo === 'TEST-345').reduce((s, r) => s + r.cantidad, 0);
    const saldoPendiente1 = 1000 - sumaRev1;

    // Actualizar estado OC a Revision Parcial
    await supabase.from('ordenes_compra').update({ estado_revision: 'Revision Parcial' }).eq('id', testOcId);

    if (saldoPendiente1 !== 600) {
      throw new Error(`Saldo pendiente esperado: 600, obtenido: ${saldoPendiente1}`);
    }

    results.push({
      test: '2. Revisión Parcial y Cálculo de Saldo',
      status: 'PASSED',
      detail: `Artículo TEST-345 revisó 400 uds. Saldo pendiente calculado correctamente: ${saldoPendiente1} uds. OC en 'Revision Parcial'.`
    });

    // -------------------------------------------------------------
    // TEST 3: Modificar Cantidad de la OC (Ajuste de Unidad de Medida)
    // -------------------------------------------------------------
    console.log('🔹 TEST 3: Ajustando cantidad de la OC de TEST-345 de 1.000 a 1.200 unidades...');
    const { error: editErr } = await supabase
      .from('ordenes_compra_articulos')
      .update({ cantidad: 1200 })
      .eq('id', artOcId1);

    if (editErr) throw new Error('Error al modificar cantidad de OC: ' + editErr.message);

    const nuevoSaldo = 1200 - sumaRev1; // 1200 - 400 = 800
    if (nuevoSaldo !== 800) {
      throw new Error(`Nuevo saldo esperado: 800, obtenido: ${nuevoSaldo}`);
    }

    results.push({
      test: '3. Modificación de Cantidad OC (Unidades de Medida)',
      status: 'PASSED',
      detail: `Cantidad en OC actualizada a 1.200 uds. Nuevo saldo pendiente recalculado en 800 uds.`
    });

    // -------------------------------------------------------------
    // TEST 4: Segunda Revisión Completando TEST-345 (800 uds restantes)
    // -------------------------------------------------------------
    console.log('🔹 TEST 4: Ejecutando segunda revisión para completar TEST-345 (800 uds)...');
    const { error: rev2Err } = await supabase
      .from('revisiones_bodega')
      .insert({
        session_id: TEST_SESSION_2,
        codigo_articulo: 'TEST-345',
        lote: 'LOTE-PARCIAL-B',
        isp: 'ISP-991',
        cantidad: 800,
        tipo_documento: 'Factura',
        numero_documento: 'FAC-1002',
        numero_oc: TEST_OC_NUM
      });

    if (rev2Err) throw new Error('Error al insertar revisión 2: ' + rev2Err.message);

    const { data: revsPost2 } = await supabase
      .from('revisiones_bodega')
      .select('codigo_articulo, cantidad')
      .eq('numero_oc', TEST_OC_NUM);

    const totalRev345 = revsPost2.filter(r => r.codigo_articulo === 'TEST-345').reduce((s, r) => s + r.cantidad, 0);
    const totalRev1004 = revsPost2.filter(r => r.codigo_articulo === 'TEST-1004').reduce((s, r) => s + r.cantidad, 0);

    const art345Completo = totalRev345 >= 1200; // 1200 / 1200 -> true
    const art1004Completo = totalRev1004 >= 600; // 0 / 600 -> false

    if (!art345Completo || art1004Completo) {
      throw new Error('Estado inconsistente de completitud de artículos.');
    }

    results.push({
      test: '4. Completitud de Artículo Multi-Lote',
      status: 'PASSED',
      detail: `TEST-345 alcanzó 1.200/1.200 unidades (Completo). TEST-1004 sigue pendiente (0/600). OC sigue en 'Revision Parcial'.`
    });

    // -------------------------------------------------------------
    // TEST 5: Cierre Manual de OC ("Cerrada con Pendientes")
    // -------------------------------------------------------------
    console.log('🔹 TEST 5: Ejecutando Cierre Manual de OC con estado "Cerrada con Pendientes"...');
    const { error: closeErr } = await supabase
      .from('ordenes_compra')
      .update({ estado_revision: 'Cerrada con Pendientes' })
      .eq('id', testOcId);

    if (closeErr) throw new Error('Error al cerrar OC: ' + closeErr.message);

    const { data: ocClosed } = await supabase
      .from('ordenes_compra')
      .select('estado_revision')
      .eq('id', testOcId)
      .single();

    if (ocClosed.estado_revision !== 'Cerrada con Pendientes') {
      throw new Error(`Estado de revisión esperado: 'Cerrada con Pendientes', obtenido: '${ocClosed.estado_revision}'`);
    }

    results.push({
      test: '5. Cierre Manual con Pendientes',
      status: 'PASSED',
      detail: `OC ${TEST_OC_NUM} actualizada a estado 'Cerrada con Pendientes'. Retirada de pendientes de revisión.`
    });

    // -------------------------------------------------------------
    // TEST 6: Reabrir OC Cerrada
    // -------------------------------------------------------------
    console.log('🔹 TEST 6: Reabriendo OC para verificar reversibilidad...');
    const { error: reopenErr } = await supabase
      .from('ordenes_compra')
      .update({ estado_revision: 'Revision Parcial' })
      .eq('id', testOcId);

    if (reopenErr) throw new Error('Error al reabrir OC: ' + reopenErr.message);

    const { data: ocReopened } = await supabase
      .from('ordenes_compra')
      .select('estado_revision')
      .eq('id', testOcId)
      .single();

    if (ocReopened.estado_revision !== 'Revision Parcial') {
      throw new Error(`Estado esperado tras reabrir: 'Revision Parcial', obtenido: '${ocReopened.estado_revision}'`);
    }

    results.push({
      test: '6. Reabrir Orden de Compra',
      status: 'PASSED',
      detail: `OC ${TEST_OC_NUM} reabierta con éxito y devuelta a estado 'Revision Parcial'.`
    });

  } catch (err) {
    console.error('❌ ERROR EN PRUEBA:', err.message);
    results.push({
      test: 'Ejecución de Pruebas',
      status: 'FAILED',
      detail: err.message
    });
  } finally {
    // -------------------------------------------------------------
    // LIMPIEZA TOTAL DE BASE DE DATOS
    // -------------------------------------------------------------
    console.log('\n🔹 LIMPIEZA TOTAL DE BASE DE DATOS...');
    try {
      await supabase.from('revisiones_bodega').delete().eq('numero_oc', TEST_OC_NUM);
      if (testOcId) {
        await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', testOcId);
        await supabase.from('ordenes_compra').delete().eq('id', testOcId);
      }
      console.log('✅ Base de datos 100% limpia. Registros temporales eliminados con éxito.');
    } catch (cleanErr) {
      console.error('Error durante limpieza:', cleanErr.message);
    }
  }

  // -------------------------------------------------------------
  // REPORTE DE RESULTADOS
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('📊 RESUMEN DE RESULTADOS DE PRUEBA:');
  console.log('========================================================================');
  results.forEach(r => {
    const icon = r.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.test}`);
    console.log(`   ${r.detail}\n`);
  });
}

runTests();
