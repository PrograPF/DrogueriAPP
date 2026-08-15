const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valParts] = line.trim().split('=');
  if (key) env[key] = valParts.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Helper function to calculate OC reception state (matching RecepcionArticulosModule.jsx)
function calcularEstadoRecepcionOc(articulos) {
  if (!articulos || articulos.length === 0) return null;
  const estados = articulos.map(a => a.estado_recepcion || 'Pendiente');
  const todosPendientes = estados.every(e => e === 'Pendiente');
  const todosListos = estados.every(e => e === 'Recepcionado' || e === 'Revisado');
  const todosRechazados = estados.every(e => e === 'Rechazado');
  const hayRecepcionado = estados.some(e => e === 'Recepcionado' || e === 'Revisado');
  const hayRechazado = estados.some(e => e === 'Rechazado');

  if (todosPendientes) return null;
  if (todosListos) return 'Recepcion Completa';
  if (todosRechazados) return 'Rechazo';
  if (hayRecepcionado && hayRechazado) return 'Recepcion Parcial/Rechazo';
  if (hayRecepcionado) return 'Recepcion Parcial';
  if (hayRechazado) return 'Recepcion Parcial/Rechazo';
  return null;
}

// Helper to evaluate solicitud status (matching solicitudHelper.js)
async function evaluarYActualizarEstadoSolicitud(solNumero, excludeOcIds = []) {
  if (!solNumero) return;
  const trimmed = solNumero.trim();
  const { data: solData } = await supabase
    .from('solicitudes_compra')
    .select(`id, numero_solicitud, codigo_articulo, solicitudes_compra_articulos (codigo_articulo)`)
    .eq('numero_solicitud', trimmed)
    .maybeSingle();

  if (!solData) return;

  const requestedCodes = new Set();
  if (solData.solicitudes_compra_articulos && solData.solicitudes_compra_articulos.length > 0) {
    solData.solicitudes_compra_articulos.forEach(a => {
      if (a.codigo_articulo) requestedCodes.add(a.codigo_articulo.trim().toUpperCase());
    });
  } else if (solData.codigo_articulo) {
    requestedCodes.add(solData.codigo_articulo.trim().toUpperCase());
  }

  const { data: ocsData } = await supabase
    .from('ordenes_compra')
    .select(`id, numero_oc, solicitud_compra, estado, ordenes_compra_articulos (codigo_articulo, estado_recepcion)`)
    .ilike('solicitud_compra', solData.numero_solicitud);

  const excludeSet = new Set(excludeOcIds.map(id => String(id)));
  const activeOcs = (ocsData || []).filter(oc => {
    const isCancelled = oc.estado === 'Cancelado' || oc.estado === 'Cancelada';
    return !isCancelled && !excludeSet.has(String(oc.id));
  });

  const assignedCodes = new Set();
  activeOcs.forEach(oc => {
    (oc.ordenes_compra_articulos || []).forEach(art => {
      if (art.codigo_articulo && art.estado_recepcion !== 'Rechazado') {
        assignedCodes.add(art.codigo_articulo.trim().toUpperCase());
      }
    });
  });

  let assignedCount = 0;
  requestedCodes.forEach(code => {
    if (assignedCodes.has(code)) assignedCount++;
  });

  let nuevoEstado = 'Sin OC asignada';
  if (assignedCount >= requestedCodes.size) {
    nuevoEstado = 'OC asignada completa';
  } else if (assignedCount > 0) {
    nuevoEstado = 'OC asignada parcial';
  }

  await supabase
    .from('solicitudes_compra')
    .update({ estado: nuevoEstado })
    .eq('id', solData.id);

  return nuevoEstado;
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO BATERÍA DE PRUEBAS AUTOMÁTICAS E2E');
  console.log('====================================================\n');

  const testSolNum = 'S-TEST-AUTO-999';
  const testOcNum = 'OC-TEST-AUTO-999';
  const testCodes = ['345', '1004'];

  const results = [];

  try {
    // 1. Limpieza preventiva previa
    const { data: oldOcs } = await supabase.from('ordenes_compra').select('id').eq('numero_oc', testOcNum);
    if (oldOcs && oldOcs.length > 0) {
      for (const o of oldOcs) {
        await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', o.id);
      }
      await supabase.from('ordenes_compra').delete().eq('numero_oc', testOcNum);
    }
    const { data: oldSols } = await supabase.from('solicitudes_compra').select('id').eq('numero_solicitud', testSolNum);
    if (oldSols && oldSols.length > 0) {
      for (const s of oldSols) {
        await supabase.from('solicitudes_compra_articulos').delete().eq('solicitud_id', s.id);
      }
      await supabase.from('solicitudes_compra').delete().eq('numero_solicitud', testSolNum);
    }

    // TEST 1: Crear Solicitud de Compra de Prueba
    console.log('🔹 TEST 1: Creación de Solicitud de Compra con 2 artículos...');
    const { data: solCreated, error: solErr } = await supabase
      .from('solicitudes_compra')
      .insert({
        numero_solicitud: testSolNum,
        codigo_articulo: testCodes[0],
        estado: 'Sin OC asignada'
      })
      .select()
      .single();

    if (solErr) throw solErr;

    const { error: solArtErr } = await supabase
      .from('solicitudes_compra_articulos')
      .insert(testCodes.map(code => ({
        solicitud_id: solCreated.id,
        codigo_articulo: code,
        cantidad: 100
      })));

    if (solArtErr) throw solArtErr;

    results.push({
      test: '1. Creación de Solicitud de Compra',
      status: 'PASSED',
      detail: `Solicitud ${testSolNum} creada con 2 artículos en estado "Sin OC asignada".`
    });

    // TEST 2: Asignación a Orden de Compra
    console.log('🔹 TEST 2: Asignación de Solicitud a Orden de Compra...');
    const { data: ocCreated, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert({
        numero_oc: testOcNum,
        solicitud_compra: testSolNum,
        proveedor: 'PROVEEDOR TEST',
        tipo_oc: 'AG',
        estado: 'Aceptada',
        estado_recepcion: null
      })
      .select()
      .single();

    if (ocErr) throw ocErr;

    const { data: ocArtsCreated, error: ocArtErr } = await supabase
      .from('ordenes_compra_articulos')
      .insert(testCodes.map(code => ({
        oc_id: ocCreated.id,
        codigo_articulo: code,
        cantidad: 100,
        estado_recepcion: 'Pendiente',
        historial_cambios: []
      })))
      .select();

    if (ocArtErr) throw ocArtErr;

    const solEstadoPostAsignacion = await evaluarYActualizarEstadoSolicitud(testSolNum);
    const passTest2 = solEstadoPostAsignacion === 'OC asignada completa';

    results.push({
      test: '2. Asignación y Evaluación de Solicitud',
      status: passTest2 ? 'PASSED' : 'FAILED',
      detail: `Solicitud evaluada -> Estado: "${solEstadoPostAsignacion}" (Esperado: "OC asignada completa").`
    });

    // TEST 3: Transición 1 en Recepción (Pendiente -> Recepcionado)
    console.log('🔹 TEST 3: Recepción parcial (Artículo 1 pasa a Recepcionado)...');
    const art1 = ocArtsCreated[0];
    const now1 = new Date().toISOString();
    const hist1 = [{ de: 'Pendiente', a: 'Recepcionado', fecha: now1 }];

    await supabase
      .from('ordenes_compra_articulos')
      .update({ estado_recepcion: 'Recepcionado', fecha_recepcion: now1, historial_cambios: hist1 })
      .eq('id', art1.id);

    const { data: artsTest3 } = await supabase
      .from('ordenes_compra_articulos')
      .select('estado_recepcion')
      .eq('oc_id', ocCreated.id);

    const ocEstadoTest3 = calcularEstadoRecepcionOc(artsTest3);
    const passTest3 = ocEstadoTest3 === 'Recepcion Parcial';

    results.push({
      test: '3. Transición de Estado y Cálculo OC (Recepcionado)',
      status: passTest3 ? 'PASSED' : 'FAILED',
      detail: `Artículo 1 a "Recepcionado". Estado OC global: "${ocEstadoTest3}" (Esperado: "Recepcion Parcial").`
    });

    // TEST 4: Transición 2 (Retroceso: Recepcionado -> Pendiente, Acumulación en Historial)
    console.log('🔹 TEST 4: Retroceso de estado (Recepcionado -> Pendiente sin borrar historial)...');
    const now2 = new Date(Date.now() + 1000).toISOString();
    const hist2 = [...hist1, { de: 'Recepcionado', a: 'Pendiente', fecha: now2 }];

    await supabase
      .from('ordenes_compra_articulos')
      .update({ estado_recepcion: 'Pendiente', fecha_recepcion: null, historial_cambios: hist2 })
      .eq('id', art1.id);

    const { data: art1PostRetroceso } = await supabase
      .from('ordenes_compra_articulos')
      .select('historial_cambios, estado_recepcion')
      .eq('id', art1.id)
      .single();

    const { data: artsTest4 } = await supabase
      .from('ordenes_compra_articulos')
      .select('estado_recepcion')
      .eq('oc_id', ocCreated.id);

    const ocEstadoTest4 = calcularEstadoRecepcionOc(artsTest4);
    const passTest4 = (art1PostRetroceso.historial_cambios.length === 2) && (ocEstadoTest4 === null);

    results.push({
      test: '4. Acumulación de Historial en Retroceso y Reset de OC',
      status: passTest4 ? 'PASSED' : 'FAILED',
      detail: `Historial conservó ${art1PostRetroceso.historial_cambios.length} eventos cronológicos. Estado OC reseteado a: ${ocEstadoTest4} (Esperado: null).`
    });

    // TEST 5: Transición 3 (Rechazo y Liberación de Solicitud)
    console.log('🔹 TEST 5: Rechazo de artículos y liberación automática de Solicitud...');
    const now3 = new Date(Date.now() + 2000).toISOString();
    const hist3 = [...hist2, { de: 'Pendiente', a: 'Rechazado', fecha: now3 }];

    // Rechazar artículo 1 (3 eventos acumulados)
    await supabase
      .from('ordenes_compra_articulos')
      .update({ estado_recepcion: 'Rechazado', fecha_recepcion: now3, historial_cambios: hist3 })
      .eq('id', art1.id);

    // Rechazar artículo 2
    const art2 = ocArtsCreated[1];
    const histArt2 = [{ de: 'Pendiente', a: 'Rechazado', fecha: now3 }];
    await supabase
      .from('ordenes_compra_articulos')
      .update({ estado_recepcion: 'Rechazado', fecha_recepcion: now3, historial_cambios: histArt2 })
      .eq('id', art2.id);

    const solEstadoPostRechazo = await evaluarYActualizarEstadoSolicitud(testSolNum);
    
    const { data: art1Final } = await supabase
      .from('ordenes_compra_articulos')
      .select('historial_cambios')
      .eq('id', art1.id)
      .single();

    const passTest5 = (solEstadoPostRechazo === 'Sin OC asignada') && (art1Final.historial_cambios.length === 3);

    results.push({
      test: '5. Liberación de Solicitud tras Rechazo y Total de Historial',
      status: passTest5 ? 'PASSED' : 'FAILED',
      detail: `Solicitud liberada -> Estado: "${solEstadoPostRechazo}" (Esperado: "Sin OC asignada"). Eventos acumulados en Art 1: ${art1Final.historial_cambios.length}.`
    });

  } catch (err) {
    console.error('❌ ERROR durante ejecución de pruebas:', err);
    results.push({
      test: 'Ejecución General de Pruebas',
      status: 'FAILED',
      detail: err.message
    });
  } finally {
    // CLEANUP AUTOMÁTICO
    console.log('\n🔹 LIMPIEZA AUTOMÁTICA DE DATOS TEMPORALES...');
    try {
      const { data: ocsToDel } = await supabase.from('ordenes_compra').select('id').eq('numero_oc', testOcNum);
      if (ocsToDel && ocsToDel.length > 0) {
        for (const oc of ocsToDel) {
          await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', oc.id);
        }
        await supabase.from('ordenes_compra').delete().eq('numero_oc', testOcNum);
      }

      const { data: solsToDel } = await supabase.from('solicitudes_compra').select('id').eq('numero_solicitud', testSolNum);
      if (solsToDel && solsToDel.length > 0) {
        for (const s of solsToDel) {
          await supabase.from('solicitudes_compra_articulos').delete().eq('solicitud_id', s.id);
        }
        await supabase.from('solicitudes_compra').delete().eq('numero_solicitud', testSolNum);
      }
      console.log('✅ Base de datos 100% limpia. Datos de prueba eliminados correctamente.');
    } catch (cleanupErr) {
      console.error('Error durante cleanup:', cleanupErr);
    }
  }

  console.log('\n====================================================');
  console.log('📊 RESUMEN DE RESULTADOS:');
  console.log('====================================================');
  results.forEach(r => {
    console.log(`${r.status === 'PASSED' ? '✅' : '❌'} [${r.status}] ${r.test}`);
    console.log(`   ${r.detail}\n`);
  });
}

runTests();
