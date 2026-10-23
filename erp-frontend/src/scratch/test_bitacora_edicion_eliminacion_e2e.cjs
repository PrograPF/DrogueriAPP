const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(l => {
  const [k, ...v] = l.trim().split('=');
  if (k) env[k] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runE2ETests() {
  console.log('--- INICIANDO TEST E2E: EDICIÓN Y ELIMINACIÓN DE BITÁCORA ---');
  let allPassed = true;

  // 1. TEST: Bitácora de Órdenes de Compra (ordenes_compra_comentarios)
  console.log('\n[TEST 1] Verificando flujo en ordenes_compra_comentarios (Seguimiento OC / Recepción)...');
  try {
    const { data: ocs, error: ocErr } = await supabase.from('ordenes_compra').select('id, numero_oc').limit(1);
    if (ocErr || !ocs || ocs.length === 0) throw new Error('No se encontró OC para prueba: ' + (ocErr?.message || 'vacio'));
    const testOc = ocs[0];
    console.log(`  OC seleccionada: ${testOc.numero_oc} (${testOc.id})`);

    // 1.1 Insertar
    const { data: insData, error: insErr } = await supabase
      .from('ordenes_compra_comentarios')
      .insert([{ oc_id: testOc.id, comentario: 'TEST_E2E_INICIAL: Comentario de prueba' }])
      .select();
    if (insErr || !insData || insData.length === 0) throw new Error('Error al insertar comentario de OC: ' + insErr?.message);
    const commentId = insData[0].id;
    console.log(`  ✓ Inserción exitosa. ID: ${commentId}`);

    // 1.2 Editar
    const updatedText = 'TEST_E2E_EDITADO: Comentario corregido exitosamente';
    const { data: updData, error: updErr } = await supabase
      .from('ordenes_compra_comentarios')
      .update({ comentario: updatedText })
      .eq('id', commentId)
      .select();
    if (updErr || !updData || updData.length === 0) throw new Error('Error al editar comentario de OC: ' + updErr?.message);
    if (updData[0].comentario !== updatedText) throw new Error(`El texto editado no coincide: ${updData[0].comentario}`);
    console.log(`  ✓ Edición exitosa y persistida: "${updData[0].comentario}"`);

    // 1.3 Eliminar
    const { error: delErr } = await supabase
      .from('ordenes_compra_comentarios')
      .delete()
      .eq('id', commentId);
    if (delErr) throw new Error('Error al eliminar comentario de OC: ' + delErr.message);

    // 1.4 Verificar eliminación
    const { data: checkData } = await supabase
      .from('ordenes_compra_comentarios')
      .select('*')
      .eq('id', commentId);
    if (checkData && checkData.length > 0) throw new Error('El comentario no fue eliminado de la BD');
    console.log('  ✓ Eliminación confirmada: el registro ya no existe en la base de datos.');

  } catch (err) {
    console.error('  ✗ FALLÓ TEST 1:', err.message);
    allPassed = false;
  }

  // 2. TEST: Bitácora de Variantes/Lotes en Inventario (articulos_variantes_comentarios)
  console.log('\n[TEST 2] Verificando flujo en articulos_variantes_comentarios (Inventario)...');
  try {
    const { data: vars, error: varErr } = await supabase.from('articulos_variantes').select('id, codigo_articulo, lote').limit(1);
    if (varErr || !vars || vars.length === 0) throw new Error('No se encontró variante para prueba: ' + (varErr?.message || 'vacio'));
    const testVar = vars[0];
    console.log(`  Variante seleccionada: ${testVar.codigo_articulo} / Lote ${testVar.lote} (ID: ${testVar.id})`);

    // 2.1 Insertar
    const { data: insVarData, error: insVarErr } = await supabase
      .from('articulos_variantes_comentarios')
      .insert([{
        variante_id: testVar.id,
        comentario: 'TEST_E2E_VAR_INICIAL: Nota de lote',
        usuario: 'Operador Inicial'
      }])
      .select();
    if (insVarErr || !insVarData || insVarData.length === 0) throw new Error('Error al insertar nota de lote: ' + insVarErr?.message);
    const varCommentId = insVarData[0].id;
    console.log(`  ✓ Inserción exitosa de nota de lote. ID: ${varCommentId}`);

    // 2.2 Editar (comentario y usuario)
    const updatedVarText = 'TEST_E2E_VAR_EDITADO: Nota de lote corregida';
    const updatedUser = 'Farmacéutico Revisor';
    const { data: updVarData, error: updVarErr } = await supabase
      .from('articulos_variantes_comentarios')
      .update({
        comentario: updatedVarText,
        usuario: updatedUser
      })
      .eq('id', varCommentId)
      .select();
    if (updVarErr || !updVarData || updVarData.length === 0) throw new Error('Error al editar nota de lote: ' + updVarErr?.message);
    if (updVarData[0].comentario !== updatedVarText || updVarData[0].usuario !== updatedUser) {
      throw new Error('Los datos editados no coinciden en la base de datos');
    }
    console.log(`  ✓ Edición exitosa y persistida: "${updVarData[0].comentario}" por "${updVarData[0].usuario}"`);

    // 2.3 Eliminar
    const { error: delVarErr } = await supabase
      .from('articulos_variantes_comentarios')
      .delete()
      .eq('id', varCommentId);
    if (delVarErr) throw new Error('Error al eliminar nota de lote: ' + delVarErr.message);

    // 2.4 Verificar eliminación
    const { data: checkVarData } = await supabase
      .from('articulos_variantes_comentarios')
      .select('*')
      .eq('id', varCommentId);
    if (checkVarData && checkVarData.length > 0) throw new Error('La nota de lote no fue eliminada de la BD');
    console.log('  ✓ Eliminación confirmada: el registro ya no existe en la base de datos.');

  } catch (err) {
    console.error('  ✗ FALLÓ TEST 2:', err.message);
    allPassed = false;
  }

  console.log('\n========================================');
  if (allPassed) {
    console.log(' TODOS LOS TESTS E2E PASARON EXITOSAMENTE!');
  } else {
    console.log(' AL MENOS UN TEST FALLÓ.');
    process.exit(1);
  }
  console.log('========================================\n');
}

runE2ETests();
