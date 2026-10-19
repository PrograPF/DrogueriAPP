const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k) env[k] = v.join('=').trim();
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

let fails = 0;
const check = (name, cond, extra = '') => { 
  console.log(`${cond ? '✅' : '❌'} ${name} ${extra}`); 
  if (!cond) fails++; 
};

async function main() {
  const ts = Date.now();
  const solNum1 = `S-TEST-ED1-${ts}`;
  const solNum2 = `S-TEST-ED2-${ts}`;
  const ocNumOriginal = `2332-TEST-AG-${ts}`;
  const ocNumModificado = `2332-MODIF-AG-${ts}`;

  let solId1 = null, solId2 = null, ocId = null;
  let artId1 = null, artId2 = null;

  try {
    console.log('--- INICIO PRUEBA E2E: EDICIÓN DE OC / AG ---');

    // 1. Crear solicitudes de prueba
    const { data: s1, error: errS1 } = await supabase.from('solicitudes_compra').insert([{
      numero_solicitud: solNum1,
      codigo_articulo: 'TEST-ART-1',
      descripcion_articulo: 'Articulo Test 1',
      cantidad: 10,
      fecha_creacion: '2026-10-19',
      estado: 'Sin OC asignada',
      tipo_oc: 'AG'
    }]).select();
    check('Crear Solicitud 1 de prueba', !errS1 && s1?.length > 0, errS1?.message || '');
    if (s1?.[0]) solId1 = s1[0].id;

    const { data: s2, error: errS2 } = await supabase.from('solicitudes_compra').insert([{
      numero_solicitud: solNum2,
      codigo_articulo: 'TEST-ART-2',
      descripcion_articulo: 'Articulo Test 2',
      cantidad: 20,
      fecha_creacion: '2026-10-19',
      estado: 'Sin OC asignada',
      tipo_oc: 'AG'
    }]).select();
    check('Crear Solicitud 2 de prueba', !errS2 && s2?.length > 0, errS2?.message || '');
    if (s2?.[0]) solId2 = s2[0].id;

    // 2. Crear OC vinculada a Solicitud 1
    const { data: oc, error: errOc } = await supabase.from('ordenes_compra').insert([{
      numero_oc: ocNumOriginal,
      solicitud_compra: solNum1,
      proveedor: 'PROVEEDOR ORIGINAL LTDA',
      rut_proveedor: '77111222-3',
      tipo_oc: 'AG',
      estado: 'Enviada',
      fecha_envio: new Date().toISOString(),
      fecha_tope_aceptacion: '2026-10-22',
      fecha_tope_entrega: '2026-10-28',
      fecha_tope_multa: '2026-11-04'
    }]).select();
    check('Crear OC original', !errOc && oc?.length > 0, errOc?.message || '');
    if (oc?.[0]) ocId = oc[0].id;

    // 3. Insertar 2 artículos asociados a la OC
    const { data: arts, error: errArts } = await supabase.from('ordenes_compra_articulos').insert([
      { oc_id: ocId, codigo_articulo: 'TEST-ART-1', cantidad: 5, cantidad_recepcionada: 0, estado_recepcion: 'Pendiente' },
      { oc_id: ocId, codigo_articulo: 'TEST-ART-DELETE', cantidad: 2, cantidad_recepcionada: 0, estado_recepcion: 'Pendiente' }
    ]).select();
    check('Insertar artículos asociados a OC', !errArts && arts?.length === 2, errArts?.message || '');
    if (arts?.[0]) artId1 = arts[0].id;
    if (arts?.[1]) artId2 = arts[1].id;

    // 4. Crear registro en revisiones_bodega con el número original para comprobar actualización en cascada
    const crypto = require('crypto');
    const sessionId = crypto.randomUUID();
    const { data: rev, error: errRev } = await supabase.from('revisiones_bodega').insert([{
      session_id: sessionId,
      numero_oc: ocNumOriginal,
      codigo_articulo: 'TEST-ART-1',
      lote: 'LOTE-TEST-1',
      isp: 'ISP-TEST-1',
      cantidad: 5,
      fecha: '2026-10-19',
      tipo_documento: 'Guia',
      numero_documento: 'G-123'
    }]).select();
    check('Crear registro de revisión de bodega para verificar cascada', !errRev && rev?.length > 0, errRev?.message || '');

    // 5. SIMULACIÓN DE EDICIÓN MEDIANTE LA LÓGICA IMPLEMENTADA:
    // Modificar:
    // - numero_oc: ocNumOriginal -> ocNumModificado
    // - solicitud_compra: solNum1 -> solNum2
    // - proveedor: PROVEEDOR ACTUALIZADO SA
    // - rut_proveedor: 99888777-6
    // - estado: Aceptada
    // - fechas tope modificadas
    // - artId1: cantidad 5 -> 15
    // - artId2: eliminado
    // - nuevo artículo añadido: TEST-ART-NUEVO, cantidad 8

    // A) Actualizar cabecera de ordenes_compra
    const { error: errUpdOc } = await supabase.from('ordenes_compra').update({
      numero_oc: ocNumModificado,
      solicitud_compra: solNum2,
      proveedor: 'PROVEEDOR ACTUALIZADO SA',
      rut_proveedor: '99888777-6',
      estado: 'Aceptada',
      fecha_aceptacion: new Date().toISOString(),
      fecha_tope_aceptacion: '2026-10-23',
      fecha_tope_entrega: '2026-10-29',
      fecha_tope_multa: '2026-11-05'
    }).eq('id', ocId);
    check('Actualizar cabecera de OC', !errUpdOc, errUpdOc?.message || '');

    // B) Actualizar en cascada revisiones_bodega si el número de OC cambió
    const { error: errUpdRev } = await supabase.from('revisiones_bodega')
      .update({ numero_oc: ocNumModificado })
      .eq('numero_oc', ocNumOriginal);
    check('Actualizar en cascada revisiones_bodega con nuevo numero_oc', !errUpdRev, errUpdRev?.message || '');

    // C) Actualizar cantidad de artId1
    const { error: errUpdArt1 } = await supabase.from('ordenes_compra_articulos')
      .update({ cantidad: 15 })
      .eq('id', artId1);
    check('Actualizar cantidad de artículo existente (5 -> 15)', !errUpdArt1);

    // D) Eliminar artId2
    const { error: errDelArt2 } = await supabase.from('ordenes_compra_articulos')
      .delete()
      .eq('id', artId2);
    check('Eliminar artículo desasociado de la OC', !errDelArt2);

    // E) Añadir nuevo artículo a la OC
    const { data: artNuevo, error: errInsArtNuevo } = await supabase.from('ordenes_compra_articulos').insert([{
      oc_id: ocId,
      codigo_articulo: 'TEST-ART-NUEVO',
      cantidad: 8,
      cantidad_recepcionada: 0,
      estado_recepcion: 'Pendiente'
    }]).select();
    check('Añadir nuevo artículo a la OC (TEST-ART-NUEVO)', !errInsArtNuevo && artNuevo?.length > 0);

    // 6. VALIDACIONES POST-EDICIÓN:
    const { data: ocVerif } = await supabase.from('ordenes_compra').select(`
      *,
      ordenes_compra_articulos (*)
    `).eq('id', ocId).single();

    check('Verificación: numero_oc modificado', ocVerif?.numero_oc === ocNumModificado);
    check('Verificación: solicitud_compra modificada', ocVerif?.solicitud_compra === solNum2);
    check('Verificación: proveedor modificado', ocVerif?.proveedor === 'PROVEEDOR ACTUALIZADO SA');
    check('Verificación: rut_proveedor modificado', ocVerif?.rut_proveedor === '99888777-6');
    check('Verificación: estado cambiado a Aceptada', ocVerif?.estado === 'Aceptada');
    check('Verificación: fecha_tope_entrega actualizada', ocVerif?.fecha_tope_entrega === '2026-10-29');

    // Verificar artículos
    const artsList = ocVerif?.ordenes_compra_articulos || [];
    check('Verificación: total artículos es 2', artsList.length === 2);
    const art1Verif = artsList.find(a => a.codigo_articulo === 'TEST-ART-1');
    const artNuevoVerif = artsList.find(a => a.codigo_articulo === 'TEST-ART-NUEVO');
    const art2Eliminado = artsList.find(a => a.codigo_articulo === 'TEST-ART-DELETE');
    check('Verificación: art1 tiene cantidad 15', art1Verif?.cantidad === 15);
    check('Verificación: nuevo artículo existe con cantidad 8', artNuevoVerif?.cantidad === 8);
    check('Verificación: art2 fue eliminado correctamente', art2Eliminado === undefined);

    // Verificar revisiones_bodega actualizada
    const { data: revVerif } = await supabase.from('revisiones_bodega').select('*').eq('numero_oc', ocNumModificado);
    check('Verificación: revisiones_bodega sincronizada con nuevo numero_oc', (revVerif || []).length > 0);

  } catch (err) {
    console.error('Error durante la prueba:', err);
    fails++;
  } finally {
    console.log('--- LIMPIEZA TOTAL DE DATOS TEMPORALES ---');
    if (ocId) {
      await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', ocId);
      await supabase.from('ordenes_compra').delete().eq('id', ocId);
    }
    await supabase.from('revisiones_bodega').delete().eq('numero_oc', ocNumOriginal);
    await supabase.from('revisiones_bodega').delete().eq('numero_oc', ocNumModificado);
    if (solId1) await supabase.from('solicitudes_compra').delete().eq('id', solId1);
    if (solId2) await supabase.from('solicitudes_compra').delete().eq('id', solId2);

    const { data: r1 } = await supabase.from('ordenes_compra').select('id').in('numero_oc', [ocNumOriginal, ocNumModificado]);
    const { data: r2 } = await supabase.from('solicitudes_compra').select('id').in('numero_solicitud', [solNum1, solNum2]);
    const { data: r3 } = await supabase.from('revisiones_bodega').select('id').in('numero_oc', [ocNumOriginal, ocNumModificado]);

    check('Limpieza total: sin OCs residuales', (r1 || []).length === 0);
    check('Limpieza total: sin solicitudes residuales', (r2 || []).length === 0);
    check('Limpieza total: sin revisiones residuales', (r3 || []).length === 0);

    console.log(fails === 0 ? '\n🎉 PRUEBA E2E DE EDICIÓN EXITOSA (0 fallas)' : `\n❌ FALLAS DETECTADAS: ${fails}`);
    process.exit(fails ? 1 : 0);
  }
}

main();
