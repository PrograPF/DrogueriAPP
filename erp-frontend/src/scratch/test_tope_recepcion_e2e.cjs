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

// Replicamos la lógica de validación previa implementada en handleRegisterRecepcion
function validateRecepcion(selectedOc, recepcionQuantities, articulosCatalog = {}) {
  const incomingEntries = Object.entries(recepcionQuantities).filter(
    ([_, val]) => val && parseInt(val) > 0
  );

  if (incomingEntries.length === 0) {
    return { valid: false, error: 'Por favor ingrese al menos una cantidad a recibir mayor a 0.' };
  }

  for (const [artId, qtyStr] of incomingEntries) {
    const incomingQty = parseInt(qtyStr) || 0;
    const currentArt = selectedOc.ordenes_compra_articulos.find(a => a.id === artId);
    if (!currentArt) continue;

    const cantSol = Number(currentArt.cantidad) || 0;
    const currentAcum = Number(currentArt.cantidad_recepcionada) || 0;
    const maxPermitido = Math.max(0, cantSol - currentAcum);

    if (incomingQty > maxPermitido) {
      const nombreArt = articulosCatalog[currentArt.codigo_articulo] || `Artículo ${currentArt.codigo_articulo}`;
      return {
        valid: false,
        error: `⚠️ No se puede registrar la recepción: la cantidad ingresada para "${nombreArt}" (${incomingQty}) excede el máximo permitido restante (${maxPermitido}).`
      };
    }
  }

  return { valid: true };
}

// Replicamos la lógica de cálculo del botón y de alertas visuales en la fila
function checkRowOverLimit(art, inputValue) {
  const cantSolicitada = Number(art.cantidad) || 1;
  const cantRecibida = Number(art.cantidad_recepcionada) || 0;
  const maxPendiente = Math.max(0, cantSolicitada - cantRecibida);
  const enteredVal = inputValue !== undefined && inputValue !== '' ? parseInt(inputValue) : null;
  return enteredVal !== null && enteredVal > maxPendiente;
}

function checkHasAnyOverLimit(oc, recepcionQuantities) {
  return (oc.ordenes_compra_articulos || []).some(art => {
    const maxPend = Math.max(0, (Number(art.cantidad) || 0) - (Number(art.cantidad_recepcionada) || 0));
    const val = recepcionQuantities[art.id] ? parseInt(recepcionQuantities[art.id]) : 0;
    return val > maxPend;
  });
}

async function runTests() {
  console.log('--- INICIO DE PRUEBAS: VALIDACIÓN ESTRICTA DE TOPE MÁXIMO EN RECEPCIÓN ---\n');

  // =========================================================================
  // FASE 1: Casos de Prueba Unitarios (Lógica de Validación)
  // =========================================================================
  console.log('📌 FASE 1: Pruebas unitarias de límites de recepción');

  const mockOc = {
    id: 'oc-test-01',
    numero_oc: '621-1318-102026',
    ordenes_compra_articulos: [
      {
        id: 'art-01',
        codigo_articulo: '1318',
        cantidad: 6000,
        cantidad_recepcionada: 0
      }
    ]
  };

  // Caso 1: Intentar ingresar 11.996 sobre 6.000 solicitados -> DEBE SER RECHAZADO
  let valRes = validateRecepcion(mockOc, { 'art-01': '11996' }, { '1318': 'TRAZODONA 100MG' });
  check('Intento de ingresar 11.996 uds. sobre 6.000 es rechazado', !valRes.valid && valRes.error.includes('excede el máximo permitido'));

  // Caso 2: Visualmente se marca como overLimit
  check('Row input detecta sobre-límite con 11.996', checkRowOverLimit(mockOc.ordenes_compra_articulos[0], '11996') === true);
  check('Botón de registro se bloquea con 11.996', checkHasAnyOverLimit(mockOc, { 'art-01': '11996' }) === true);

  // Caso 3: Intentar ingresar 6.001 sobre 6.000 solicitados (Caso de borde +1) -> RECHAZADO
  valRes = validateRecepcion(mockOc, { 'art-01': '6001' });
  check('Intento de ingresar 6.001 uds. sobre 6.000 es rechazado', !valRes.valid);

  // Caso 4: Ingresar exactamente 6.000 (Tope exacto) -> PERMITIDO
  valRes = validateRecepcion(mockOc, { 'art-01': '6000' });
  check('Ingresar exactamente 6.000 uds. (100% de la orden) es permitido', valRes.valid === true);
  check('Botón de registro habilitado con 6.000 uds.', checkHasAnyOverLimit(mockOc, { 'art-01': '6000' }) === false);

  // Caso 5: Ingreso parcial de 3.000 uds. -> PERMITIDO
  valRes = validateRecepcion(mockOc, { 'art-01': '3000' });
  check('Ingreso parcial de 3.000 uds. es permitido', valRes.valid === true);

  // Caso 6: Orden con recepciones previas (ej: ya recibió 4.000, le quedan 2.000)
  const mockOcParcial = {
    id: 'oc-test-02',
    ordenes_compra_articulos: [
      { id: 'art-02', codigo_articulo: '1318', cantidad: 6000, cantidad_recepcionada: 4000 }
    ]
  };
  // Si intenta meter 2.500 cuando el saldo pendiente es 2.000 -> RECHAZADO
  valRes = validateRecepcion(mockOcParcial, { 'art-02': '2500' });
  check('Con 4.000 recibidas previas, ingresar 2.500 uds. (saldo 2.000) es rechazado', !valRes.valid);

  // Si mete 2.000 exactas -> PERMITIDO
  valRes = validateRecepcion(mockOcParcial, { 'art-02': '2000' });
  check('Con 4.000 recibidas previas, ingresar 2.000 uds. exactas es permitido', valRes.valid === true);

  // =========================================================================
  // FASE 2: Comprobación directa contra la Orden real en Supabase
  // =========================================================================
  console.log('\n📌 FASE 2: Verificación del estado en la Base de Datos para OC 621-1318-102026');
  const { data: realOc, error: errReal } = await supabase
    .from('ordenes_compra')
    .select('id, numero_oc, estado, estado_recepcion, ordenes_compra_articulos(*)')
    .ilike('numero_oc', '%1318%')
    .single();

  if (errReal) throw errReal;

  check('OC 621-1318-102026 existe en Supabase', !!realOc);
  check('Artículo 1318 tiene cantidad solicitada = 6000', realOc.ordenes_compra_articulos[0].cantidad === 6000);
  check('Artículo 1318 no excede el límite (recibido <= solicitado)', realOc.ordenes_compra_articulos[0].cantidad_recepcionada <= realOc.ordenes_compra_articulos[0].cantidad);
  console.log(`ℹ️ Estado actual de la OC: ${realOc.estado}, Cantidad recepcionada: ${realOc.ordenes_compra_articulos[0].cantidad_recepcionada} / ${realOc.ordenes_compra_articulos[0].cantidad}`);

  // Si se intentara ingresar cualquier cantidad adicional sobre una orden completa, el validador lo frena
  const testRealBlock = validateRecepcion(realOc, { [realOc.ordenes_compra_articulos[0].id]: '1' });
  check('El validador bloquea ingreso adicional si la OC ya está completa', !testRealBlock.valid);

  console.log('\n-----------------------------------------------------------');
  if (fails === 0) {
    console.log('🎉 TODAS LAS VALIDACIONES DE LÍMITE PASARON CON ÉXITO (0 fallas).');
  } else {
    console.log(`⚠️ SE ENCONTRARON ${fails} FALLAS.`);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
