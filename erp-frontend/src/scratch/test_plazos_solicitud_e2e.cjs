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

async function runTest() {
  console.log('--- INICIO PRUEBA E2E: PLAZOS INFORMATIVOS EN SOLICITUDES_COMPRA ---');
  const testNum = `TEST-S-PLAZO-${Date.now()}`;
  let createdId = null;

  try {
    // 1. Insert Test
    console.log(`1. Insertando solicitud ${testNum} con plazos informativos...`);
    const { data: insertData, error: insertError } = await supabase
      .from('solicitudes_compra')
      .insert([{
        numero_solicitud: testNum,
        codigo_articulo: 'TEST-ART-001',
        descripcion_articulo: 'Artículo de prueba para plazos informativos',
        cantidad: 10,
        estado: 'Sin OC asignada',
        plazo_aceptacion_dias: 5,
        plazo_entrega_dias: 15,
        tipo_plazo_entrega: 'Hábiles'
      }])
      .select();

    if (insertError) throw new Error('Error al insertar: ' + insertError.message);
    if (!insertData || insertData.length === 0) throw new Error('No se retornaron datos tras la inserción');

    createdId = insertData[0].id;
    console.log('✅ Solicitud insertada correctamente con ID:', createdId);
    console.log('   Valores insertados:', {
      plazo_aceptacion_dias: insertData[0].plazo_aceptacion_dias,
      plazo_entrega_dias: insertData[0].plazo_entrega_dias,
      tipo_plazo_entrega: insertData[0].tipo_plazo_entrega
    });

    if (insertData[0].plazo_aceptacion_dias !== 5 ||
        insertData[0].plazo_entrega_dias !== 15 ||
        insertData[0].tipo_plazo_entrega !== 'Hábiles') {
      throw new Error('Los valores leídos tras inserción no coinciden con los esperados');
    }

    // 2. Update Test (Corridos)
    console.log('2. Actualizando solicitud a plazo Corridos y nuevos días...');
    const { data: updateData, error: updateError } = await supabase
      .from('solicitudes_compra')
      .update({
        plazo_aceptacion_dias: 10,
        plazo_entrega_dias: 30,
        tipo_plazo_entrega: 'Corridos'
      })
      .eq('id', createdId)
      .select();

    if (updateError) throw new Error('Error al actualizar: ' + updateError.message);
    console.log('✅ Solicitud actualizada con éxito:', {
      plazo_aceptacion_dias: updateData[0].plazo_aceptacion_dias,
      plazo_entrega_dias: updateData[0].plazo_entrega_dias,
      tipo_plazo_entrega: updateData[0].tipo_plazo_entrega
    });

    if (updateData[0].plazo_aceptacion_dias !== 10 ||
        updateData[0].plazo_entrega_dias !== 30 ||
        updateData[0].tipo_plazo_entrega !== 'Corridos') {
      throw new Error('Los valores leídos tras actualización no coinciden');
    }

    // 3. Nullable Test
    console.log('3. Probando borrado/limpieza de campos (nullable)...');
    const { data: nullData, error: nullError } = await supabase
      .from('solicitudes_compra')
      .update({
        plazo_aceptacion_dias: null,
        plazo_entrega_dias: null,
        tipo_plazo_entrega: null
      })
      .eq('id', createdId)
      .select();

    if (nullError) throw new Error('Error al resetear a null: ' + nullError.message);
    console.log('✅ Solicitud reseteada a null con éxito:', {
      plazo_aceptacion_dias: nullData[0].plazo_aceptacion_dias,
      plazo_entrega_dias: nullData[0].plazo_entrega_dias,
      tipo_plazo_entrega: nullData[0].tipo_plazo_entrega
    });

    if (nullData[0].plazo_aceptacion_dias !== null ||
        nullData[0].plazo_entrega_dias !== null ||
        nullData[0].tipo_plazo_entrega !== null) {
      throw new Error('Los valores no se resetearon a null correctamente');
    }

    console.log('🎉 TODAS LAS VALIDACIONES DE BASE DE DATOS Y SUPABASE PASARON CON ÉXITO');
  } finally {
    // Cleanup
    if (createdId) {
      console.log('4. Limpiando datos de prueba...');
      const { error: delError } = await supabase
        .from('solicitudes_compra')
        .delete()
        .eq('id', createdId);
      if (delError) {
        console.error('Advertencia al limpiar registro:', delError.message);
      } else {
        console.log('✅ Registro de prueba eliminado satisfactoriamente.');
      }
    }
  }
}

runTest();
