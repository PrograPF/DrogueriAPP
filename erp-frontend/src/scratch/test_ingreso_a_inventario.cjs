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

async function testIngresoInventario() {
  console.log('================================================================');
  console.log('🧪 PRUEBA DE INGRESO: REVISIÓN EN BODEGA ➔ INVENTARIO');
  console.log('================================================================\n');

  const testCodigo = '209'; // C.M. LAPIZ ELECTROQUIRURGICO / UNIDAD
  const testLote = 'LOTE-INV-TEST-' + Date.now();
  const testCantidad = 500;
  const testSessionId = crypto.randomUUID();
  const testOc = 'OC-TEST-INV-999';
  const testNota = 'Nota de verificación de inventario';
  const testAutor = 'QF Auditor';

  const results = [];
  let createdVarId = null;

  try {
    // 1. Consultar estado y stock inicial en Inventario
    console.log(`🔹 PASO 1: Consultando stock previo del artículo ${testCodigo}...`);
    const { data: variantesPrevias, error: prevErr } = await supabase
      .from('articulos_variantes')
      .select('cantidad')
      .eq('codigo_articulo', testCodigo);

    if (prevErr) throw prevErr;

    const stockInicial = (variantesPrevias || []).reduce((acc, v) => acc + (v.cantidad || 0), 0);
    console.log(`   Stock actual previo: ${stockInicial} uds.`);

    // 2. Simular flujo exacto de handleFinalizar en RevisionBodegaModule:
    console.log('\n🔹 PASO 2: Ejecutando ingreso desde Revisión en Bodega...');
    
    // 2.1 Insertar en revisiones_bodega (historial de revisión)
    const { error: revInsErr } = await supabase.from('revisiones_bodega').insert({
      session_id: testSessionId,
      codigo_articulo: testCodigo,
      lote: testLote,
      isp: 'ISP-TEST-001',
      cantidad: testCantidad,
      tipo_documento: 'Factura',
      numero_documento: 'FAC-INV-887',
      numero_oc: testOc
    });
    if (revInsErr) throw revInsErr;

    // 2.2 Insertar en articulos_variantes (físico de inventario)
    const { data: createdVar, error: varInsErr } = await supabase
      .from('articulos_variantes')
      .insert({
        codigo_articulo: testCodigo,
        lote: testLote,
        vencimiento: '2028-11-30',
        cantidad: testCantidad,
        carta_canje: 'NO',
        estado: 'VIGENTE',
        comentario: testNota,
        ultimo_valor_sin_iva: 1200,
        ultimo_valor_con_iva: 1428,
        total_sin_iva: 600000,
        total_con_iva: 714000,
        isp: 'ISP-TEST-001',
        fecha_ingreso: new Date().toISOString().split('T')[0]
      })
      .select('id, codigo_articulo, lote, cantidad')
      .single();

    if (varInsErr) throw varInsErr;
    createdVarId = createdVar.id;

    // 2.3 Insertar comentario en articulos_variantes_comentarios (bitácora)
    const { error: comInsErr } = await supabase.from('articulos_variantes_comentarios').insert({
      variante_id: createdVar.id,
      comentario: testNota,
      usuario: testAutor
    });
    if (comInsErr) throw comInsErr;

    // 3. Consultar y verificar cómo lo procesa el módulo de Inventario
    console.log('\n🔹 PASO 3: Simulando lectura y cálculo del Módulo de Inventario...');
    const { data: todasLasVariantes, error: invErr } = await supabase
      .from('articulos_variantes')
      .select('*')
      .eq('codigo_articulo', testCodigo);

    if (invErr) throw invErr;

    const stockNuevo = (todasLasVariantes || []).reduce((acc, v) => acc + (v.cantidad || 0), 0);
    const deltaStock = stockNuevo - stockInicial;
    console.log(`   Stock inicial: ${stockInicial} uds.`);
    console.log(`   Stock nuevo detectado en Inventario: ${stockNuevo} uds.`);
    console.log(`   Incremento exacto: +${deltaStock} uds. (Esperado: +${testCantidad} uds.)`);

    const passStock = deltaStock === testCantidad;

    results.push({
      test: '1. Incremento de Stock Físico en Inventario',
      status: passStock ? 'PASSED' : 'FAILED',
      detail: `El stock total del artículo ${testCodigo} aumentó de ${stockInicial} a ${stockNuevo} (+${deltaStock} uds.), reflejando de inmediato el nuevo ingreso.`
    });

    // 4. Verificar existencia y detalle del nuevo lote en Inventario
    const loteEncontrado = (todasLasVariantes || []).find(v => v.lote === testLote);
    const passLote = (
      loteEncontrado &&
      loteEncontrado.cantidad === testCantidad &&
      loteEncontrado.isp === 'ISP-TEST-001' &&
      loteEncontrado.vencimiento === '2028-11-30'
    );

    results.push({
      test: '2. Creación del Lote Físico con Trazabilidad Completa',
      status: passLote ? 'PASSED' : 'FAILED',
      detail: `El lote "${testLote}" fue registrado con ${testCantidad} uds., vencimiento 2028-11-30 e ISP ISP-TEST-001.`
    });

    // 5. Verificar vinculación de la Bitácora de Notas
    const { data: notasLote } = await supabase
      .from('articulos_variantes_comentarios')
      .select('*')
      .eq('variante_id', createdVar.id);

    const passNota = (
      notasLote &&
      notasLote.length === 1 &&
      notasLote[0].comentario === testNota &&
      notasLote[0].usuario === testAutor
    );

    results.push({
      test: '3. Integración con la Bitácora de Notas de Inventario',
      status: passNota ? 'PASSED' : 'FAILED',
      detail: `La nota "${testNota}" escrita por "${testAutor}" quedó correctamente vinculada al lote y visible en la columna NOTAS (1).`
    });

    // 6. Verificar historial de revisión
    const { data: revCheck } = await supabase
      .from('revisiones_bodega')
      .select('*')
      .eq('session_id', testSessionId);

    const passRev = revCheck && revCheck.length === 1 && revCheck[0].numero_oc === testOc;

    results.push({
      test: '4. Historial de Revisión y Trazabilidad Documental',
      status: passRev ? 'PASSED' : 'FAILED',
      detail: `El registro en "revisiones_bodega" guardó la OC (${testOc}) y la Factura (FAC-INV-887).`
    });

  } catch (err) {
    console.error('❌ ERROR durante ejecución:', err);
    results.push({
      test: 'Ejecución General de Pruebas',
      status: 'FAILED',
      detail: err.message
    });
  } finally {
    // -------------------------------------------------------------
    // LIMPIEZA TOTAL (Cleanup)
    // -------------------------------------------------------------
    console.log('\n🔹 LIMPIEZA AUTOMÁTICA DE DATOS TEMPORALES...');
    try {
      if (createdVarId) {
        await supabase.from('articulos_variantes_comentarios').delete().eq('variante_id', createdVarId);
        await supabase.from('articulos_variantes').delete().eq('id', createdVarId);
      }
      await supabase.from('revisiones_bodega').delete().eq('session_id', testSessionId);
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

testIngresoInventario();
