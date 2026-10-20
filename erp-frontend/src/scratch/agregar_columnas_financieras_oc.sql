-- ==============================================================================
-- Script de Migración: Columnas Financieras para Órdenes de Compra
-- DrogueriAPP - Ejecutar en el SQL Editor del Dashboard de Supabase
-- ==============================================================================

-- 1. Agregar precio_unitario y subtotal_neto a los artículos de la OC
ALTER TABLE ordenes_compra_articulos 
ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(14,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal_neto NUMERIC(14,2) DEFAULT 0;

-- 2. Agregar total_neto, total_con_iva (19%) y saldo_oc a la cabecera de la OC
ALTER TABLE ordenes_compra 
ADD COLUMN IF NOT EXISTS total_neto NUMERIC(14,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_con_iva NUMERIC(14,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS saldo_oc NUMERIC(14,2) DEFAULT 0;

-- Mensaje de confirmación
COMMENT ON COLUMN ordenes_compra_articulos.precio_unitario IS 'Precio neto unitario pactado para el artículo en la OC';
COMMENT ON COLUMN ordenes_compra_articulos.subtotal_neto IS 'Subtotal neto = cantidad solicitada * precio_unitario';
COMMENT ON COLUMN ordenes_compra.total_neto IS 'Suma de subtotales netos de todos los artículos de la OC';
COMMENT ON COLUMN ordenes_compra.total_con_iva IS 'Total neto + 19% IVA';
COMMENT ON COLUMN ordenes_compra.saldo_oc IS 'Total neto - suma(cantidad_recepcionada * precio_unitario)';
