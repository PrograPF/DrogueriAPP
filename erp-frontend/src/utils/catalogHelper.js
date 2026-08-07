import { supabase } from '../supabaseClient';

/**
 * Carga el catálogo completo de artículos desde Supabase paginando en bloques
 * de 1000 filas (superando el límite estricto de max-rows de Supabase/PostgREST).
 * Retorna un objeto mapa flexible donde la clave es el código de artículo.
 */
export const fetchArticulosCatalogMap = async () => {
  try {
    let allArts = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('articulos')
        .select('codigo, descripcion')
        .range(from, from + step - 1);

      if (error) {
        console.error('Error al cargar bloque del catálogo de artículos:', error);
        break;
      }

      if (data && data.length > 0) {
        allArts = allArts.concat(data);
        from += step;
        if (data.length < step) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    const mapping = {};
    allArts.forEach(item => {
      if (item && item.codigo) {
        const rawCode = String(item.codigo).trim();
        const cleanCode = rawCode.replace(/^0+/, '');

        mapping[rawCode] = item.descripcion;
        if (cleanCode) {
          mapping[cleanCode] = item.descripcion;
          mapping[cleanCode.padStart(4, '0')] = item.descripcion;
          mapping[cleanCode.padStart(6, '0')] = item.descripcion;
        }
      }
    });

    return mapping;
  } catch (err) {
    console.error('Error al cargar catálogo de artículos:', err);
    return {};
  }
};

/**
 * Resuelve el nombre de un artículo dado su código y un mapa del catálogo.
 * Soporta formateo flexible (ceros a la izquierda) y provee fallback.
 */
export const resolveArticuloNombre = (catalogMap, codigo, fallbackText = '', isCatalogLoaded = true) => {
  if (!codigo) return fallbackText || 'Sin código';

  const rawCode = String(codigo).trim();
  const cleanCode = rawCode.replace(/^0+/, '');

  if (catalogMap) {
    if (catalogMap[rawCode]) return catalogMap[rawCode];
    if (cleanCode && catalogMap[cleanCode]) return catalogMap[cleanCode];
    if (cleanCode && catalogMap[cleanCode.padStart(4, '0')]) return catalogMap[cleanCode.padStart(4, '0')];
    if (cleanCode && catalogMap[cleanCode.padStart(6, '0')]) return catalogMap[cleanCode.padStart(6, '0')];
  }

  if (fallbackText && fallbackText !== 'Cargando nombre...' && fallbackText !== 'Cargando...' && !fallbackText.startsWith('Artículo [')) {
    return fallbackText;
  }

  if (!isCatalogLoaded) {
    return 'Cargando nombre...';
  }

  return `Artículo [${rawCode}]`;
};
