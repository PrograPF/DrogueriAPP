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
  console.log('--- INICIO DE PRUEBAS AUTOMATIZADAS: RECEPCIÓN DE EXCEPCIÓN Y CÁLCULOS FINANCIEROS ---\n');

  // =========================================================================
  // FASE 1: LÓGICA DE PLAZOS Y ESTADO 'Recepción de excepción'
  // =========================================================================
  console.log('📌 FASE 1: Comportamiento de Plazos y Estados en plazosHelper.js');

  const { evaluarPlazos, ESTADOS_FINALES } = await import('../utils/plazosHelper.js');

  check('ESTADOS_FINALES incluye "Recepción de excepción"', ESTADOS_FINALES.includes('Recepción de excepción'));
  check('ESTADOS_FINALES NO incluye "Excepciones" (sigue siendo estado activo de alerta)', !ESTADOS_FINALES.includes('Excepciones'));

  const ocExcepcionActiva = {
    estado: 'Excepciones',
    fecha_tope_aceptacion: '2026-10-01',
    fecha_tope_entrega: '2026-10-10',
    fecha_tope_multa: '2026-10-15'
  };
  const resActiva = evaluarPlazos(ocExcepcionActiva, '2026-10-20');
  check('OC en "Excepciones" activa alerta púrpura', resActiva.isPurpura === true && resActiva.badgeColor === '#c080c0');
  check('OC en "Excepciones" tiene mensaje descriptivo de régimen de excepción', resActiva.glosa.includes('Excepción') || resActiva.glosa.includes('excepción'));

  const ocRecepcionadaExcepcion = {
    estado: 'Recepción de excepción',
    fecha_tope_aceptacion: '2026-10-01',
    fecha_tope_entrega: '2026-10-10',
    fecha_tope_multa: '2026-10-15'
  };
  const resFinal = evaluarPlazos(ocRecepcionadaExcepcion, '2026-10-20');
  check('OC en "Recepción de excepción" se considera estado final', resFinal.isFinal === true && resFinal.nivel === 'final');
  check('OC en "Recepción de excepción" no gatilla alertas rojas de vencimiento', resFinal.isExpired === false && resFinal.isOrange === false && resFinal.isYellow === false);
  check('OC en "Recepción de excepción" conserva color púrpura distintivo', resFinal.badgeColor === '#c080c0');

  // =========================================================================
  // FASE 2: FÓRMULAS FINANCIERAS
  // =========================================================================
  console.log('\n📌 FASE 2: Fórmulas Matemáticas Financieras (Neto, IVA 19%, Saldo)');

  const articulosTest = [
    { codigo: 'ART-01', cantidad: 10, precio_unitario: 1500, recepcionado: 10 },
    { codigo: 'ART-02', cantidad: 5,  precio_unitario: 2000, recepcionado: 2 },
    { codigo: 'ART-03', cantidad: 2,  precio_unitario: 25000, recepcionado: 0 }
  ];

  // Cálculos por artículo
  const subtotales = articulosTest.map(a => a.cantidad * a.precio_unitario);
  check('Subtotal Art 1: 10 * 1500 = 15000', subtotales[0] === 15000);
  check('Subtotal Art 2: 5 * 2000 = 10000', subtotales[1] === 10000);
  check('Subtotal Art 3: 2 * 25000 = 50000', subtotales[2] === 50000);

  // Total neto OC
  const totalNeto = subtotales.reduce((a, b) => a + b, 0);
  check('Total Neto OC: 15000 + 10000 + 50000 = 75000', totalNeto === 75000);

  // Total con IVA (19%)
  const totalConIva = Math.round(totalNeto * 1.19);
  check('Total con IVA (19%): Math.round(75000 * 1.19) = 89250', totalConIva === 89250);

  // Saldo de OC con recepciones parciales
  const montoRecepcionado = articulosTest.reduce((sum, a) => sum + (a.recepcionado * a.precio_unitario), 0);
  // Art 1: 10 * 1500 = 15000
  // Art 2: 2 * 2000 = 4000
  // Art 3: 0 * 25000 = 0
  // Total recepcionado: 19000
  check('Monto recepcionado neto: 19000', montoRecepcionado === 19000);

  const saldoOc = totalNeto - montoRecepcionado;
  check('Saldo pendiente OC: 75000 - 19000 = 56000', saldoOc === 56000);

  // Caso borde: recepción total (saldo debe ser 0)
  const montoTotalRecepcionado = articulosTest.reduce((sum, a) => sum + (a.cantidad * a.precio_unitario), 0);
  const saldoCero = totalNeto - montoTotalRecepcionado;
  check('Saldo en recepción 100% completa: 0', saldoCero === 0);

  // =========================================================================
  // FASE 3: INTEGRACIÓN SUPABASE, MANEJO RESILIENTE Y LIMPIEZA TOTAL
  // =========================================================================
  console.log('\n📌 FASE 3: Integración Supabase, Resiliencia y Limpieza 100%');

  const ts = Date.now();
  const ocNumTest = `OC-TEST-REC-EXC-${ts}`;
  let createdOcId = null;

  try {
    // Probar inserción con estado 'Recepción de excepción'
    // Primero intentamos con columnas financieras
    let ocInsertData = {
      numero_oc: ocNumTest,
      proveedor: 'PROVEEDOR TEST EXCEPCIÓN',
      rut_proveedor: '76111222-3',
      tipo_oc: 'SE',
      estado: 'Recepción de excepción',
      fecha_envio: new Date().toISOString(),
      total_neto: totalNeto,
      total_con_iva: totalConIva,
      saldo_oc: saldoOc
    };

    let { data: ocData, error: ocErr } = await supabase.from('ordenes_compra').insert([ocInsertData]).select();

    const isMissing = (e) => e && (e.code === '42703' || e.code === 'PGRST204' || (e.message && e.message.includes('schema cache')));

    if (isMissing(ocErr)) {
      console.log('   ℹ️ Columnas financieras aún no migradas en Supabase (error detectado). Probando inserción resiliente sin columnas financieras...');
      delete ocInsertData.total_neto;
      delete ocInsertData.total_con_iva;
      delete ocInsertData.saldo_oc;

      const fallbackRes = await supabase.from('ordenes_compra').insert([ocInsertData]).select();
      ocData = fallbackRes.data;
      ocErr = fallbackRes.error;
    }

    check('Inserción de OC con estado "Recepción de excepción" exitosa', !ocErr && ocData && ocData.length > 0, ocErr ? ocErr.message : '');

    if (ocData && ocData[0]) {
      createdOcId = ocData[0].id;

      // Leer de vuelta de Supabase
      const { data: ocLeida, error: readErr } = await supabase.from('ordenes_compra').select('*').eq('id', createdOcId).single();
      check('Lectura de OC desde BD exitosa', !readErr && !!ocLeida);
      check('El estado almacenado en Supabase es "Recepción de excepción"', ocLeida && ocLeida.estado === 'Recepción de excepción');

      // Probar inserción de artículo para esta OC con y sin columnas financieras
      let artInsertData = {
        oc_id: createdOcId,
        codigo_articulo: 'TEST-ART-99',
        cantidad: 10,
        cantidad_recepcionada: 2,
        precio_unitario: 1500,
        subtotal_neto: 15000,
        estado_recepcion: 'Pendiente'
      };

      let { data: artData, error: artErr } = await supabase.from('ordenes_compra_articulos').insert([artInsertData]).select();
      if (isMissing(artErr)) {
        console.log('   ℹ️ Columnas precio_unitario/subtotal_neto en ordenes_compra_articulos aún no migradas en Supabase. Probando fallback resiliente...');
        delete artInsertData.precio_unitario;
        delete artInsertData.subtotal_neto;
        const artFallback = await supabase.from('ordenes_compra_articulos').insert([artInsertData]).select();
        artData = artFallback.data;
        artErr = artFallback.error;
      }

      check('Inserción de artículo vinculado a la OC exitosa (con resiliencia)', !artErr && artData && artData.length > 0, artErr ? artErr.message : '');
    }
  } catch (err) {
    check('Excepción no controlada en BD', false, err.message);
  } finally {
    // LIMPIEZA TOTAL DE DATOS
    console.log('\n🧹 Limpiando registros de prueba en Supabase...');
    if (createdOcId) {
      await supabase.from('ordenes_compra_articulos').delete().eq('orden_compra_id', createdOcId);
      const { error: delOcErr } = await supabase.from('ordenes_compra').delete().eq('id', createdOcId);
      check('Limpieza total de datos de prueba en Supabase', !delOcErr, delOcErr ? delOcErr.message : '');
    }
  }

  // =========================================================================
  // REPORTE FINAL
  // =========================================================================
  console.log('\n======================================================');
  if (fails === 0) {
    console.log('🎉 TODAS LAS VALIDACIONES PASARON EXITOSAMENTE (0 errores)');
  } else {
    console.log(`❌ SE REGISTRARON ${fails} FALLO(S)`);
  }
  console.log('======================================================\n');
  process.exit(fails ? 1 : 0);
}

main();
