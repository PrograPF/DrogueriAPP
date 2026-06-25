import { supabase } from '../supabaseClient';

/**
 * Busca un centro por nombre en Supabase. Si no existe, lo crea.
 * Retorna el ID del centro.
 */
export const resolveCentroId = async (nombreCentro) => {
  const { data, error } = await supabase
    .from('centros')
    .select('id')
    .eq('nombre', nombreCentro);

  if (!error && data && data.length > 0) {
    return data[0].id;
  }

  const { data: newCentro, error: insertError } = await supabase
    .from('centros')
    .insert([{ nombre: nombreCentro }])
    .select()
    .single();

  if (insertError) throw insertError;
  return newCentro.id;
};

