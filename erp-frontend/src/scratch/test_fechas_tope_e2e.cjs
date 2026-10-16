const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k) env[k] = v.join('=').trim();
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

let fails = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? '✅' : '❌'} ${name} ${extra}`); if (!cond) fails++; };

async function main() {
  const ts = Date.now();
  const solNum = `S-TEST-FT-${ts}`;
  const ocNum = `OC-TEST-FT-${ts}`;
  const fechas = { fecha_tope_aceptacion: '2026-10-19', fecha_tope_entrega: '2026-10-25', fecha_tope_multa: '2026-10-30' };
  let solId = null, ocId = null;

  try {
    const { data: sol, error: solErr } = await supabase.from('solicitudes_compra').insert([{
      numero_solicitud: solNum, codigo_articulo: 'TEST', descripcion_articulo: 'TEST FECHAS TOPE',
      cantidad: 1, fecha_creacion: '2026-10-16', estado: 'Sin OC asignada', tipo_oc: 'SE', ...fechas
    }]).select();
    check('Crear solicitud con tipo y fechas tope', !solErr, solErr ? solErr.message : '');
    if (solErr) return;
    solId = sol[0].id;

    const { data: solRead } = await supabase.from('solicitudes_compra').select('*').eq('id', solId).single();
    check('Solicitud: tipo_oc = SE', solRead.tipo_oc === 'SE');
    check('Solicitud: fechas sin corrimiento', solRead.fecha_tope_aceptacion === '2026-10-19' && solRead.fecha_tope_entrega === '2026-10-25' && solRead.fecha_tope_multa === '2026-10-30',
      JSON.stringify([solRead.fecha_tope_aceptacion, solRead.fecha_tope_entrega, solRead.fecha_tope_multa]));

    // Herencia: la OC copia tipo y fechas desde la solicitud (como hace handleSeleccionarSolicitud)
    const { data: oc, error: ocErr } = await supabase.from('ordenes_compra').insert([{
      numero_oc: ocNum, solicitud_compra: solNum, proveedor: 'PROVEEDOR TEST', rut_proveedor: '1-9',
      tipo_oc: solRead.tipo_oc, estado: 'Enviada', fecha_envio: new Date().toISOString(),
      fecha_tope_aceptacion: solRead.fecha_tope_aceptacion, fecha_tope_entrega: solRead.fecha_tope_entrega, fecha_tope_multa: solRead.fecha_tope_multa
    }]).select();
    check('Crear OC heredando fechas', !ocErr, ocErr ? ocErr.message : '');
    if (ocErr) return;
    ocId = oc[0].id;

    const { data: ocRead } = await supabase.from('ordenes_compra').select('*').eq('id', ocId).single();
    check('OC: tipo heredado = SE', ocRead.tipo_oc === 'SE');
    check('OC: fechas heredadas sin corrimiento', ocRead.fecha_tope_aceptacion === '2026-10-19' && ocRead.fecha_tope_entrega === '2026-10-25' && ocRead.fecha_tope_multa === '2026-10-30');

    // Cambio manual de estado: solo cambia estado, no fechas
    await supabase.from('ordenes_compra').update({ estado: 'Aceptada' }).eq('id', ocId);
    const { data: ocAfter } = await supabase.from('ordenes_compra').select('estado, fecha_tope_entrega').eq('id', ocId).single();
    check('OC: cambio manual a Aceptada conserva fechas', ocAfter.estado === 'Aceptada' && ocAfter.fecha_tope_entrega === '2026-10-25');
  } finally {
    if (ocId) await supabase.from('ordenes_compra_articulos').delete().eq('oc_id', ocId);
    if (ocId) await supabase.from('ordenes_compra').delete().eq('id', ocId);
    if (solId) await supabase.from('solicitudes_compra_articulos').delete().eq('solicitud_id', solId);
    if (solId) await supabase.from('solicitudes_compra').delete().eq('id', solId);
    const { data: restoSol } = await supabase.from('solicitudes_compra').select('id').eq('numero_solicitud', solNum);
    const { data: restoOc } = await supabase.from('ordenes_compra').select('id').eq('numero_oc', ocNum);
    check('Limpieza total de datos de prueba', (restoSol || []).length === 0 && (restoOc || []).length === 0);
    console.log(fails === 0 ? '\nE2E OK' : `\n${fails} FALLA(S)`);
    process.exit(fails ? 1 : 0);
  }
}
main();
