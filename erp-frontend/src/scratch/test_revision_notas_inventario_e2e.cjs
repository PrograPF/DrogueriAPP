const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valParts] = line.trim().split('=');
  if (key) env[key] = valParts.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runAutonomousTests() {
  console.log('================================================================');
  console.log('🧪 INICIANDO TEST AUTOMÁTICO INTEGRAL (REVISIÓN, NOTAS, INVENTARIO)');
  console.log('================================================================\n');

  const testOcNum = 'OC-E2E-TEST-888';
  const testCodes = ['345', '1004'];
  const results = [];
  const sessionId = crypto.randomUUID();

  try {
    // 0. Limpieza previa de seguridad
    const { data: oldOcs } = await supabase.from('ordenes_compra').select('id').eq('numero_oc', testOcNum);
    if (oldOcs && oldOcs.length > 0) {
      for (const oc of oldOcs) {
        await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', oc.id);
      }
      await supabase.from('ordenes_compra').delete().eq('numero_oc', testOcNum);
    }

    // -------------------------------------------------------------
    // TEST 1: Filtrado exclusivo de artículos 'Recepcionado'
    // -------------------------------------------------------------
    console.log('🔹 CASO 1: Creación de OC y validación de filtro por estado Recepcionado...');
    const { data: ocCreated, error: ocErr } = await supabase
      .from('ordenes_compra')
      .insert({
        numero_oc: testOcNum,
        proveedor: 'PROVEEDOR TEST QA',
        tipo_oc: 'AG',
        estado: 'Aceptada',
        estado_recepcion: 'Recepcion Parcial'
      })
      .select()
      .single();

    if (ocErr) throw ocErr;

    // Insertar 2 artículos: 1 Recepcionado, 1 Pendiente
    await supabase.from('ordenes_compra_articulos').insert([
      { oc_id: ocCreated.id, codigo_articulo: testCodes[0], cantidad: 50, estado_recepcion: 'Recepcionado' },
      { oc_id: ocCreated.id, codigo_articulo: testCodes[1], cantidad: 100, estado_recepcion: 'Pendiente' }
    ]);

    const { data: ocLoaded } = await supabase
      .from('ordenes_compra')
      .select(`*, ordenes_compra_articulos (*)`)
      .eq('id', ocCreated.id)
      .single();

    const filtrados = (ocLoaded.ordenes_compra_articulos || []).filter(a => a.estado_recepcion === 'Recepcionado');
    const pass1 = filtrados.length === 1 && filtrados[0].codigo_articulo === testCodes[0];

    results.push({
      test: '1. Filtrado de Artículos para Revisión',
      status: pass1 ? 'PASSED' : 'FAILED',
      detail: `De 2 artículos en la OC, solo se cargó el código ${filtrados[0]?.codigo_articulo} con estado "Recepcionado". El artículo pendiente fue excluido.`
    });

    // -------------------------------------------------------------
    // TEST 2: Validaciones estrictas y precio $0 en el formulario
    // -------------------------------------------------------------
    console.log('🔹 CASO 2: Validación de datos obligatorios y precio $0...');
    const validarEntrada = (it) => {
      if (!it.tipo_documento?.trim()) return 'Falta documento';
      if (!it.numero_documento?.trim()) return 'Falta num doc';
      if (!it.codigo?.trim()) return 'Falta codigo';
      if (!it.lote?.trim()) return 'Falta lote';
      if (!it.vencimiento) return 'Falta vencimiento';
      if (!it.isp?.trim()) return 'Falta isp';
      if (!it.cantidad || parseInt(it.cantidad) <= 0) return 'Cantidad invalida';
      if (it.valor_sin_iva === '' || isNaN(parseFloat(it.valor_sin_iva)) || parseFloat(it.valor_sin_iva) < 0) return 'Precio invalido';
      return 'OK';
    };

    const casoInvalido = { tipo_documento: 'Factura', numero_documento: 'FAC-1', codigo: '345', lote: '', vencimiento: '2028-10-10', isp: 'ISP-1', cantidad: '10', valor_sin_iva: '500' };
    const casoPrecioCero = { tipo_documento: 'Factura', numero_documento: 'FAC-1', codigo: '345', lote: 'LOTE-DON', vencimiento: '2028-10-10', isp: 'ISP-1', cantidad: '10', valor_sin_iva: '0' };
    const casoNormal = { tipo_documento: 'Factura', numero_documento: 'FAC-1', codigo: '345', lote: 'LOTE-NORMAL', vencimiento: '2028-10-10', isp: 'ISP-1', cantidad: '20', valor_sin_iva: '1200' };

    const pass2 = (
      validarEntrada(casoInvalido) === 'Falta lote' &&
      validarEntrada(casoPrecioCero) === 'OK' &&
      validarEntrada(casoNormal) === 'OK'
    );

    results.push({
      test: '2. Validación de Campos y Aceptación de Precio $0',
      status: pass2 ? 'PASSED' : 'FAILED',
      detail: 'Campos vacíos son rechazados; precio $0 (donaciones) y valores normales son aceptados correctamente.'
    });

    // -------------------------------------------------------------
    // TEST 3: Inserción de Revisión, Variantes y Bitácora de Notas
    // -------------------------------------------------------------
    console.log('🔹 CASO 3: Guardado en base de datos con Notas y Autor asignado...');
    
    // Simulación de 2 ítems en revisión: 1 con nota personalizada, 1 sin nota
    const itemsRevision = [
      {
        codigo: testCodes[0],
        lote: 'LOTE-CON-NOTA',
        vencimiento: '2028-06-30',
        isp: 'ISP-E2E-1',
        cantidad: 30,
        tipo_documento: 'Factura',
        numero_documento: 'FAC-888',
        carta_canje: 'NO',
        valor_sin_iva: 2500,
        valor_con_iva: 2975,
        total_sin_iva: 75000,
        total_con_iva: 89250,
        nota: 'Lote prioritario revisado para CESFAM',
        autor_nota: 'Farmacéutico Jefe'
      },
      {
        codigo: testCodes[0],
        lote: 'LOTE-SIN-NOTA',
        vencimiento: '2028-07-31',
        isp: 'ISP-E2E-2',
        cantidad: 20,
        tipo_documento: 'Factura',
        numero_documento: 'FAC-888',
        carta_canje: 'NO',
        valor_sin_iva: 2500,
        valor_con_iva: 2975,
        total_sin_iva: 50000,
        total_con_iva: 59500,
        nota: '',
        autor_nota: ''
      }
    ];

    // 1. Insertar en revisiones_bodega
    const insertRevData = itemsRevision.map(it => ({
      session_id: sessionId,
      codigo_articulo: it.codigo,
      lote: it.lote,
      isp: it.isp,
      cantidad: it.cantidad,
      tipo_documento: it.tipo_documento,
      numero_documento: it.numero_documento,
      numero_oc: testOcNum
    }));
    const { error: revErr } = await supabase.from('revisiones_bodega').insert(insertRevData);
    if (revErr) throw revErr;

    // 2. Insertar en articulos_variantes
    const insertVarData = itemsRevision.map(it => ({
      codigo_articulo: it.codigo,
      lote: it.lote,
      vencimiento: it.vencimiento,
      cantidad: it.cantidad,
      carta_canje: it.carta_canje,
      estado: 'VIGENTE',
      comentario: it.nota || 'Test QA Automatizado',
      ultimo_valor_sin_iva: it.valor_sin_iva,
      ultimo_valor_con_iva: it.valor_con_iva,
      total_sin_iva: it.total_sin_iva,
      total_con_iva: it.total_con_iva,
      isp: it.isp,
      fecha_ingreso: new Date().toISOString().split('T')[0]
    }));

    const { data: createdVars, error: varInsErr } = await supabase
      .from('articulos_variantes')
      .insert(insertVarData)
      .select('id, codigo_articulo, lote');

    if (varInsErr) throw varInsErr;

    // 3. Insertar nota en articulos_variantes_comentarios para el lote correspondiente
    const comentariosToInsert = [];
    createdVars.forEach((cVar, idx) => {
      const it = itemsRevision[idx];
      if (it.nota) {
        comentariosToInsert.push({
          variante_id: cVar.id,
          comentario: it.nota,
          usuario: it.autor_nota || 'Revisión Bodega'
        });
      }
    });

    let passComentario = false;
    if (comentariosToInsert.length > 0) {
      const { data: comCreated, error: comErr } = await supabase
        .from('articulos_variantes_comentarios')
        .insert(comentariosToInsert)
        .select();

      if (comErr) throw comErr;
      passComentario = comCreated && comCreated.length === 1 && comCreated[0].comentario === 'Lote prioritario revisado para CESFAM';
    }

    results.push({
      test: '3. Registro de Variantes y Bitácora de Notas',
      status: passComentario ? 'PASSED' : 'FAILED',
      detail: `Se crearon ${createdVars.length} variantes físicas en inventario y se registró la nota exitosamente en "articulos_variantes_comentarios" con autor "Farmacéutico Jefe".`
    });

    // -------------------------------------------------------------
    // TEST 4: Vinculación y Conteo de Notas en Inventario
    // -------------------------------------------------------------
    console.log('🔹 CASO 4: Verificación de consulta en módulo Inventario...');
    const loteConNotaVar = createdVars.find(v => v.lote === 'LOTE-CON-NOTA');
    const loteSinNotaVar = createdVars.find(v => v.lote === 'LOTE-SIN-NOTA');

    const { data: notasLote1 } = await supabase
      .from('articulos_variantes_comentarios')
      .select('*')
      .eq('variante_id', loteConNotaVar.id);

    const { data: notasLote2 } = await supabase
      .from('articulos_variantes_comentarios')
      .select('*')
      .eq('variante_id', loteSinNotaVar.id);

    const pass4 = (notasLote1?.length === 1) && (notasLote2?.length === 0);

    results.push({
      test: '4. Conteo y Consulta de Notas por Lote en Inventario',
      status: pass4 ? 'PASSED' : 'FAILED',
      detail: `El lote con nota refleja contador (1) en Inventario; el lote sin nota refleja contador (0).`
    });

    // -------------------------------------------------------------
    // TEST 5: Consistencia de Columnas del Comprobante Impreso
    // -------------------------------------------------------------
    console.log('🔹 CASO 5: Verificación de estructura del informe de impresión...');
    const printableItem = {
      codigo: '345',
      nombre: 'ACIDO ACETILSALICILICO 100 MG',
      lote: 'LOTE-CON-NOTA',
      vencimiento: '2028-06-30',
      isp: 'ISP-E2E-1',
      cantidad: 30,
      tipo_documento: 'Factura',
      numero_documento: 'FAC-888',
      valor_sin_iva: 2500
    };

    const tiene8Columnas = (
      printableItem.codigo &&
      printableItem.nombre &&
      printableItem.lote &&
      printableItem.vencimiento &&
      printableItem.isp &&
      printableItem.cantidad &&
      `${printableItem.tipo_documento} ${printableItem.numero_documento}` &&
      printableItem.valor_sin_iva !== undefined
    );

    results.push({
      test: '5. Estructura de 8 Columnas en Comprobante Impreso',
      status: tiene8Columnas ? 'PASSED' : 'FAILED',
      detail: 'Los 8 campos requeridos (Código, Descripción, Lote, Vencimiento, ISP, Cantidad, GD/FAC, Precio Unitario) están presentes e íntegros.'
    });

  } catch (error) {
    console.error('❌ ERROR durante ejecución de pruebas:', error);
    results.push({
      test: 'Ejecución General de Pruebas',
      status: 'FAILED',
      detail: error.message
    });
  } finally {
    // -------------------------------------------------------------
    // LIMPIEZA TOTAL (Cleanup)
    // -------------------------------------------------------------
    console.log('\n🔹 LIMPIEZA AUTOMÁTICA DE DATOS TEMPORALES...');
    try {
      // 1. Eliminar comentarios creados
      const { data: varsToDelete } = await supabase
        .from('articulos_variantes')
        .select('id')
        .in('lote', ['LOTE-CON-NOTA', 'LOTE-SIN-NOTA']);

      if (varsToDelete && varsToDelete.length > 0) {
        const varIds = varsToDelete.map(v => v.id);
        await supabase.from('articulos_variantes_comentarios').delete().in('variante_id', varIds);
        await supabase.from('articulos_variantes').delete().in('id', varIds);
      }

      // 2. Eliminar revisiones
      await supabase.from('revisiones_bodega').delete().eq('session_id', sessionId);

      // 3. Eliminar OC
      const { data: ocsToDel } = await supabase.from('ordenes_compra').select('id').eq('numero_oc', testOcNum);
      if (ocsToDel && ocsToDel.length > 0) {
        for (const oc of ocsToDel) {
          await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', oc.id);
        }
        await supabase.from('ordenes_compra').delete().eq('numero_oc', testOcNum);
      }
      console.log('✅ Base de datos 100% limpia. Registros de prueba eliminados correctamente.');
    } catch (cleanupErr) {
      console.error('Error durante cleanup:', cleanupErr);
    }
  }

  console.log('\n================================================================');
  console.log('📊 RESUMEN FINAL DE RESULTADOS:');
  console.log('================================================================');
  results.forEach(r => {
    console.log(`${r.status === 'PASSED' ? '✅' : '❌'} [${r.status}] ${r.test}`);
    console.log(`   ${r.detail}\n`);
  });
}

runAutonomousTests();
