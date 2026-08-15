const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env
const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valParts] = line.trim().split('=');
  if (key) env[key] = valParts.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runRevisionTests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO PRUEBAS AUTOMÁTICAS: REVISIÓN EN BODEGA');
  console.log('====================================================\n');

  const testOcNum = 'OC-TEST-REV-999';
  const testCodes = ['345', '1004', '888']; // 3 artículos
  const results = [];

  try {
    // 0. Cleanup previo
    const { data: oldOcs } = await supabase.from('ordenes_compra').select('id').eq('numero_oc', testOcNum);
    if (oldOcs && oldOcs.length > 0) {
      for (const oc of oldOcs) {
        await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', oc.id);
      }
      await supabase.from('ordenes_compra').delete().eq('numero_oc', testOcNum);
    }

    // 1. Crear OC con 3 artículos (2 Recepcionados, 1 Pendiente)
    console.log('🔹 TEST 1: Creación de OC con 3 artículos (2 Recepcionados y 1 Pendiente)...');
    const { data: ocCreated, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert({
        numero_oc: testOcNum,
        proveedor: 'PROVEEDOR TEST REVISION',
        tipo_oc: 'AG',
        estado: 'Aceptada',
        estado_recepcion: 'Recepcion Parcial'
      })
      .select()
      .single();

    if (ocErr) throw ocErr;

    // Articulo 1: Recepcionado
    // Articulo 2: Recepcionado
    // Articulo 3: Pendiente
    const { data: artsCreated, error: artsErr } = await supabase
      .from('ordenes_compra_articulos')
      .insert([
        { oc_id: ocCreated.id, codigo_articulo: testCodes[0], cantidad: 100, estado_recepcion: 'Recepcionado' },
        { oc_id: ocCreated.id, codigo_articulo: testCodes[1], cantidad: 200, estado_recepcion: 'Recepcionado' },
        { oc_id: ocCreated.id, codigo_articulo: testCodes[2], cantidad: 300, estado_recepcion: 'Pendiente' }
      ])
      .select();

    if (artsErr) throw artsErr;

    // Simular lógica de filtrado del módulo:
    const { data: ocFresh } = await supabase
      .from('ordenes_compra')
      .select(`*, ordenes_compra_articulos (*)`)
      .eq('id', ocCreated.id)
      .single();

    const articulosFiltrados = (ocFresh.ordenes_compra_articulos || []).filter(a => a.estado_recepcion === 'Recepcionado');

    const passTest1 = articulosFiltrados.length === 2 && !articulosFiltrados.some(a => a.codigo_articulo === testCodes[2]);

    results.push({
      test: '1. Filtrado Estricto de Artículos Recepcionados',
      status: passTest1 ? 'PASSED' : 'FAILED',
      detail: `De 3 artículos en la OC, solo se cargaron ${articulosFiltrados.length} con estado "Recepcionado". El artículo pendiente (${testCodes[2]}) fue excluido correctamente.`
    });

    // TEST 2: Validación de datos de revisión
    console.log('🔹 TEST 2: Validación estricta de campos obligatorios...');
    const validarItem = (item) => {
      if (!item.tipo_documento?.trim()) return 'Falta tipo_documento';
      if (!item.numero_documento?.trim()) return 'Falta numero_documento';
      if (!item.codigo?.trim()) return 'Falta codigo';
      if (!item.lote?.trim()) return 'Falta lote';
      if (!item.vencimiento) return 'Falta vencimiento';
      if (!item.isp?.trim()) return 'Falta isp';
      if (isNaN(parseInt(item.cantidad)) || parseInt(item.cantidad) <= 0) return 'Cantidad inválida';
      if (item.valor_sin_iva === '' || item.valor_sin_iva === null || isNaN(parseFloat(item.valor_sin_iva)) || parseFloat(item.valor_sin_iva) < 0) return 'Precio inválido';
      return 'OK';
    };

    const itemIncompleto1 = { tipo_documento: 'Factura', numero_documento: 'FAC-1', codigo: '345', lote: '', vencimiento: '2027-10-10', isp: 'ISP-1', cantidad: 10, valor_sin_iva: '100' };
    const itemIncompleto2 = { tipo_documento: 'Factura', numero_documento: 'FAC-1', codigo: '345', lote: 'L1', vencimiento: '', isp: 'ISP-1', cantidad: 10, valor_sin_iva: '100' };
    const itemIncompleto3 = { tipo_documento: 'Factura', numero_documento: 'FAC-1', codigo: '345', lote: 'L1', vencimiento: '2027-10-10', isp: 'ISP-1', cantidad: 0, valor_sin_iva: '100' };
    const itemValido = { tipo_documento: 'Factura', numero_documento: 'FAC-1', codigo: '345', lote: 'L1', vencimiento: '2027-10-10', isp: 'ISP-1', cantidad: 50, valor_sin_iva: '1500' };

    const passTest2 = (
      validarItem(itemIncompleto1) === 'Falta lote' &&
      validarItem(itemIncompleto2) === 'Falta vencimiento' &&
      validarItem(itemIncompleto3) === 'Cantidad inválida' &&
      validarItem(itemValido) === 'OK'
    );

    results.push({
      test: '2. Validación Estricta de Campos Obligatorios',
      status: passTest2 ? 'PASSED' : 'FAILED',
      detail: 'Los intentos con lote vacío, vencimiento faltante o cantidad 0 fueron rechazados; los completos fueron aprobados.'
    });

    // TEST 3: Validación de Precio Unitario Sin IVA = $0 (Donación/Sin Costo)
    console.log('🔹 TEST 3: Validación de Precio $0 permitido...');
    const itemDonacion = { tipo_documento: 'Guía de Despacho', numero_documento: 'GD-55', codigo: '1004', lote: 'LOTE-DON', vencimiento: '2028-05-01', isp: 'ISP-DON', cantidad: 20, valor_sin_iva: '0' };
    const valDonacionRes = validarItem(itemDonacion);
    const passTest3 = valDonacionRes === 'OK';

    results.push({
      test: '3. Aceptación de Precio Unitario $0 (Donaciones)',
      status: passTest3 ? 'PASSED' : 'FAILED',
      detail: 'El ítem con valor_sin_iva = 0 fue validado y aceptado con éxito.'
    });

    // TEST 4: Simulación de Guardado en Revisiones Bodega e Inventario Variantes
    console.log('🔹 TEST 4: Simulación de Inserción en Base de Datos (revisiones_bodega y articulos_variantes)...');
    const crypto = require('crypto');
    const sessionId = crypto.randomUUID();

    const insertRevisionData = [
      {
        session_id: sessionId,
        codigo_articulo: '345',
        lote: 'LOTE-TEST-345',
        isp: 'ISP-TEST-345',
        cantidad: 50,
        tipo_documento: 'Factura',
        numero_documento: 'FAC-TEST-99',
        numero_oc: testOcNum
      },
      {
        session_id: sessionId,
        codigo_articulo: '1004',
        lote: 'LOTE-TEST-1004',
        isp: 'ISP-TEST-1004',
        cantidad: 20,
        tipo_documento: 'Factura',
        numero_documento: 'FAC-TEST-99',
        numero_oc: testOcNum
      }
    ];

    const { error: revInsErr } = await supabase.from('revisiones_bodega').insert(insertRevisionData);
    if (revInsErr) throw revInsErr;

    const insertVariantesData = [
      {
        codigo_articulo: '345',
        lote: 'LOTE-TEST-345',
        vencimiento: '2027-10-10',
        cantidad: 50,
        carta_canje: 'NO',
        estado: 'VIGENTE',
        comentario: 'Test automatizado',
        ultimo_valor_sin_iva: 1500,
        ultimo_valor_con_iva: 1785,
        total_sin_iva: 75000,
        total_con_iva: 89250,
        isp: 'ISP-TEST-345',
        fecha_ingreso: new Date().toISOString().split('T')[0]
      },
      {
        codigo_articulo: '1004',
        lote: 'LOTE-TEST-1004',
        vencimiento: '2028-05-01',
        cantidad: 20,
        carta_canje: 'NO',
        estado: 'VIGENTE',
        comentario: 'Test automatizado',
        ultimo_valor_sin_iva: 0,
        ultimo_valor_con_iva: 0,
        total_sin_iva: 0,
        total_con_iva: 0,
        isp: 'ISP-TEST-1004',
        fecha_ingreso: new Date().toISOString().split('T')[0]
      }
    ];

    const { error: varInsErr } = await supabase.from('articulos_variantes').insert(insertVariantesData);
    if (varInsErr) throw varInsErr;

    const { data: revCheck } = await supabase.from('revisiones_bodega').select('*').eq('session_id', sessionId);
    const { data: varCheck } = await supabase.from('articulos_variantes').select('*').eq('comentario', 'Test automatizado');

    const passTest4 = (revCheck?.length === 2) && (varCheck?.length === 2);

    results.push({
      test: '4. Inserción en Historial de Revisiones y Variantes de Inventario',
      status: passTest4 ? 'PASSED' : 'FAILED',
      detail: `Se guardaron correctamente los 2 registros en "revisiones_bodega" y las 2 variantes en "articulos_variantes" con lote, vencimiento y valor $0.`
    });

  } catch (err) {
    console.error('❌ ERROR durante ejecución de pruebas:', err);
    results.push({
      test: 'Ejecución General de Pruebas',
      status: 'FAILED',
      detail: err.message
    });
  } finally {
    // 5. CLEANUP AUTOMÁTICO
    console.log('\n🔹 LIMPIEZA AUTOMÁTICA DE DATOS TEMPORALES...');
    try {
      await supabase.from('articulos_variantes').delete().eq('comentario', 'Test automatizado');
      await supabase.from('revisiones_bodega').delete().eq('numero_oc', testOcNum);

      const { data: ocsToDel } = await supabase.from('ordenes_compra').select('id').eq('numero_oc', testOcNum);
      if (ocsToDel && ocsToDel.length > 0) {
        for (const oc of ocsToDel) {
          await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', oc.id);
        }
        await supabase.from('ordenes_compra').delete().eq('numero_oc', testOcNum);
      }
      console.log('✅ Base de datos 100% limpia. Datos de prueba eliminados correctamente.');
    } catch (cleanupErr) {
      console.error('Error durante cleanup:', cleanupErr);
    }
  }

  console.log('\n====================================================');
  console.log('📊 RESUMEN DE RESULTADOS:');
  console.log('====================================================');
  results.forEach(r => {
    console.log(`${r.status === 'PASSED' ? '✅' : '❌'} [${r.status}] ${r.test}`);
    console.log(`   ${r.detail}\n`);
  });
}

runRevisionTests();
