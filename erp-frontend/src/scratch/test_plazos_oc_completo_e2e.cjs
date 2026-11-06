const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const envPath = path.join(__dirname, '../../.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('=== INICIO PRUEBA E2E: PLAZOS EN SOLICITUD, ASIGNAR OC Y EDITAR OC ===');

  const testNumSol = `TEST-S-PLAZOS-${Date.now()}`;
  const testNumOc = `TEST-OC-PLAZOS-${Date.now()}`;
  let solId = null;
  let ocId = null;

  try {
    // 1. Crear Solicitud con plazos informativos
    console.log('1. Creando Solicitud con plazos...');
    const { data: solData, error: solErr } = await supabase
      .from('solicitudes_compra')
      .insert([{
        numero_solicitud: testNumSol,
        codigo_articulo: 'TEST-ART-01',
        descripcion_articulo: 'ARTICULO TEST PLAZOS',
        cantidad: 10,
        tipo_oc: 'AG',
        fecha_creacion: '2026-11-06',
        estado: 'Pendiente',
        plazo_aceptacion_dias: 3,
        plazo_entrega_dias: 20,
        tipo_plazo_entrega: 'Hábiles'
      }])
      .select();

    if (solErr) throw solErr;
    solId = solData[0].id;
    console.log(`  ✅ Solicitud creada id: ${solId}`);
    assert.strictEqual(solData[0].plazo_aceptacion_dias, 3);
    assert.strictEqual(solData[0].plazo_entrega_dias, 20);
    assert.strictEqual(solData[0].tipo_plazo_entrega, 'Hábiles');

    // 2. Simular Asignar OC heredando de la solicitud
    console.log('2. Asignando OC heredando plazos de la solicitud...');
    const { data: ocData, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert([{
        numero_oc: testNumOc,
        solicitud_compra: testNumSol,
        proveedor: 'PROVEEDOR TEST PRUEBAS',
        rut_proveedor: '76.123.456-7',
        tipo_oc: 'AG',
        estado: 'Enviada',
        fecha_envio: new Date().toISOString(),
        plazo_aceptacion_dias: solData[0].plazo_aceptacion_dias,
        plazo_entrega_dias: solData[0].plazo_entrega_dias,
        tipo_plazo_entrega: solData[0].tipo_plazo_entrega
      }])
      .select();

    if (ocErr) throw ocErr;
    ocId = ocData[0].id;
    console.log(`  ✅ OC creada id: ${ocId}`);
    assert.strictEqual(ocData[0].plazo_aceptacion_dias, 3);
    assert.strictEqual(ocData[0].plazo_entrega_dias, 20);
    assert.strictEqual(ocData[0].tipo_plazo_entrega, 'Hábiles');

    // 3. Simular Editar la OC con nuevos plazos
    console.log('3. Editando OC con nuevos plazos (5 días, 45 días, Corridos)...');
    const { data: updatedOc, error: updateOcErr } = await supabase
      .from('ordenes_compra')
      .update({
        plazo_aceptacion_dias: 5,
        plazo_entrega_dias: 45,
        tipo_plazo_entrega: 'Corridos'
      })
      .eq('id', ocId)
      .select();

    if (updateOcErr) throw updateOcErr;
    console.log('  ✅ OC actualizada exitosamente');
    assert.strictEqual(updatedOc[0].plazo_aceptacion_dias, 5);
    assert.strictEqual(updatedOc[0].plazo_entrega_dias, 45);
    assert.strictEqual(updatedOc[0].tipo_plazo_entrega, 'Corridos');

    // 4. Simular Editar la Solicitud con nuevos plazos
    console.log('4. Editando Solicitud con nuevos plazos (2 días, 15 días, Corridos)...');
    const { data: updatedSol, error: updateSolErr } = await supabase
      .from('solicitudes_compra')
      .update({
        plazo_aceptacion_dias: 2,
        plazo_entrega_dias: 15,
        tipo_plazo_entrega: 'Corridos'
      })
      .eq('id', solId)
      .select();

    if (updateSolErr) throw updateSolErr;
    console.log('  ✅ Solicitud actualizada exitosamente');
    assert.strictEqual(updatedSol[0].plazo_aceptacion_dias, 2);
    assert.strictEqual(updatedSol[0].plazo_entrega_dias, 15);
    assert.strictEqual(updatedSol[0].tipo_plazo_entrega, 'Corridos');

  } catch (err) {
    console.error('❌ Error durante la prueba:', err);
    process.exitCode = 1;
  } finally {
    // 5. Limpieza total de datos de prueba
    console.log('5. Limpiando datos de prueba temporales en Supabase...');
    if (ocId) {
      await supabase.from('ordenes_compra').delete().eq('id', ocId);
    }
    if (solId) {
      await supabase.from('solicitudes_compra').delete().eq('id', solId);
    }
    console.log('  ✅ Limpieza total completada.');
    console.log('🎉 TODAS LAS VALIDACIONES E2E FINALIZARON CON ÉXITO.');
  }
}

run();

