import { useState, useEffect } from 'react';

/**
 * Hook que carga el arsenal.json de forma diferida (lazy).
 * Solo se carga cuando un formulario lo necesita, no al inicio de la app.
 */
const useArsenalLookup = (codigo) => {
  const [nombre, setNombre] = useState('Esperando código...');
  const [arsenalData, setArsenalData] = useState(null);

  // Cargar arsenal.json solo la primera vez que se necesite
  useEffect(() => {
    if (!arsenalData) {
      import('../modules/arsenal.json').then(module => {
        setArsenalData(module.default);
      });
    }
  }, []);

  // Buscar nombre cuando cambia el código o se carga el arsenal
  useEffect(() => {
    if (!arsenalData) return;

    if (codigo) {
      const found = arsenalData[codigo];
      setNombre(found || 'Código no encontrado en arsenal');
    } else {
      setNombre('Esperando código...');
    }
  }, [codigo, arsenalData]);

  return nombre;
};

export default useArsenalLookup;
