const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno de .env
const env = {};
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k) env[k] = v.join('=').trim();
  });
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

let fails = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name} ${extra}`);
  if (!cond) fails++;
};

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 SUITE DE PRUEBAS E2E: NUEVOS ESTADOS DE ORDEN DE COMPRA');
  console.log('   - Cerrada con saldo pendiente');
  console.log('   - Saldo liberado');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // FASE 1: EVALUACIÓN DE PLAZOS Y REGLAS DE NEGOCIO (plazosHelper)
  // -------------------------------------------------------------
  console.log('📌 FASE 1: Evaluación de plazos y colores en plazosHelper');
  
  // Importar dinámicamente el helper ESM
  const { evaluarPlazos, ESTADOS_FINALES } = await import('../utils/plazosHelper.js');

  check('ESTADOS_FINALES incluye "Cerrada con saldo pendiente"', 
    ESTADOS_FINALES.includes('Cerrada con saldo pendiente')
  );
  check('ESTADOS_FINALES incluye "Saldo liberado"', 
    ESTADOS_FINALES.includes('Saldo liberado')
  );

  const ocSaldoPendienteVencida = {
    estado: 'Cerrada con saldo pendiente',
    fecha_envio: '2020-01-01',
    fecha_tope_aceptacion: '2020-01-05',
    fecha_tope_entrega: '2020-01-10',
    fecha_tope_multa: '2020-01-20'
  };

  const evalPendiente = evaluarPlazos(ocSaldoPendienteVencida, '2026-10-22');
  check('Cerrada con saldo pendiente: nivel es "final"', evalPendiente.nivel === 'final');
  check('Cerrada con saldo pendiente: color es rojo (#ef4444)', evalPendiente.color === '#ef4444', `(${evalPendiente.color})`);
  check('Cerrada con saldo pendiente: NO dispara isExpired', evalPendiente.isExpired === false);
  check('Cerrada con saldo pendiente: NO dispara isYellow', evalPendiente.isYellow === false);
  check('Cerrada con saldo pendiente: NO dispara isOrange', evalPendiente.isOrange === false);
  check('Cerrada con saldo pendiente: NO dispara isRosa', evalPendiente.isRosa === false);
  check('Cerrada con saldo pendiente: NO dispara isPurpura', evalPendiente.isPurpura === false);

  const ocSaldoLiberado = {
    estado: 'Saldo liberado',
    fecha_envio: '2020-01-01',
    fecha_tope_aceptacion: '2020-01-05',
    fecha_tope_entrega: '2020-01-10'
  };

  const evalLiberado = evaluarPlazos(ocSaldoLiberado, '2026-10-22');
  check('Saldo liberado: nivel es "final"', evalLiberado.nivel === 'final');
  check('Saldo liberado: color es verde (#10b981)', evalLiberado.color === '#10b981', `(${evalLiberado.color})`);
  check('Saldo liberado: NO dispara isExpired', evalLiberado.isExpired === false);
  check('Saldo liberado: NO dispara isYellow', evalLiberado.isYellow === false);
  check('Saldo liberado: NO dispara isOrange', evalLiberado.isOrange === false);

  // -------------------------------------------------------------
  // FASE 2: FILTROS DE ALERTAS Y EXCLUSIÓN TOTAL
  // -------------------------------------------------------------
  console.log('\n📌 FASE 2: Verificación de exclusión en pestaña Alertas y contadores');

  const isFinalOrClosed = (estado) => (
    estado === 'Cancelado' ||
    estado === 'Cancelada' ||
    estado === 'Recepción Conforme' ||
    estado === 'Recepción Con Multa' ||
    estado === 'Recepción de excepción' ||
    estado === 'Cerrada con saldo pendiente' ||
    estado === 'Saldo liberado'
  );

  check('isFinalOrClosed("Cerrada con saldo pendiente") es true', isFinalOrClosed('Cerrada con saldo pendiente') === true);
  check('isFinalOrClosed("Saldo liberado") es true', isFinalOrClosed('Saldo liberado') === true);

  const testListOcs = [
    { ...ocSaldoPendienteVencida, id: 1, numero_oc: 'OC-1', estado: 'Enviada' }, // esta está vencida
    { ...ocSaldoPendienteVencida, id: 2, numero_oc: 'OC-2', estado: 'Cerrada con saldo pendiente' },
    { ...ocSaldoLiberado, id: 3, numero_oc: 'OC-3', estado: 'Saldo liberado' }
  ];

  const redCount = testListOcs.filter(oc => {
    const p = evaluarPlazos(oc, '2026-10-22');
    return !isFinalOrClosed(oc.estado) && p.isExpired;
  }).length;

  check('Solo OC-1 entra al contador de alertas rojas (excluye Cerrada con saldo y Saldo liberado)', redCount === 1, `(Conteo: ${redCount})`);

  // -------------------------------------------------------------
  // FASE 3: COMPORTAMIENTO EN SUB-PESTAÑA VALORIZADOS
  // -------------------------------------------------------------
  console.log('\n📌 FASE 3: Comportamiento en pestaña Valorizados');

  const filterValorizados = (ocList) => {
    return ocList.filter(oc => {
      if (oc.estado === 'Cancelado' || oc.estado === 'Cancelada' || oc.estado === 'Saldo liberado') return false;
      const arts = oc.ordenes_compra_articulos || [];
      if (arts.length === 0) return false;
      const totalSol = arts.reduce((sum, a) => sum + (Number(a.cantidad) || 0), 0);
      const totalRec = arts.reduce((sum, a) => sum + (Number(a.cantidad_recepcionada) || 0), 0);

      // Regla: "Cerrada con saldo pendiente" visible si falta saldo (incluso con 0 recepcionadas)
      if (oc.estado === 'Cerrada con saldo pendiente') {
        return totalRec < totalSol;
      }
      return totalRec > 0 && totalRec < totalSol;
    });
  };

  const ocsParaValorizados = [
    {
      numero_oc: 'OC-VAL-1',
      estado: 'Cerrada con saldo pendiente',
      ordenes_compra_articulos: [{ cantidad: 10, cantidad_recepcionada: 4 }] // recepción parcial
    },
    {
      numero_oc: 'OC-VAL-2',
      estado: 'Cerrada con saldo pendiente',
      ordenes_compra_articulos: [{ cantidad: 5, cantidad_recepcionada: 0 }] // 0 recepción pero saldo por liberar
    },
    {
      numero_oc: 'OC-VAL-3',
      estado: 'Saldo liberado',
      ordenes_compra_articulos: [{ cantidad: 10, cantidad_recepcionada: 4 }] // ya liberado, NO debe aparecer
    },
    {
      numero_oc: 'OC-VAL-4',
      estado: 'Cancelado',
      ordenes_compra_articulos: [{ cantidad: 10, cantidad_recepcionada: 0 }] // Cancelado, NO debe aparecer
    },
    {
      numero_oc: 'OC-VAL-5',
      estado: 'Enviada',
      ordenes_compra_articulos: [{ cantidad: 10, cantidad_recepcionada: 5 }] // Estándar parcial, SÍ debe aparecer
    }
  ];

  const resValorizados = filterValorizados(ocsParaValorizados);
  const numOcsVal = resValorizados.map(o => o.numero_oc);

  check('Cerrada con saldo pendiente con recepción parcial aparece en Valorizados', numOcsVal.includes('OC-VAL-1'));
  check('Cerrada con saldo pendiente con 0 recepción aparece en Valorizados', numOcsVal.includes('OC-VAL-2'));
  check('Saldo liberado NO aparece en Valorizados', !numOcsVal.includes('OC-VAL-3'));
  check('Cancelado NO aparece en Valorizados', !numOcsVal.includes('OC-VAL-4'));
  check('Orden regular con recepción parcial sí aparece', numOcsVal.includes('OC-VAL-5'));

  // -------------------------------------------------------------
  // FASE 4: INTEGRACIÓN SUPABASE (CRUD Y LIMPIEZA 100%)
  // -------------------------------------------------------------
  console.log('\n📌 FASE 4: Persistencia y ciclo de vida en Supabase');
  const TEST_NUM_OC = 'TEST-ESTADOS-' + Date.now();
  let createdOcId = null;

  try {
    // 1. Inserción con estado "Cerrada con saldo pendiente"
    const { data: ocCreated, error: createErr } = await supabase
      .from('ordenes_compra')
      .insert([{
        numero_oc: TEST_NUM_OC,
        proveedor: 'PROVEEDOR TEST NUEVOS ESTADOS',
        rut_proveedor: '99.888.777-6',
        tipo_oc: 'AG',
        estado: 'Cerrada con saldo pendiente',
        subtotal_articulos: 100000,
        total_neto: 100000,
        total_con_iva: 119000,
        saldo_oc: 50000,
        fecha_envio: new Date().toISOString()
      }])
      .select()
      .single();

    check('Inserción de OC con estado "Cerrada con saldo pendiente"', !createErr && !!ocCreated, createErr?.message || '');
    if (ocCreated) {
      createdOcId = ocCreated.id;

      // 2. Insertar artículo
      const { data: artCreated, error: artErr } = await supabase
        .from('ordenes_compra_articulos')
        .insert([{
          oc_id: createdOcId,
          codigo_articulo: 'TEST-ART-99',
          cantidad: 10,
          cantidad_recepcionada: 5,
          precio_unitario: 10000,
          subtotal_neto: 100000
        }])
        .select()
        .single();

      check('Inserción de artículo asociado a la OC de prueba', !artErr && !!artCreated, artErr?.message || '');

      // 3. Consultar y verificar estado
      const { data: ocFetched, error: fetchErr } = await supabase
        .from('ordenes_compra')
        .select('id, numero_oc, estado, saldo_oc')
        .eq('id', createdOcId)
        .single();

      check('Verificación de lectura: estado es "Cerrada con saldo pendiente"', 
        ocFetched?.estado === 'Cerrada con saldo pendiente'
      );

      // 4. Transición de estado a "Saldo liberado"
      const { data: ocUpdated, error: updateErr } = await supabase
        .from('ordenes_compra')
        .update({ estado: 'Saldo liberado', saldo_oc: 0 })
        .eq('id', createdOcId)
        .select()
        .single();

      check('Actualización de OC a "Saldo liberado"', 
        !updateErr && ocUpdated?.estado === 'Saldo liberado', 
        updateErr?.message || ''
      );
      check('Saldo_oc actualizado a 0', ocUpdated?.saldo_oc === 0);
    }
  } finally {
    // -------------------------------------------------------------
    // FASE 5: LIMPIEZA 100% GARANTIZADA DE DATOS DE PRUEBA
    // -------------------------------------------------------------
    console.log('\n📌 FASE 5: Limpieza total de base de datos');
    if (createdOcId) {
      const { error: delArtErr } = await supabase
        .from('ordenes_compra_articulos')
        .delete()
        .eq('oc_id', createdOcId);
      check('Eliminación de artículos temporales de prueba', !delArtErr, delArtErr?.message || '');

      const { error: delOcErr } = await supabase
        .from('ordenes_compra')
        .delete()
        .eq('id', createdOcId);
      check('Eliminación de OC temporal de prueba', !delOcErr, delOcErr?.message || '');

      // Verificación de que no quedó registro huérfano
      const { data: checkDeleted } = await supabase
        .from('ordenes_compra')
        .select('id')
        .eq('id', createdOcId);
      check('Confirmación: Base de datos 100% limpia sin registros residuales', (checkDeleted || []).length === 0);
    }
  }

  console.log('\n================================================================');
  if (fails === 0) {
    console.log('🎉 RESULTADO FINAL: TODAS LAS PRUEBAS PASARON EXITOSAMENTE (0 fallos)');
  } else {
    console.log(`❌ RESULTADO FINAL: ${fails} PRUEBA(S) FALLARON`);
  }
  console.log('================================================================\n');

  process.exit(fails ? 1 : 0);
}

runTestSuite().catch(err => {
  console.error('Error fatal durante la ejecución de pruebas:', err);
  process.exit(1);
});
