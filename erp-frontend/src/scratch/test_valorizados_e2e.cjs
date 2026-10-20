const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer variables de entorno de .env
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
  console.log('--- INICIO DE PRUEBAS AUTOMATIZADAS: MÓDULO VALORIZADOS ---\n');

  // =========================================================================
  // FASE 1: FILTROS DE INCLUSIÓN Y EXCLUSIÓN EN "VALORIZADOS"
  // =========================================================================
  console.log('📌 FASE 1: Validación de Reglas de Inclusión en "Valorizados"');

  const filterLogic = (oc) => {
    if (oc.estado === 'Cancelado' || oc.estado === 'Cancelada') return false;
    const arts = oc.ordenes_compra_articulos || [];
    if (arts.length === 0) return false;
    const totalSol = arts.reduce((sum, a) => sum + (Number(a.cantidad) || 0), 0);
    const totalRec = arts.reduce((sum, a) => sum + (Number(a.cantidad_recepcionada) || 0), 0);
    return totalRec > 0 && totalRec < totalSol;
  };

  // Caso 1: Sin recepciones (0 de 10) -> NO debe incluirse
  const ocSinRecepciones = {
    numero_oc: 'OC-TEST-01',
    estado: 'Enviada',
    ordenes_compra_articulos: [{ cantidad: 10, cantidad_recepcionada: 0, precio_unitario: 1000 }]
  };
  check('OC sin recepciones (0 un.) se excluye de Valorizados', filterLogic(ocSinRecepciones) === false);

  // Caso 2: 100% recepcionada (10 de 10) -> NO debe incluirse
  const ocCompleta = {
    numero_oc: 'OC-TEST-02',
    estado: 'Recepción Conforme',
    ordenes_compra_articulos: [{ cantidad: 10, cantidad_recepcionada: 10, precio_unitario: 1000 }]
  };
  check('OC 100% completada se excluye de Valorizados', filterLogic(ocCompleta) === false);

  // Caso 3: Cancelada con recepciones previas -> NO debe incluirse
  const ocCancelada = {
    numero_oc: 'OC-TEST-03',
    estado: 'Cancelado',
    ordenes_compra_articulos: [{ cantidad: 10, cantidad_recepcionada: 4, precio_unitario: 1000 }]
  };
  check('OC cancelada se excluye de Valorizados', filterLogic(ocCancelada) === false);

  // Caso 4: Recepción parcial legítima (4 de 10) -> SÍ debe incluirse
  const ocParcial = {
    numero_oc: 'OC-TEST-04',
    estado: 'Aceptada',
    ordenes_compra_articulos: [
      { codigo_articulo: 'A-101', cantidad: 10, cantidad_recepcionada: 4, precio_unitario: 2500 },
      { codigo_articulo: 'A-102', cantidad: 5,  cantidad_recepcionada: 5, precio_unitario: 10000 },
      { codigo_articulo: 'A-103', cantidad: 2,  cantidad_recepcionada: 0, precio_unitario: 50000 }
    ]
  };
  check('OC con recepción parcial incompleta se incluye en Valorizados', filterLogic(ocParcial) === true);

  // =========================================================================
  // FASE 2: CÁLCULOS FINANCIEROS Y ARTÍCULOS INCOMPLETOS
  // =========================================================================
  console.log('\n📌 FASE 2: Cálculos Financieros por Orden y Consolidados');

  const arts = ocParcial.ordenes_compra_articulos;
  const totalSol = arts.reduce((sum, a) => sum + a.cantidad, 0); // 10 + 5 + 2 = 17
  const totalRec = arts.reduce((sum, a) => sum + a.cantidad_recepcionada, 0); // 4 + 5 + 0 = 9
  const totalNeto = arts.reduce((sum, a) => sum + (a.cantidad * a.precio_unitario), 0); 
  // 10*2500 (25000) + 5*10000 (50000) + 2*50000 (100000) = 175000

  const recepcionadoNeto = arts.reduce((sum, a) => sum + (a.cantidad_recepcionada * a.precio_unitario), 0);
  // 4*2500 (10000) + 5*10000 (50000) + 0 (0) = 60000

  const saldoFaltanteNeto = totalNeto - recepcionadoNeto; // 175000 - 60000 = 115000
  const saldoFaltanteIva = Math.round(saldoFaltanteNeto * 1.19); // Math.round(115000 * 1.19) = 136850

  check('Total unidades solicitadas = 17', totalSol === 17);
  check('Total unidades recepcionadas = 9', totalRec === 9);
  check('Total Neto OC = $175.000', totalNeto === 175000);
  check('Saldo Recepcionado Neto = $60.000', recepcionadoNeto === 60000);
  check('Saldo Faltante Neto = $115.000', saldoFaltanteNeto === 115000);
  check('Saldo Faltante c/IVA (19%) = $136.850', saldoFaltanteIva === 136850);

  // Artículos incompletos (deben ser 2: A-101 y A-103)
  const artsIncompletos = arts.filter(a => a.cantidad_recepcionada < a.cantidad);
  check('Cantidad de artículos incompletos = 2', artsIncompletos.length === 2);
  check('Artículos incompletos son A-101 y A-103', artsIncompletos.some(a => a.codigo_articulo === 'A-101') && artsIncompletos.some(a => a.codigo_articulo === 'A-103'));

  // =========================================================================
  // FASE 3: INTEGRACIÓN Y LIMPIEZA TOTAL EN SUPABASE
  // =========================================================================
  console.log('\n📌 FASE 3: Integración E2E en Supabase y Limpieza 100%');

  const ts = Date.now();
  const testOcNum = `OC-TEST-VAL-${ts}`;
  let testOcId = null;

  try {
    const isMissing = (e) => e && (e.code === '42703' || e.code === 'PGRST204' || (e.message && e.message.includes('schema cache')));

    // 1. Crear OC de prueba
    let ocInsertData = {
      numero_oc: testOcNum,
      proveedor: 'PROVEEDOR TEST VALORIZADOS',
      rut_proveedor: '76888999-1',
      tipo_oc: 'SE',
      estado: 'Aceptada',
      fecha_envio: new Date().toISOString()
    };

    let { data: ocCreated, error: ocErr } = await supabase.from('ordenes_compra').insert([ocInsertData]).select();
    check('Creación de OC de prueba para Valorizados en Supabase', !ocErr && ocCreated?.length > 0, ocErr ? ocErr.message : '');

    if (ocCreated && ocCreated[0]) {
      testOcId = ocCreated[0].id;

      // 2. Insertar artículos de prueba con recepción parcial (simulando lo ingresado en Recepción de Productos)
      let art1 = {
        oc_id: testOcId,
        codigo_articulo: 'TEST-VAL-01',
        cantidad: 10,
        cantidad_recepcionada: 4,
        precio_unitario: 2500,
        subtotal_neto: 25000,
        estado_recepcion: 'Pendiente'
      };

      let art2 = {
        oc_id: testOcId,
        codigo_articulo: 'TEST-VAL-02',
        cantidad: 5,
        cantidad_recepcionada: 5,
        precio_unitario: 10000,
        subtotal_neto: 50000,
        estado_recepcion: 'Recepcionado'
      };

      let { data: artInsData, error: artInsErr } = await supabase.from('ordenes_compra_articulos').insert([art1, art2]).select();
      if (isMissing(artInsErr)) {
        console.log('   ℹ️ Columnas financieras aún no migradas, probando fallback en artículos...');
        delete art1.precio_unitario; delete art1.subtotal_neto;
        delete art2.precio_unitario; delete art2.subtotal_neto;
        const resFb = await supabase.from('ordenes_compra_articulos').insert([art1, art2]).select();
        artInsData = resFb.data;
        artInsErr = resFb.error;
      }

      check('Inserción de artículos con recepción parcial exitosa', !artInsErr && artInsData?.length === 2, artInsErr ? artInsErr.message : '');

      // 3. Consultar la OC con sus artículos de vuelta (exactamente como lo hace cargarOcs en SeguimientoOCModule)
      const { data: ocQuery, error: qErr } = await supabase
        .from('ordenes_compra')
        .select(`*, ordenes_compra_articulos (*)`)
        .eq('id', testOcId)
        .single();

      check('Consulta de OC con artículos vinculados exitosa', !qErr && !!ocQuery);
      check('OC de prueba cumple la regla de inclusión en Valorizados', filterLogic(ocQuery) === true);
    }
  } catch (err) {
    check('Excepción no controlada en Supabase', false, err.message);
  } finally {
    console.log('\n🧹 Limpiando 100% de registros temporales en Supabase...');
    if (testOcId) {
      await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', testOcId);
      const { error: delErr } = await supabase.from('ordenes_compra').delete().eq('id', testOcId);
      check('Limpieza total de datos temporales en Supabase', !delErr, delErr ? delErr.message : '');
    }
  }

  // =========================================================================
  // REPORTE FINAL
  // =========================================================================
  console.log('\n======================================================');
  if (fails === 0) {
    console.log('🎉 TODAS LAS VALIDACIONES DE "VALORIZADOS" PASARON EXITOSAMENTE (0 errores)');
  } else {
    console.log(`❌ SE REGISTRARON ${fails} FALLO(S)`);
  }
  console.log('======================================================\n');
  process.exit(fails ? 1 : 0);
}

main();
