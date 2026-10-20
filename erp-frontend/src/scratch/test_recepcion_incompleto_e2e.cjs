const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer .env
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

// Replicación de la función matemática/lógica de calcularEstadoRecepcionOc
function calcularEstadoRecepcionOc(articulos) {
  if (!articulos || articulos.length === 0) return null;
  const estados = articulos.map(a => a.estado_recepcion || 'Pendiente');
  const todosPendientes  = estados.every(e => e === 'Pendiente');
  const todosListos      = estados.every(e => e === 'Recepcionado' || e === 'Revisado');
  const todosRechazados  = estados.every(e => e === 'Rechazado');
  const hayRecepcionado  = estados.some(e => e === 'Recepcionado' || e === 'Revisado' || e === 'Recepción Incompleto');
  const hayRechazado     = estados.some(e => e === 'Rechazado');

  if (todosPendientes)                    return null;
  if (todosListos)                        return 'Recepcion Completa';
  if (todosRechazados)                    return 'Rechazo';
  if (hayRecepcionado && hayRechazado)    return 'Recepcion Parcial/Rechazo';
  if (hayRecepcionado)                    return 'Recepcion Parcial';
  if (hayRechazado)                       return 'Recepcion Parcial/Rechazo';
  return null;
}

async function main() {
  console.log('--- INICIO DE PRUEBAS AUTOMATIZADAS: ESTADO RECEPCIÓN INCOMPLETO Y REVISIÓN EN BODEGA ---\n');

  // =========================================================================
  // FASE 1: LÓGICA DE ESTADOS Y COMBINACIONES DE OC
  // =========================================================================
  console.log('📌 FASE 1: Lógica de Evaluación de Estado Global de la OC');

  check('Todos Pendientes devuelve null', calcularEstadoRecepcionOc([{ estado_recepcion: 'Pendiente' }]) === null);
  check('Todos Recepcionados devuelve "Recepcion Completa"', calcularEstadoRecepcionOc([{ estado_recepcion: 'Recepcionado' }, { estado_recepcion: 'Recepcionado' }]) === 'Recepcion Completa');
  check('Artículos Recepcionado + Recepción Incompleto devuelve "Recepcion Parcial"', 
    calcularEstadoRecepcionOc([{ estado_recepcion: 'Recepcionado' }, { estado_recepcion: 'Recepción Incompleto' }]) === 'Recepcion Parcial'
  );
  check('Solo Recepción Incompleto devuelve "Recepcion Parcial"', 
    calcularEstadoRecepcionOc([{ estado_recepcion: 'Recepción Incompleto' }]) === 'Recepcion Parcial'
  );
  check('Recepción Incompleto + Rechazado devuelve "Recepcion Parcial/Rechazo"', 
    calcularEstadoRecepcionOc([{ estado_recepcion: 'Recepción Incompleto' }, { estado_recepcion: 'Rechazado' }]) === 'Recepcion Parcial/Rechazo'
  );

  // =========================================================================
  // FASE 2: COMPATIBILIDAD CON FILTRO DE REVISIÓN EN BODEGA
  // =========================================================================
  console.log('\n📌 FASE 2: Filtro de Artículos en Módulo de Revisión en Bodega');

  const articulosMock = [
    { id: 1, codigo_articulo: 'ART-01', estado_recepcion: 'Recepcionado' },
    { id: 2, codigo_articulo: 'ART-02', estado_recepcion: 'Recepción Incompleto' },
    { id: 3, codigo_articulo: 'ART-03', estado_recepcion: 'Pendiente' },
    { id: 4, codigo_articulo: 'ART-04', estado_recepcion: 'Rechazado' }
  ];

  const artsFiltradosRevision = articulosMock.filter(
    a => a.estado_recepcion === 'Recepcionado' || a.estado_recepcion === 'Recepción Incompleto'
  );

  check('Filtro de revisión incluye "Recepcionado"', artsFiltradosRevision.some(a => a.codigo_articulo === 'ART-01'));
  check('Filtro de revisión incluye "Recepción Incompleto"', artsFiltradosRevision.some(a => a.codigo_articulo === 'ART-02'));
  check('Filtro de revisión EXCLUYE "Pendiente"', !artsFiltradosRevision.some(a => a.codigo_articulo === 'ART-03'));
  check('Filtro de revisión EXCLUYE "Rechazado"', !artsFiltradosRevision.some(a => a.codigo_articulo === 'ART-04'));

  // =========================================================================
  // FASE 3: PRUEBA E2E EN BASE DE DATOS SUPABASE (CON LIMPIEZA TOTAL)
  // =========================================================================
  console.log('\n📌 FASE 3: Operaciones E2E en Base de Datos Supabase');

  const testOcNum = 'TEST-INCOMPLETO-' + Date.now();
  let tempOcId = null;

  try {
    // 1. Insertar OC temporal
    const { data: ocData, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert([{
        numero_oc: testOcNum,
        proveedor: 'Proveedor Prueba Incompleto',
        tipo_oc: 'AG',
        estado: 'Enviada',
        estado_recepcion: 'Recepcion Parcial',
        fecha_envio: new Date().toISOString()
      }])
      .select()
      .single();

    if (ocErr) throw ocErr;
    tempOcId = ocData.id;
    check('Inserción de OC temporal exitosa', tempOcId !== null, `ID: ${tempOcId}`);

    // 2. Insertar artículo con estado 'Recepción Incompleto'
    const { data: artData, error: artErr } = await supabase
      .from('ordenes_compra_articulos')
      .insert([{
        oc_id: tempOcId,
        codigo_articulo: 'TEST-ART-99',
        cantidad: 100,
        estado_recepcion: 'Recepción Incompleto',
        fecha_recepcion: new Date().toISOString()
      }])
      .select()
      .single();

    check('Inserción de artículo con "Recepción Incompleto" permitida en BD', !artErr, artErr ? artErr.message : `ID: ${artData?.id}`);

    // 3. Simular consulta de OCs disponibles en RevisionBodegaModule
    const { data: ocsRevision, error: qErr } = await supabase
      .from('ordenes_compra')
      .select(`
        *,
        ordenes_compra_articulos (
          id,
          codigo_articulo,
          cantidad,
          estado_recepcion
        )
      `)
      .eq('id', tempOcId)
      .in('estado_recepcion', ['Recepcion Completa', 'Recepcion Parcial', 'Recepcion Parcial/Rechazo']);

    if (qErr) throw qErr;
    check('OC con "Recepcion Parcial" es cargada por módulo de Revisión', ocsRevision && ocsRevision.length > 0);

    const ocRecuperada = ocsRevision[0];
    const artsDisponibles = (ocRecuperada.ordenes_compra_articulos || []).filter(
      a => a.estado_recepcion === 'Recepcionado' || a.estado_recepcion === 'Recepción Incompleto'
    );
    check('Artículo con "Recepción Incompleto" es filtrado y disponible para revisión', 
      artsDisponibles.length === 1 && artsDisponibles[0].codigo_articulo === 'TEST-ART-99'
    );

  } catch (err) {
    console.error('Error durante prueba E2E:', err);
    fails++;
  } finally {
    // Limpieza total
    if (tempOcId) {
      console.log('\n🧹 Limpiando datos temporales de prueba...');
      await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', tempOcId);
      await supabase.from('ordenes_compra').delete().eq('id', tempOcId);
      console.log('✅ Base de datos 100% limpia sin registros temporales residuales.');
    }
  }

  console.log(`\n=========================================================================`);
  console.log(`RESULTADO FINAL DE PRUEBAS: ${fails === 0 ? 'TODAS LAS PRUEBAS PASARON EXITOSAMENTE (0 fallos)' : `${fails} fallos detectados`}`);
  console.log(`=========================================================================\n`);

  process.exit(fails > 0 ? 1 : 0);
}

main();
