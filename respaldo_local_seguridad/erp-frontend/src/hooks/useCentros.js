import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook reutilizable para cargar la lista de centros desde Supabase.
 * Evita duplicar la lista hardcodeada en cada formulario.
 */
const useCentros = () => {
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCentros = async () => {
      try {
        const { data, error } = await supabase
          .from('centros')
          .select('id, nombre')
          .order('nombre');

        if (error) throw error;
        setCentros(data.map(c => c.nombre));
      } catch (err) {
        console.error('Error cargando centros:', err);
        // Fallback en caso de error de conexión
        setCentros([
          "ANGELMO", "ANTONIO VARAS", "ASISTE-CPU", "C. ALERCE",
          "CARMELA CARVAJAL", "CEAPS", "CECOSF ALERCE NORTE",
          "CECOSF LAWEN", "CECOSF PUERTA SUR", "CLINICA MOVIL",
          "ESR", "LAB. CLINICO", "ORL", "PADRE HURTADO",
          "SAPU PH", "SAR ALERCE", "UAPO", "UAPORRINO"
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchCentros();
  }, []);

  return { centros, loading };
};

export default useCentros;
