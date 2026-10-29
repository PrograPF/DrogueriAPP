const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function runTests() {
  console.log('=== TEST E2E: SUBMÓDULO CALENDARIO TAREAS QF ===\n');

  // 1. Validar Categorías
  console.log('1. Validando Categorías...');
  const { data: categorias, error: errCat } = await supabase
    .from('qf_categorias_tareas')
    .select('*')
    .eq('activo', true);

  if (errCat || !categorias || categorias.length === 0) {
    throw new Error('Fallo al obtener categorías: ' + JSON.stringify(errCat));
  }
  console.log(`✓ ${categorias.length} categorías obtenidas correctamente:`, categorias.map(c => c.codigo).join(', '));

  // 2. Validar Plantilla Maestra
  console.log('\n2. Validando Plantilla Maestra de Tareas...');
  const { data: plantillas, error: errPlan } = await supabase
    .from('qf_tareas_plantilla')
    .select('*')
    .eq('activo', true);

  if (errPlan || !plantillas || plantillas.length === 0) {
    throw new Error('Fallo al obtener plantillas: ' + JSON.stringify(errPlan));
  }
  console.log(`✓ ${plantillas.length} tareas maestras registradas en la plantilla.`);

  // 3. Validar Registros Históricos de Octubre 2026
  console.log('\n3. Validando Registros Históricos de Octubre 2026...');
  const { data: octData, error: errOct } = await supabase
    .from('qf_tareas_registro_mensual')
    .select('*')
    .eq('anio', 2026)
    .eq('mes', 10);

  if (errOct || !octData || octData.length === 0) {
    throw new Error('Fallo al obtener registros de Octubre 2026: ' + JSON.stringify(errOct));
  }
  console.log(`✓ ${octData.length} tareas cargadas para Octubre 2026.`);

  // 4. Validar Registros de Noviembre 2026
  console.log('\n4. Validando Registros de Noviembre 2026...');
  const { data: novData, error: errNov } = await supabase
    .from('qf_tareas_registro_mensual')
    .select('*')
    .eq('anio', 2026)
    .eq('mes', 11);

  if (errNov || !novData || novData.length === 0) {
    throw new Error('Fallo al obtener registros de Noviembre 2026: ' + JSON.stringify(errNov));
  }
  console.log(`✓ ${novData.length} tareas cargadas para Noviembre 2026.`);

  // 5. Test de Marcación de Tarea (Estado Realizada + Comentario QF)
  console.log('\n5. Probando marcación de tarea con comentario...');
  const tareaATestear = novData[0];
  console.log(`Tarea seleccionada: [${tareaATestear.categoria_codigo}] "${tareaATestear.titulo}" (ID: ${tareaATestear.id})`);

  const timestamp = new Date().toISOString();
  const testComment = 'Test E2E QF - Verificación de calibración de termómetros conforme';
  const testQf = 'QF María González';

  const { data: updated, error: errUpd } = await supabase
    .from('qf_tareas_registro_mensual')
    .update({
      estado: 'REALIZADA',
      realizado_por: testQf,
      fecha_realizacion: timestamp,
      comentario: testComment,
      updated_at: timestamp
    })
    .eq('id', tareaATestear.id)
    .select('*')
    .single();

  if (errUpd || !updated) {
    throw new Error('Error al actualizar tarea: ' + JSON.stringify(errUpd));
  }

  if (updated.estado !== 'REALIZADA' || updated.comentario !== testComment || updated.realizado_por !== testQf) {
    throw new Error('Los datos actualizados no coinciden.');
  }
  console.log(`✓ Tarea actualizada con éxito: Estado=${updated.estado}, QF=${updated.realizado_por}, Comentario="${updated.comentario}"`);

  // Limpiar / resetear la tarea de prueba
  console.log('\n6. Restaurando estado original de la tarea de prueba...');
  await supabase
    .from('qf_tareas_registro_mensual')
    .update({
      estado: 'PENDIENTE',
      realizado_por: null,
      fecha_realizacion: null,
      comentario: null
    })
    .eq('id', tareaATestear.id);

  console.log('✓ Tarea restaurada a PENDIENTE correctamente.');

  console.log('\n=============================================');
  console.log(' TODOS LOS TESTS E2E DEL SUBMÓDULO QF PASARON ');
  console.log('=============================================\n');
}

runTests().catch(err => {
  console.error('ERROR EN TESTS:', err);
  process.exit(1);
});
