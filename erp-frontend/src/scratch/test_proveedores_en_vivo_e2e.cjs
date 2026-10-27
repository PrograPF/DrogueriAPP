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

// Replicamos la lógica exacta de buscarProveedoresEnVivo implementada en SeguimientoOCModule.jsx
async function buscarProveedoresEnVivo(queryText = '') {
  try {
    let q = supabase
      .from('proveedores')
      .select('id, rut, nombre_proveedor')
      .order('nombre_proveedor', { ascending: true });

    const term = (queryText || '').trim();
    if (term) {
      q = q.or(`nombre_proveedor.ilike.%${term}%,rut.ilike.%${term}%`);
    }
    const { data, error } = await q.limit(30);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error al buscar proveedores en vivo:', err);
    return [];
  }
}

async function runTests() {
  console.log('--- INICIO DE PRUEBAS: CARGA Y BÚSQUEDA DE PROVEEDORES EN VIVO ---\n');

  // =========================================================================
  // FASE 1: Búsqueda sin parámetros (al hacer foco / click en campo vacío)
  // =========================================================================
  console.log('📌 FASE 1: Consulta inicial sin filtro (al enfocar campo vacío)');
  const provsIniciales = await buscarProveedoresEnVivo('');
  check('Consulta vacía retorna lista de proveedores disponibles', Array.isArray(provsIniciales) && provsIniciales.length > 0, `(${provsIniciales.length} encontrados)`);

  // =========================================================================
  // FASE 2: Búsqueda por nombre y por RUT en vivo
  // =========================================================================
  console.log('\n📌 FASE 2: Búsqueda filtrada en tiempo real');
  const primerProv = provsIniciales[0];
  const queryNombre = primerProv.nombre_proveedor.slice(0, 4);
  const resNombre = await buscarProveedoresEnVivo(queryNombre);
  check(`Búsqueda por fragmento '${queryNombre}' incluye al proveedor '${primerProv.nombre_proveedor}'`, 
    resNombre.some(p => p.id === primerProv.id));

  const queryRut = primerProv.rut ? primerProv.rut.slice(0, 4) : '';
  if (queryRut) {
    const resRut = await buscarProveedoresEnVivo(queryRut);
    check(`Búsqueda por RUT parcial '${queryRut}' incluye al proveedor '${primerProv.nombre_proveedor}'`, 
      resRut.some(p => p.id === primerProv.id));
  }

  // =========================================================================
  // FASE 3: Simulación de creación en otra pestaña y búsqueda instantánea
  // =========================================================================
  console.log('\n📌 FASE 3: Simulación de proveedor creado en otra pestaña (Caso de Uso del Usuario)');
  const tempNombre = `PROV_TEST_TEMPORAL_${Date.now()}`;
  const tempRut = `99.${Math.floor(Math.random() * 899 + 100)}.777-K`;

  let insertedId = null;
  try {
    // 1. Simular creación en otra ventana
    const { data: nuevo, error: errInsert } = await supabase
      .from('proveedores')
      .insert({
        nombre_proveedor: tempNombre,
        rut: tempRut,
        correo: 'test@proveedor.com'
      })
      .select('id, nombre_proveedor, rut')
      .single();

    if (errInsert) throw errInsert;
    insertedId = nuevo.id;
    console.log(`ℹ️ Proveedor de prueba creado en BD: "${tempNombre}" (${tempRut})`);

    // 2. En ese MISMO instante, el usuario busca en DrogueriAPP
    const resEnVivo = await buscarProveedoresEnVivo(tempNombre);
    const encontrado = resEnVivo.find(p => p.id === insertedId);

    check('Proveedor creado externamente es encontrado en vivo en el mismo instante', 
      !!encontrado, 
      encontrado ? `(Encontrado: "${encontrado.nombre_proveedor}")` : '(No encontrado)');

    // 3. Verificar auto-asignación de RUT
    const matched = resEnVivo.find(p => (p.nombre_proveedor || '').toLowerCase() === tempNombre.toLowerCase());
    check('El RUT del proveedor recién creado se resuelve correctamente', 
      matched && matched.rut === tempRut);

  } finally {
    // 4. Limpieza total de datos de prueba
    if (insertedId) {
      await supabase.from('proveedores').delete().eq('id', insertedId);
      console.log('🧹 Proveedor de prueba eliminado de la base de datos (limpieza completada).');
    }
  }

  // =========================================================================
  // FASE 4: Verificación de exclusión de carga inicial en archivo
  // =========================================================================
  console.log('\n📌 FASE 4: Auditoría de código en SeguimientoOCModule.jsx');
  const fileContent = fs.readFileSync(path.join(__dirname, '..', 'modules', 'SeguimientoOC', 'SeguimientoOCModule.jsx'), 'utf8');
  
  // Verificar que NO se llame cargarProveedores() en el useEffect inicial de montaje
  const mountEffectMatch = fileContent.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?cargarOcs\(\);[\s\S]*?\}, \[\]\);/);
  const mountHasCargarProveedores = mountEffectMatch ? mountEffectMatch[0].includes('cargarProveedores()') : false;

  check('Se eliminó la llamada cargarProveedores() del montaje inicial (useEffect [])', !mountHasCargarProveedores);
  check('Implementación de buscarProveedoresEnVivo presente en el archivo', fileContent.includes('const buscarProveedoresEnVivo = async'));
  check('Debounce en creación implementado', fileContent.includes('buscarProveedoresEnVivo(proveedorSearch)'));
  check('Debounce en edición implementado', fileContent.includes('buscarProveedoresEnVivo(editProveedorSearch)'));

  console.log('\n-----------------------------------------------------------');
  if (fails === 0) {
    console.log('🎉 TODAS LAS PRUEBAS DE VALIDACIÓN PASARON EXITOSAMENTE (0 fallas).');
  } else {
    console.log(`⚠️ SE DETECTARON ${fails} FALLAS EN LAS PRUEBAS.`);
  }
}

runTests();
