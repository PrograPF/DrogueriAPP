import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook que busca la descripción de un fármaco o DM en Supabase.
 * Utiliza un debounce de 400ms para no saturar de consultas la base de datos.
 */
const useArsenalLookup = (codigo) => {
  const [nombre, setNombre] = useState('Esperando código...');

  useEffect(() => {
    if (!codigo || codigo.trim() === '') {
      setNombre('Esperando código...');
      return;
    }

    setNombre('Buscando...');

    const lookup = async () => {
      try {
        const { data, error } = await supabase
          .from('articulos')
          .select('descripcion')
          .eq('codigo', codigo.trim())
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setNombre(data.descripcion);
        } else {
          setNombre('Código no encontrado en arsenal');
        }
      } catch (err) {
        console.error('Error al buscar en el arsenal:', err);
        setNombre('Error en búsqueda');
      }
    };

    const handler = setTimeout(() => {
      lookup();
    }, 400);

    return () => clearTimeout(handler);
  }, [codigo]);

  return nombre;
};

export default useArsenalLookup;

