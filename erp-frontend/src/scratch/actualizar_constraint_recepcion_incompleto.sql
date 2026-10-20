-- ==============================================================================
-- ACTUALIZACIÓN DE CHECK CONSTRAINT PARA ESTADO DE RECEPCIÓN DE ARTÍCULOS
-- Permite el nuevo estado: 'Recepción Incompleto'
-- ==============================================================================

-- 1. Eliminar la restricción actual si existe
ALTER TABLE ordenes_compra_articulos 
DROP CONSTRAINT IF EXISTS ordenes_compra_articulos_estado_recepcion_check;

-- 2. Volver a crear la restricción con los 5 estados válidos
ALTER TABLE ordenes_compra_articulos 
ADD CONSTRAINT ordenes_compra_articulos_estado_recepcion_check 
CHECK (estado_recepcion IN ('Pendiente', 'Recepcionado', 'Recepción Incompleto', 'Revisado', 'Rechazado'));

-- Comentario explicativo
COMMENT ON COLUMN ordenes_compra_articulos.estado_recepcion IS 
'Estado de recepción física en bodega: Pendiente, Recepcionado, Recepción Incompleto, Revisado, Rechazado';
