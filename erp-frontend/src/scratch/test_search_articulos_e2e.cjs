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

// Replicamos exactamente la lógica implementada en SeguimientoOCModule.jsx
function filterTrackingOcs(ocs, searchQuery, filtroEstadoList, articulosCatalog) {
  return ocs.filter(oc => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (oc.numero_oc || '').toLowerCase().includes(q) ||
      (oc.proveedor || '').toLowerCase().includes(q) ||
      (oc.rut_proveedor || '').toLowerCase().includes(q) ||
      (oc.solicitud_compra || '').toLowerCase().includes(q) ||
      (oc.ordenes_compra_articulos || []).some(art => {
        const artCode = (art.codigo_articulo || '').toLowerCase();
        const artName = (articulosCatalog[art.codigo_articulo] || art.descripcion || '').toLowerCase();
        return artCode.includes(q) || artName.includes(q);
      })
    );

    let matchesStatus = true;
    if (filtroEstadoList !== 'TODOS') {
      if (filtroEstadoList === 'Cancelado') {
        matchesStatus = oc.estado === 'Cancelado' || oc.estado === 'Cancelada';
      } else {
        matchesStatus = oc.estado === filtroEstadoList;
      }
    }

    return matchesSearch && matchesStatus;
  });
}

function filterAlertasOcs(ocs, searchQueryAlertas, filtroEstadoAlertas, alertasSubFilter, articulosCatalog, checkPlazosFn) {
  return ocs.filter(oc => {
    const plazos = checkPlazosFn(oc);

    let matchesSubTab = false;
    const isExcludedFromAlerts = oc.estado === 'Cancelado' || oc.estado === 'Cancelada' || oc.estado === 'Recepción Conforme' || oc.estado === 'Recepción Con Multa' || oc.estado === 'Recepción de excepción' || oc.estado === 'Cerrada con saldo pendiente' || oc.estado === 'Saldo liberado';

    if (alertasSubFilter === 'TODAS') {
      matchesSubTab = !isExcludedFromAlerts && (plazos.isYellow || plazos.isOrange || plazos.isRosa || plazos.isPurpura || plazos.isExpired);
    } else if (alertasSubFilter === 'AMARILLAS') {
      matchesSubTab = !isExcludedFromAlerts && plazos.isYellow;
    } else if (alertasSubFilter === 'ROSA') {
      matchesSubTab = !isExcludedFromAlerts && plazos.isRosa;
    } else if (alertasSubFilter === 'NARANJAS') {
      matchesSubTab = !isExcludedFromAlerts && plazos.isOrange;
    } else if (alertasSubFilter === 'EXCEPCIONES' || alertasSubFilter === 'PURPURAS') {
      matchesSubTab = !isExcludedFromAlerts && (plazos.isPurpura || oc.estado === 'Excepciones');
    } else if (alertasSubFilter === 'ROJAS') {
      matchesSubTab = !isExcludedFromAlerts && plazos.isExpired;
    }

    if (!matchesSubTab) return false;

    const q = searchQueryAlertas.toLowerCase().trim();
    const matchesSearch = !q || (
      (oc.numero_oc || '').toLowerCase().includes(q) ||
      (oc.proveedor || '').toLowerCase().includes(q) ||
      (oc.rut_proveedor || '').toLowerCase().includes(q) ||
      (oc.solicitud_compra || '').toLowerCase().includes(q) ||
      (oc.ordenes_compra_articulos || []).some(art => {
        const artCode = (art.codigo_articulo || '').toLowerCase();
        const artName = (articulosCatalog[art.codigo_articulo] || art.descripcion || '').toLowerCase();
        return artCode.includes(q) || artName.includes(q);
      })
    );

    let matchesStatus = true;
    if (filtroEstadoAlertas !== 'TODOS') {
      if (filtroEstadoAlertas === 'Cancelado') {
        matchesStatus = oc.estado === 'Cancelado' || oc.estado === 'Cancelada';
      } else {
        matchesStatus = oc.estado === filtroEstadoAlertas;
      }
    }

    return matchesSearch && matchesStatus;
  });
}

