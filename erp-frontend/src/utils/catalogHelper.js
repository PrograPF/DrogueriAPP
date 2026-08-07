import { supabase } from '../supabaseClient';

/**
 * Carga el catálogo completo de artículos desde Supabase eliminando el límite por defecto de 1000 filas.
 * Retorna un objeto mapa flexible donde la clave es el código de artículo.
 */
export const fetchArticulosCatalogMap = async () => {
  try {
    const { data: arts, error } = await supabase
      .from('articulos')
      .select('codigo, descripcion')
      .range(0, 9999);

    if (error) throw error;

    const mapping = {};
    (arts || []).forEach(item => {
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
 * Soporta formateo flexible (ceros a la izquierda) y provee fallback descriptivo.
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

  if (fallbackText && fallbackText !== 'Cargando nombre...' && fallbackText !== 'Cargando...') {
    return fallbackText;
  }

  if (!isCatalogLoaded) {
    return 'Cargando nombre...';
  }

  return `Artículo [${rawCode}]`;
};
