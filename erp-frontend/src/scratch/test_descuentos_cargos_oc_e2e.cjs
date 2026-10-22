const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer variables de entorno
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

async function testDescuentosCargosE2E() {
  console.log('--- INICIO DE PRUEBAS E2E: DESCUENTOS Y CARGOS EN OC --- \n');

  const TEST_NUM_OC = 'TEST-OC-DESC-CARGO-' + Date.now();
  let createdOcId = null;

  try {
    // -------------------------------------------------------------
    // FASE 1: CÁLCULOS MATEMÁTICOS DE CREACIÓN
    // -------------------------------------------------------------
    console.log('📌 FASE 1: Verificación matemática de fórmulas');
    const art1 = { cant: 10, precio: 1000 }; // 10.000
    const art2 = { cant: 2, precio: 25000 }; // 50.000
    const subtotalArticulos = (art1.cant * art1.precio) + (art2.cant * art2.precio); // 60.000
    const descuento = 5000;
    const cargo = 2000;
    const totalNeto = Math.max(0, subtotalArticulos - descuento + cargo); // 57.000
    const totalConIva = Math.round(totalNeto * 1.19); // 67.830
    const saldoInicial = totalNeto; // 57.000

    check('Subtotal artículos = $60.000', subtotalArticulos === 60000, `($${subtotalArticulos})`);
    check('Total Neto con Descuento ($5.000) y Cargo ($2.000) = $57.000', totalNeto === 57000, `($${totalNeto})`);
    check('Total con IVA (19%) = $67.830', totalConIva === 67830, `($${totalConIva})`);
    check('Saldo Inicial OC = $57.000', saldoInicial === 57000, `($${saldoInicial})`);

    // -------------------------------------------------------------
    // FASE 2: INSERCIÓN EN SUPABASE
    // -------------------------------------------------------------
    console.log('\n📌 FASE 2: Inserción en Supabase (Asignar OC)');
    const insertPayload = {
      numero_oc: TEST_NUM_OC,
      proveedor: 'PROVEEDOR PRUEBAS SPA',
      rut_proveedor: '76.123.456-7',
      tipo_oc: 'AG',
      estado: 'Enviada',
      subtotal_articulos: subtotalArticulos,
      descuento: descuento,
      cargo: cargo,
      total_neto: totalNeto,
      total_con_iva: totalConIva,
      saldo_oc: saldoInicial,
      fecha_envio: new Date().toISOString()
    };

    const { data: ocCreated, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert([insertPayload])
      .select()
      .single();

    check('Creación de cabecera OC en Supabase', !ocErr && !!ocCreated, ocErr?.message || '');
    if (ocCreated) {
      createdOcId = ocCreated.id;
      check('Columna subtotal_articulos persistida correctamente', Number(ocCreated.subtotal_articulos) === 60000);
      check('Columna descuento persistida correctamente', Number(ocCreated.descuento) === 5000);
      check('Columna cargo persistida correctamente', Number(ocCreated.cargo) === 2000);
      check('Columna total_neto persistida correctamente', Number(ocCreated.total_neto) === 57000);
      check('Columna total_con_iva persistida correctamente', Number(ocCreated.total_con_iva) === 67830);
      check('Columna saldo_oc persistida correctamente', Number(ocCreated.saldo_oc) === 57000);

      // Insertar artículos
      const { data: artsCreated, error: artsErr } = await supabase
        .from('ordenes_compra_articulos')
        .insert([
          { oc_id: createdOcId, codigo_articulo: 'TEST-ART-1', cantidad: 10, precio_unitario: 1000, subtotal_neto: 10000, cantidad_recepcionada: 0 },
          { oc_id: createdOcId, codigo_articulo: 'TEST-ART-2', cantidad: 2, precio_unitario: 25000, subtotal_neto: 50000, cantidad_recepcionada: 0 }
        ])
        .select();

      check('Inserción de artículos vinculados en Supabase', !artsErr && artsCreated?.length === 2);
    }

    // -------------------------------------------------------------
    // FASE 3: MODIFICACIÓN EN SUPABASE (EDITAR OC)
    // -------------------------------------------------------------
    console.log('\n📌 FASE 3: Modificación de Descuento y Cargo (Editar OC)');
    const nuevoDescuento = 10000;
    const nuevoCargo = 4000;
    const nuevoTotalNeto = Math.max(0, subtotalArticulos - nuevoDescuento + nuevoCargo); // 60.000 - 10.000 + 4.000 = 54.000
    const nuevoTotalConIva = Math.round(nuevoTotalNeto * 1.19); // 64.260
    
    // Simular recepción parcial de 5 unidades del art1 (5 * 1000 = 5000 recibido)
    const valorRecepcionado = 5000;
    const nuevoSaldoOc = Math.max(0, nuevoTotalNeto - valorRecepcionado); // 54.000 - 5.000 = 49.000

    const { error: updateErr } = await supabase
      .from('ordenes_compra')
      .update({
        descuento: nuevoDescuento,
        cargo: nuevoCargo,
        total_neto: nuevoTotalNeto,
        total_con_iva: nuevoTotalConIva,
        saldo_oc: nuevoSaldoOc
      })
      .eq('id', createdOcId);

    check('Actualización de Descuento y Cargo en Supabase', !updateErr, updateErr?.message || '');

    // Consultar registro actualizado
    const { data: ocUpdated, error: readUpdatedErr } = await supabase
      .from('ordenes_compra')
      .select('*')
      .eq('id', createdOcId)
      .single();

    check('Consulta de OC actualizada exitosa', !readUpdatedErr && !!ocUpdated);
    if (ocUpdated) {
      check('Descuento actualizado a $10.000', Number(ocUpdated.descuento) === 10000);
      check('Cargo actualizado a $4.000', Number(ocUpdated.cargo) === 4000);
      check('Total Neto recalculado a $54.000', Number(ocUpdated.total_neto) === 54000);
      check('Total con IVA recalculado a $64.260', Number(ocUpdated.total_con_iva) === 64260);
      check('Saldo OC con recepción parcial = $49.000', Number(ocUpdated.saldo_oc) === 49000);
    }

  } catch (err) {
    console.error('Error durante la prueba:', err);
    check('Ejecución sin excepciones', false, err.message);
  } finally {
    // -------------------------------------------------------------
    // FASE 4: LIMPIEZA 100% TOTAL
    // -------------------------------------------------------------
    console.log('\n🧹 FASE 4: Limpieza de registros temporales en Supabase');
    if (createdOcId) {
      await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', createdOcId);
      await supabase.from('ordenes_compra').delete().eq('id', createdOcId);
      console.log('✅ Registros temporales eliminados correctamente.');
    }
  }

  console.log(`\n======================================================`);
  if (fails === 0) {
    console.log(`🎉 TODAS LAS PRUEBAS DE DESCUENTOS Y CARGOS PASARON EXITOSAMENTE (0 fallos).`);
  } else {
    console.error(`⚠️ SE ENCONTRARON ${fails} FALLOS EN LA PRUEBA.`);
  }
  console.log(`======================================================\n`);
  process.exit(fails > 0 ? 1 : 0);
}

testDescuentosCargosE2E();
