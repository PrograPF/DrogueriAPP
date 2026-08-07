import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook que busca la descripción de un fármaco o DM en Supabase.
 * Utiliza un debounce de 400ms para no saturar de consultas la base de datos,
 * e ignora respuestas de peticiones obsoletas (evita condiciones de carrera).
 */
const useArsenalLookup = (codigo) => {
  const [nombre, setNombre] = useState('Esperando código...');

  useEffect(() => {
    const trimmedCodigo = codigo ? String(codigo).trim() : '';

    if (!trimmedCodigo) {
      setNombre('Esperando código...');
      return;
    }

    setNombre('Buscando...');
    let isCurrent = true;

    const lookup = async () => {
      try {
        const { data, error } = await supabase
          .from('articulos')
          .select('descripcion')
          .eq('codigo', trimmedCodigo)
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (isCurrent) {
          if (data) {
            setNombre(data.descripcion);
          } else {
            setNombre('Código no encontrado en arsenal');
          }
        }
      } catch (err) {
        if (isCurrent) {
          console.error('Error al buscar en el arsenal:', err);
          setNombre('Error en búsqueda');
        }
      }
    };

    const handler = setTimeout(() => {
      lookup();
    }, 400);

    return () => {
      isCurrent = false;
      clearTimeout(handler);
    };
  }, [codigo]);

  return nombre;
};

export default useArsenalLookup;


