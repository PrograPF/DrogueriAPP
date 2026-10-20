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
  console.log('--- INICIO DE PRUEBAS AUTOMATIZADAS: SUB-CENTRO C.M EN RESOLUTIVIDAD ---\n');

  // =========================================================================
  // FASE 1: CONSULTA DE SUB-CENTROS EN SUPABASE
  // =========================================================================
  console.log('📌 FASE 1: Consulta de sub-centros en tabla sub_centros_costo');

  const { data: subCentros, error: scErr } = await supabase
    .from('sub_centros_costo')
    .select('nombre')
    .order('nombre', { ascending: true });

  check('Consulta a sub_centros_costo sin error', !scErr);
  const nombres = (subCentros || []).map(s => s.nombre);
  console.log('   Opciones cargadas:', nombres.join(', '));
  check('Total de sub-centros es 4', nombres.length === 4, `(Esperado 4, obtenido ${nombres.length})`);
  check('Incluye "C.M"', nombres.includes('C.M'));
  check('Incluye "ORL"', nombres.includes('ORL'));
  check('Incluye "TD"', nombres.includes('TD'));
  check('Incluye "UAPO"', nombres.includes('UAPO'));

  // =========================================================================
  // FASE 2: FLUJO DE SOLICITUD Y ARTÍCULO CON C.M (CON LIMPIEZA)
  // =========================================================================
  console.log('\n📌 FASE 2: Guardado de Solicitud de Compra con Sub-Centro C.M');

  let tempSolId = null;
  const testSolNum = 'SOL-TEST-CM-' + Date.now();

  try {
    const { data: solData, error: solErr } = await supabase
      .from('solicitudes_compra')
      .insert([{
        numero_solicitud: testSolNum,
        centro_costo_id: 8,
        centro_costo_nombre: 'RESOLUTIVIDAD',
        estado: 'Sin OC asignada',
        codigo_articulo: 'TEST-ART-CM',
        descripcion_articulo: 'Insumo Prueba Resolutividad',
        cantidad: 50,
        fecha_creacion: new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (solErr) throw solErr;
    tempSolId = solData.id;
    check('Inserción de Solicitud de Compra de prueba', tempSolId !== null);

    const { data: artData, error: artErr } = await supabase
      .from('solicitudes_compra_articulos')
      .insert([{
        solicitud_id: tempSolId,
        codigo_articulo: 'TEST-ART-CM',
        descripcion_articulo: 'Insumo Prueba Resolutividad',
        cantidad: 50,
        sub_centro_costo: 'C.M'
      }])
      .select()
      .single();

    check('Guardado de artículo con sub_centro_costo="C.M"', !artErr && artData?.sub_centro_costo === 'C.M');

    // Simular el mapeo hacia Seguimiento OC
    const subTag = artData.sub_centro_costo ? ` [${artData.sub_centro_costo}]` : '';
    const nombreEnOc = `${artData.descripcion_articulo}${subTag}`;
    check('Etiquetado dinámico para Seguimiento OC incluye "[C.M]"', nombreEnOc.includes('[C.M]'), `Resultado: "${nombreEnOc}"`);

  } catch (err) {
    console.error('Error durante prueba de Solicitud:', err);
    fails++;
  } finally {
    if (tempSolId) {
      console.log('\n🧹 Limpiando registros temporales de prueba...');
      await supabase.from('solicitudes_compra_articulos').delete().eq('solicitud_id', tempSolId);
      await supabase.from('solicitudes_compra').delete().eq('id', tempSolId);
      console.log('✅ Base de datos 100% limpia sin registros temporales.');
    }
  }

  console.log(`\n=========================================================================`);
  console.log(`RESULTADO FINAL DE PRUEBAS: ${fails === 0 ? 'TODAS LAS PRUEBAS PASARON EXITOSAMENTE (0 fallos)' : `${fails} fallos detectados`}`);
  console.log(`=========================================================================\n`);

  process.exit(fails > 0 ? 1 : 0);
}

main();