async function runTests() {
  console.log('--- INICIO DE PRUEBAS DE VALIDACIÓN: BÚSQUEDA POR ARTÍCULO EN SEGUIMIENTO Y ALERTAS ---\n');

  const articulosCatalogMock = {
    'ART-PARACETAMOL': 'PARACETAMOL 500MG COMPRIMIDOS',
    'ART-IBUPROFENO': 'IBUPROFENO 400MG CAPSULAS',
    'ART-AMOXICILINA': 'AMOXICILINA 500MG SUSPENSION'
  };

  const dummyOcs = [
    {
      id: 1,
      numero_oc: 'OC-2026-001',
      proveedor: 'LABORATORIO CHILE',
      rut_proveedor: '76.123.456-7',
      solicitud_compra: 'SOL-101',
      estado: 'Enviada',
      ordenes_compra_articulos: [
        { codigo_articulo: 'ART-PARACETAMOL', descripcion: '' }
      ]
    },
    {
      id: 2,
      numero_oc: 'OC-2026-002',
      proveedor: 'DROGUERIA CENTRAL',
      rut_proveedor: '77.987.654-3',
      solicitud_compra: 'SOL-102',
      estado: 'Aceptada',
      ordenes_compra_articulos: [
        { codigo_articulo: 'ART-IBUPROFENO', descripcion: 'IBUPROFENO 400MG' }
      ]
    },
    {
      id: 3,
      numero_oc: 'OC-2026-003',
      proveedor: 'FARMACEUTICA SUR',
      rut_proveedor: '78.555.444-1',
      solicitud_compra: 'SOL-103',
      estado: 'Cancelado',
      ordenes_compra_articulos: [
        { codigo_articulo: 'ART-PARACETAMOL', descripcion: '' }
      ]
    }
  ];

  // 1. Pruebas unitarias de la lógica de "Seguimiento y Registro"
  console.log('📌 FASE 1: Pruebas del Buscador en "Seguimiento y Registro"');
  
  // Buscar por nombre de artículo del catálogo
  let res = filterTrackingOcs(dummyOcs, 'paracetamol', 'TODOS', articulosCatalogMock);
  check('Búsqueda por nombre de artículo ("paracetamol") encuentra OC-2026-001 y OC-2026-003', res.length === 2 && res.some(x => x.numero_oc === 'OC-2026-001'));

  // Buscar por fragmento de nombre ("comprimidos")
  res = filterTrackingOcs(dummyOcs, 'comprimidos', 'TODOS', articulosCatalogMock);
  check('Búsqueda por fragmento de descripción de artículo ("comprimidos") encuentra OC-2026-001', res.length === 2 && res[0].numero_oc === 'OC-2026-001');

  // Buscar por código de artículo
  res = filterTrackingOcs(dummyOcs, 'ART-IBUPROFENO', 'TODOS', articulosCatalogMock);
  check('Búsqueda por código de artículo ("ART-IBUPROFENO") encuentra OC-2026-002', res.length === 1 && res[0].numero_oc === 'OC-2026-002');

  // Buscar por RUT
  res = filterTrackingOcs(dummyOcs, '77.987', 'TODOS', articulosCatalogMock);
  check('Búsqueda por RUT de proveedor ("77.987") encuentra OC-2026-002', res.length === 1 && res[0].numero_oc === 'OC-2026-002');

  // Buscar combinando con filtro de estado
  res = filterTrackingOcs(dummyOcs, 'paracetamol', 'Enviada', articulosCatalogMock);
  check('Búsqueda combinada de artículo "paracetamol" + filtro de estado "Enviada" filtra solo OC-2026-001', res.length === 1 && res[0].numero_oc === 'OC-2026-001');

  // Búsqueda sin resultados
  res = filterTrackingOcs(dummyOcs, 'morfina', 'TODOS', articulosCatalogMock);
  check('Búsqueda de artículo inexistente ("morfina") retorna 0 resultados', res.length === 0);

  // 2. Pruebas de la lógica de "Alertas"
  console.log('\n📌 FASE 2: Pruebas del Buscador en "Alertas"');
  const mockCheckPlazos = (oc) => {
    if (oc.numero_oc === 'OC-2026-001') return { isYellow: true, isOrange: false, isRosa: false, isPurpura: false, isExpired: false };
    if (oc.numero_oc === 'OC-2026-002') return { isYellow: false, isOrange: false, isRosa: false, isPurpura: false, isExpired: true };
    return { isYellow: false, isOrange: false, isRosa: false, isPurpura: false, isExpired: false };
  };

  // Buscar en Alertas TODAS por nombre de artículo
  res = filterAlertasOcs(dummyOcs, 'paracetamol', 'TODOS', 'TODAS', articulosCatalogMock, mockCheckPlazos);
  check('Búsqueda en Alertas "TODAS" por artículo "paracetamol" incluye OC-2026-001 (alerta amarilla)', res.length === 1 && res[0].numero_oc === 'OC-2026-001');

  // Buscar en Alertas AMARILLAS por nombre de artículo
  res = filterAlertasOcs(dummyOcs, 'paracetamol', 'TODOS', 'AMARILLAS', articulosCatalogMock, mockCheckPlazos);
  check('Búsqueda en Alertas "AMARILLAS" por artículo "paracetamol" encuentra OC-2026-001', res.length === 1 && res[0].numero_oc === 'OC-2026-001');

  // Buscar en Alertas ROJAS por nombre de artículo de la OC que está en alerta amarilla (debe dar 0)
  res = filterAlertasOcs(dummyOcs, 'paracetamol', 'TODOS', 'ROJAS', articulosCatalogMock, mockCheckPlazos);
  check('Búsqueda en Alertas "ROJAS" por artículo "paracetamol" excluye OC-2026-001 (que es amarilla)', res.length === 0);

  // Buscar en Alertas ROJAS por artículo "ibuprofeno" (OC-2026-002 que es roja)
  res = filterAlertasOcs(dummyOcs, 'ibuprofeno', 'TODOS', 'ROJAS', articulosCatalogMock, mockCheckPlazos);
  check('Búsqueda en Alertas "ROJAS" por artículo "ibuprofeno" encuentra OC-2026-002', res.length === 1 && res[0].numero_oc === 'OC-2026-002');

  // 3. Prueba con base de datos real
  console.log('\n📌 FASE 3: Validación contra base de datos Supabase');
  try {
    const { data: dbOcs, error: errOcs } = await supabase
      .from('ordenes_compra')
      .select('*, ordenes_compra_articulos(*)')
      .limit(10);

    if (errOcs) throw errOcs;

    check('Conexión y lectura de OCs con artículos desde Supabase exitosa', Array.isArray(dbOcs));
    console.log(`ℹ️ Se obtuvieron ${dbOcs.length} órdenes de compra reales para comprobación.`);

    if (dbOcs.length > 0) {
      const ocConArticulos = dbOcs.find(o => o.ordenes_compra_articulos && o.ordenes_compra_articulos.length > 0);
      if (ocConArticulos) {
        const art = ocConArticulos.ordenes_compra_articulos[0];
        const artCode = art.codigo_articulo;
        const searchMatches = filterTrackingOcs(dbOcs, artCode, 'TODOS', {});
        check(`Filtrado en datos reales por código '${artCode}' encuentra la OC '${ocConArticulos.numero_oc}'`, searchMatches.some(o => o.id === ocConArticulos.id));
      }
    }
  } catch (dbErr) {
    console.error('Error en prueba Supabase:', dbErr.message);
    fails++;
  }

  console.log('\n-----------------------------------------------------------');
  if (fails === 0) {
    console.log('🎉 TODAS LAS PRUEBAS DE VALIDACIÓN PASARON EXITOSAMENTE (0 fallas).');
  } else {
    console.log(`⚠️ SE DETECTARON ${fails} FALLAS EN LAS PRUEBAS.`);
  }
}

runTests();
