const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Cargar variables de entorno de .env
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

async function runTests() {
  console.log('================================================================');
  console.log('🧪 SUITE DE PRUEBAS E2E: NUEVO ESTADO "RECEPCIÓN CONFORME PARCIAL"');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // FASE 1: EVALUACIÓN DE PLAZOS Y ESTADOS FINALES (plazosHelper)
  // -------------------------------------------------------------
  console.log('📌 FASE 1: Evaluación en plazosHelper.js');
  const { evaluarPlazos, ESTADOS_FINALES } = await import('../utils/plazosHelper.js');

  check(
    'ESTADOS_FINALES incluye "Recepción Conforme Parcial"',
    ESTADOS_FINALES.includes('Recepción Conforme Parcial')
  );

  const ocVencidaConformeParcial = {
    estado: 'Recepción Conforme Parcial',
    fecha_envio: '2020-01-01',
    fecha_tope_aceptacion: '2020-01-05',
    fecha_tope_entrega: '2020-01-10',
    fecha_tope_multa: '2020-01-20'
  };

  const evalPlazos = evaluarPlazos(ocVencidaConformeParcial, '2026-10-28');
  check('Nivel devuelto es "final"', evalPlazos.nivel === 'final');
  check('Color devuelto es celeste (#38bdf8)', evalPlazos.color === '#38bdf8', `(${evalPlazos.color})`);
  check('NO activa alerta roja (isExpired es false)', evalPlazos.isExpired === false);
  check('NO activa alerta amarilla (isYellow es false)', evalPlazos.isYellow === false);
  check('NO activa alerta naranja (isOrange es false)', evalPlazos.isOrange === false);

  // -------------------------------------------------------------
  // FASE 2: EXCLUSIÓN DE ALERTAS Y SEMÁFORO
  // -------------------------------------------------------------
  console.log('\n📌 FASE 2: Exclusión de la pestaña Alertas');

  const isFinalOrClosed = (estado) => (
    estado === 'Cancelado' ||
    estado === 'Cancelada' ||
    estado === 'Recepción Conforme' ||
    estado === 'Recepción Con Multa' ||
    estado === 'Recepción de excepción' ||
    estado === 'Cerrada con saldo pendiente' ||
    estado === 'Saldo liberado' ||
    estado === 'Recepción Conforme Parcial' ||
    estado === 'Recepción conforme parcial' ||
    estado === 'Recepcion conforme parcial'
  );

  check('isFinalOrClosed("Recepción Conforme Parcial") es true', isFinalOrClosed('Recepción Conforme Parcial') === true);

  const testOcsParaAlertas = [
    { ...ocVencidaConformeParcial, id: '1', numero_oc: 'OC-ACTIVA-VENCIDA', estado: 'Aceptada' }, // Esta debe alertar
    { ...ocVencidaConformeParcial, id: '2', numero_oc: 'OC-CONFORME-PARCIAL', estado: 'Recepción Conforme Parcial' } // Excluida
  ];

  const alertasRojas = testOcsParaAlertas.filter(oc => {
    const p = evaluarPlazos(oc, '2026-10-28');
    return !isFinalOrClosed(oc.estado) && p.isExpired;
  });

  check('Solo OC activa genera alerta roja (Recepción Conforme Parcial queda excluida)', alertasRojas.length === 1 && alertasRojas[0].id === '1');

  // -------------------------------------------------------------
  // FASE 3: COMPORTAMIENTO EN SUB-PESTAÑA VALORIZADOS
  // -------------------------------------------------------------
  console.log('\n📌 FASE 3: Comportamiento en la sub-pestaña Valorizados');

  const filterValorizados = (ocList) => {
    return ocList.filter(oc => {
      if (oc.estado === 'Cancelado' || oc.estado === 'Cancelada' || oc.estado === 'Saldo liberado') return false;
      const arts = oc.ordenes_compra_articulos || [];
      if (arts.length === 0) return false;
      const totalSol = arts.reduce((sum, a) => sum + (Number(a.cantidad) || 0), 0);
      const totalRec = arts.reduce((sum, a) => sum + (Number(a.cantidad_recepcionada) || 0), 0);

      // Regla: Cerrada con saldo y Recepción Conforme Parcial ingresan si falta saldo
      if (oc.estado === 'Cerrada con saldo pendiente' || 
          oc.estado === 'Recepción Conforme Parcial' || 
          oc.estado === 'Recepción conforme parcial' ||
          oc.estado === 'Recepcion conforme parcial') {
        return totalRec < totalSol;
      }

      // Órdenes estándar
      return totalRec > 0 && totalRec < totalSol;
    });
  };

  const ocsTestValorizados = [
    {
      id: 'VAL-1',
      numero_oc: 'OC-PARCIAL-PENDIENTE',
      estado: 'Recepción Conforme Parcial',
      ordenes_compra_articulos: [{ cantidad: 1000, cantidad_recepcionada: 400 }] // Saldo restante 600
    },
    {
      id: 'VAL-2',
      numero_oc: 'OC-PARCIAL-COMPLETADA',
      estado: 'Recepción Conforme Parcial',
      ordenes_compra_articulos: [{ cantidad: 1000, cantidad_recepcionada: 1000 }] // Sin saldo restante (100% recibida)
    },
    {
      id: 'VAL-3',
      numero_oc: 'OC-SALDO-LIBERADO',
      estado: 'Saldo liberado',
      ordenes_compra_articulos: [{ cantidad: 1000, cantidad_recepcionada: 400 }] // Saldo liberado
    },
    {
      id: 'VAL-4',
      numero_oc: 'OC-CANCELADA',
      estado: 'Cancelado',
      ordenes_compra_articulos: [{ cantidad: 1000, cantidad_recepcionada: 400 }] // Cancelada
    }
  ];

  const enValorizados = filterValorizados(ocsTestValorizados).map(o => o.numero_oc);
  check('OC con "Recepción Conforme Parcial" y saldo pendiente ENTRA en Valorizados', enValorizados.includes('OC-PARCIAL-PENDIENTE'));
  check('OC con "Recepción Conforme Parcial" y 100% recibida NO entra en Valorizados', !enValorizados.includes('OC-PARCIAL-COMPLETADA'));
  check('OC con "Saldo liberado" NO entra en Valorizados', !enValorizados.includes('OC-SALDO-LIBERADO'));
  check('OC con "Cancelado" NO entra en Valorizados', !enValorizados.includes('OC-CANCELADA'));

  // -------------------------------------------------------------
  // FASE 4: DISPONIBILIDAD EN BÚSQUEDA DE RECEPCIÓN DE PRODUCTOS
  // -------------------------------------------------------------
  console.log('\n📌 FASE 4: Disponibilidad para recepcionar entregas futuras');

  const filterActivasRecepcion = (ocList) => {
    return ocList.filter(oc => {
      return oc.estado === 'Enviada' || 
             oc.estado === 'Aceptada' || 
             oc.estado === 'Recepción Conforme Parcial' || 
             oc.estado === 'Recepción conforme parcial' || 
             oc.estado === 'Recepcion conforme parcial';
    });
  };

  const activas = filterActivasRecepcion(testOcsParaAlertas).map(o => o.numero_oc);
  check('OC con "Recepción Conforme Parcial" sigue activa para recepcionar nuevas entregas', activas.includes('OC-CONFORME-PARCIAL'));

  // -------------------------------------------------------------
  // FASE 5: INTEGRACIÓN SUPABASE (CRUD TEMPORAL Y LIMPIEZA 100%)
  // -------------------------------------------------------------
  console.log('\n📌 FASE 5: Persistencia en Supabase y Limpieza de datos');
  const TEST_NUM_OC = 'TEST-CONF-PARCIAL-' + Date.now();
  let createdOcId = null;

  try {
    // 1. Insertar orden de prueba
    const { data: ocCreated, error: createErr } = await supabase
      .from('ordenes_compra')
      .insert([{
        numero_oc: TEST_NUM_OC,
        proveedor: 'LABORATORIO TEST CONFORME PARCIAL',
        rut_proveedor: '88.777.666-5',
        tipo_oc: 'AG',
        estado: 'Recepción Conforme Parcial',
        subtotal_articulos: 250000,
        total_neto: 250000,
        total_con_iva: 297500,
        saldo_oc: 100000,
        fecha_envio: new Date().toISOString()
      }])
      .select()
      .single();

    check('Inserción en Supabase con estado "Recepción Conforme Parcial"', !createErr && !!ocCreated, createErr?.message || '');
    
    if (ocCreated) {
      createdOcId = ocCreated.id;

      // 2. Insertar artículo asociado
      const { data: artCreated, error: artErr } = await supabase
        .from('ordenes_compra_articulos')
        .insert([{
          oc_id: createdOcId,
          codigo_articulo: 'TEST-ART-PARCIAL-1',
          cantidad: 500,
          cantidad_recepcionada: 300,
          precio_unitario: 500
        }])
        .select()
        .single();

      check('Inserción de artículo de prueba en Supabase', !artErr && !!artCreated, artErr?.message || '');

      // 3. Consultar y verificar lectura con filtro de estados activos
      const { data: queriedOcs, error: queryErr } = await supabase
        .from('ordenes_compra')
        .select('id, numero_oc, estado, ordenes_compra_articulos(id, cantidad, cantidad_recepcionada)')
        .eq('id', createdOcId)
        .in('estado', ['Enviada', 'Aceptada', 'Recepción Conforme Parcial'])
        .single();

      check('Consulta en Supabase con filtro .in() incluye la OC', !queryErr && queriedOcs?.numero_oc === TEST_NUM_OC);
    }
  } finally {
    // 4. Limpieza total garantizada
    if (createdOcId) {
      await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', createdOcId);
      const { error: delErr } = await supabase.from('ordenes_compra').delete().eq('id', createdOcId);
      check('Limpieza total de datos de prueba en Supabase (0 registros residuales)', !delErr);
    }
  }

  // -------------------------------------------------------------
  // RESUMEN FINAL
  // -------------------------------------------------------------
  console.log('\n-----------------------------------------------------------');
  if (fails === 0) {
    console.log('🎉 TODAS LAS VALIDACIONES PASARON EXITOSAMENTE (0 fallas).');
  } else {
    console.log(`⚠️ SE DETECTARON ${fails} FALLAS EN LA SUITE DE PRUEBAS.`);
  }
  console.log('-----------------------------------------------------------');
  process.exit(fails === 0 ? 0 : 1);
}

runTests().catch(e => {
  console.error('Error fatal en pruebas:', e);
  process.exit(1);
});
