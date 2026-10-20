-- ==============================================================================
-- AGREGAR SUB-CENTRO 'C.M' A CENTRO DE COSTO 'RESOLUTIVIDAD'
-- ==============================================================================

-- 1. Insertar 'C.M' si no existe ya en la tabla sub_centros_costo
INSERT INTO sub_centros_costo (centro_costo_id, nombre)
SELECT id, 'C.M'
FROM centros_costo
WHERE UPPER(TRIM(nombre)) = 'RESOLUTIVIDAD'
AND NOT EXISTS (
    SELECT 1 FROM sub_centros_costo 
    WHERE UPPER(TRIM(nombre)) = 'C.M'
);
