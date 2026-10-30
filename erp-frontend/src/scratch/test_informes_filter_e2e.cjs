const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});
const supabase = createClient(url, key);

async function testFilterLogic() {
  const { data: rawPendientes } = await supabase
    .from('pendientes')
    .select('*, centros(nombre)')
    .order('fecha', { ascending: false })
    .range(0, 4999);

  const { data: rawArts } = await supabase.from('articulos').select('codigo, descripcion').range(0, 9999);
  const catalog = {};
  rawArts.forEach(a => {
    if (a.codigo) {
      const raw = String(a.codigo).trim();
      const clean = raw.replace(/^0+/, '');
      catalog[raw] = a.descripcion;
      if (clean) catalog[clean] = a.descripcion;
    }
  });

  const data = rawPendientes.map(item => ({
    id: item.id,
    cod: String(item.codigo_articulo || 'S/C').trim(),
    centro: item.centros?.nombre || 'S/C',
    cantidad: item.pendiente,
    fecha: item.fecha,
    esVigente: item.es_vigente,
    esResuelto: item.es_resuelto,
    nombre: catalog[String(item.codigo_articulo).trim()] || 'Sin nombre'
  }));

  console.log('Total pendientes cargados en memoria:', data.length);

  function filter(term, estado = 'vigente') {
    return data.filter(item => {
      if (term) {
        const t = term.toLowerCase().trim();
        const isNum = /^\d+$/.test(t);
        if (isNum) {
          const cleanT = t.replace(/^0+/, '');
          const cleanCod = String(item.cod).trim().replace(/^0+/, '');
          if (cleanCod !== cleanT) return false;
        } else {
          const cleanCod = String(item.cod).trim().toLowerCase();
          const nom = (item.nombre || '').toLowerCase();
          if (!cleanCod.includes(t) && !nom.includes(t)) return false;
        }
      }
      if (estado === 'vigente') {
        if (!item.esVigente || item.esResuelto) return false;
      }
      return true;
    });
  }

  // 1. Probar búsqueda '1404'
  const res1404 = filter('1404');
  console.log('\n=== TEST 1: BÚSQUEDA POR CÓDIGO "1404" ===');
  console.log('Filas encontradas:', res1404.length);
  res1404.forEach(r => console.log(`  -> [${r.cod}] ${r.nombre} | ${r.centro} | Cantidad: ${r.cantidad}`));
  const codes1404 = [...new Set(res1404.map(r => r.cod))];
  const total1404 = res1404.reduce((sum, r) => sum + r.cantidad, 0);
  console.log('Códigos únicos:', codes1404, '| Total deuda calculada:', total1404);
  if (codes1404.length === 1 && codes1404[0] === '1404' && total1404 === 20 && res1404.length === 2) {
    console.log('✓ TEST 1 EXITOSO: Solo 1404 incluido (20 unidades). Códigos 1182 y 218 quedaron 100% excluidos.');
  } else {
    throw new Error('Test 1 fallido');
  }

  // 2. Probar que digitar un '1' no traiga 1404, 218 o 1182
  const res1 = filter('1');
  console.log('\n=== TEST 2: BÚSQUEDA POR CÓDIGO "1" (Coincidencia exacta) ===');
  console.log('Filas para código exacto 1:', res1.length);
  const has1404In1 = res1.some(r => r.cod === '1404');
  const has218In1 = res1.some(r => r.cod === '218');
  const has1182In1 = res1.some(r => r.cod === '1182');
  console.log('¿Contamina con 1404?:', has1404In1, '| ¿Contamina con 218?:', has218In1, '| ¿Contamina con 1182?:', has1182In1);
  if (!has1404In1 && !has218In1 && !has1182In1) {
    console.log('✓ TEST 2 EXITOSO: El código exacto previene contaminar con otros códigos que contengan el dígito 1.');
  } else {
    throw new Error('Test 2 fallido');
  }

  // 3. Probar búsqueda por texto 'Glucosa'
  const resGlucosa = filter('Glucosa');
  console.log('\n=== TEST 3: BÚSQUEDA POR TEXTO "Glucosa" ===');
  console.log('Filas encontradas para "Glucosa":', resGlucosa.length);
  resGlucosa.forEach(r => console.log(`  -> [${r.cod}] ${r.nombre} | ${r.centro} | Cantidad: ${r.cantidad}`));
  if (resGlucosa.length >= 2 && resGlucosa.every(r => r.nombre.toLowerCase().includes('glucosa'))) {
    console.log('✓ TEST 3 EXITOSO: La búsqueda por texto encuentra los productos correctamente.');
  } else {
    throw new Error('Test 3 fallido');
  }
}

testFilterLogic().catch(err => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});
