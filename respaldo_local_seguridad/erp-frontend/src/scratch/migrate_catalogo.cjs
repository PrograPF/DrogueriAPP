const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zlvbhkaqlauuhyyvoxlr.supabase.co';
const supabaseKey = 'sb_publishable_duQQPhkE0a3RKPDrqbQYcg_CMcvShUj';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('Iniciando migración paginada desde "farmacos y DM" a categorias, articulos y variantes...');
  try {
    // 1. Obtener TODOS los datos de "farmacos y DM" paginando de 1000 en 1000
    let oldData = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      console.log(`Buscando registros desde el rango ${from} al ${from + limit - 1}...`);
      const { data, error } = await supabase
        .from('farmacos y DM')
        .select('*')
        .range(from, from + limit - 1);

      if (error) throw error;
      
      oldData = oldData.concat(data || []);
      console.log(`Leídos ${oldData.length} registros en total hasta ahora.`);

      if ((data || []).length < limit) {
        hasMore = false;
      } else {
        from += limit;
      }
    }

    console.log(`Lectura finalizada. Total registros leídos de la tabla origen: ${oldData.length}`);

    if (oldData.length === 0) {
      console.log('La tabla origen está vacía. No hay datos que migrar.');
      return;
    }

    // 2. Extraer categorías únicas
    const uniqueCategories = [...new Set(oldData.map(item => item.categoria).filter(Boolean))];
    console.log(`Encontradas ${uniqueCategories.length} categorías únicas.`);

    const categoryMap = {}; // nombre -> id
    for (const catName of uniqueCategories) {
      const trimmedCat = catName.trim().toUpperCase();
      // Insertar o buscar categoría
      let { data: catData, error: catError } = await supabase
        .from('categorias')
        .select('id')
        .eq('nombre', trimmedCat)
        .maybeSingle();

      if (catError) throw catError;

      if (!catData) {
        const { data: newCat, error: insertError } = await supabase
          .from('categorias')
          .insert([{ nombre: trimmedCat }])
          .select('id')
          .single();
        if (insertError) throw insertError;
        catData = newCat;
      }
      categoryMap[trimmedCat] = catData.id;
    }
    console.log('Categorías migradas/asociadas correctamente.');

    // 3. Migrar Artículos Maestros y Variantes
    let articulosInsertados = 0;
    let variantesInsertadas = 0;

    for (const item of oldData) {
      const codigo = item.codigo?.trim().toUpperCase();
      const descripcion = item.descripcion?.trim().toUpperCase();
      const categoriaName = item.categoria?.trim().toUpperCase();
      const categoriaId = categoriaName ? categoryMap[categoriaName] : null;

      if (!codigo || !descripcion) continue;

      // Buscar si el artículo ya existe en la tabla maestra
      let { data: artExist, error: artError } = await supabase
        .from('articulos')
        .select('codigo')
        .eq('codigo', codigo)
        .maybeSingle();

      if (artError) throw artError;

      if (!artExist) {
        // Insertar en la tabla de artículos maestros
        const { error: insertArtError } = await supabase
          .from('articulos')
          .insert([{
            codigo: codigo,
            descripcion: descripcion,
            categoria_id: categoriaId
          }]);
        if (insertArtError) throw insertArtError;
        articulosInsertados++;
      }

      // Insertar siempre como variante de inventario
      const { error: insertVarError } = await supabase
        .from('articulos_variantes')
        .insert([{
          codigo_articulo: codigo,
          lote: item.lote || 'S/L',
          vencimiento: item.vencimiento || null,
          cantidad: item.cantidad || 0,
          carta_canje: item.carta_canje || 'NO',
          estado: item.estado || 'VIGENTE',
          comentario: item.comentario || '',
          ultimo_valor_sin_iva: item.ultimo_valor_sin_iva || 0,
          ultimo_valor_con_iva: item.ultimo_valor_con_iva || 0,
          total_sin_iva: item.total_sin_iva || 0,
          total_con_iva: item.total_con_iva || 0
        }]);

      if (insertVarError) throw insertVarError;
      variantesInsertadas++;
    }

    console.log(`Migración completada con éxito:`);
    console.log(`- Artículos maestros creados/verificados: ${articulosInsertados}`);
    console.log(`- Variantes/Lotes de inventario creados: ${variantesInsertadas}`);

  } catch (err) {
    console.error('Error durante la migración:', err);
  }
}

migrate();
