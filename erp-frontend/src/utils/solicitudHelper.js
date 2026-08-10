import { supabase } from '../supabaseClient';

/**
 * Recalcula y actualiza el estado de una Solicitud de Compra (solicitudes_compra)
 * basándose en los artículos asignados a Órdenes de Compra activas.
 * 
 * Reglas de Liberación:
 * - OCs canceladas (estado === 'Cancelado' / 'Cancelada') NO reservan artículos.
 * - Artículos con estado_recepcion === 'Rechazado' NO reservan artículos (se liberan para ser asignados a una nueva OC).
 */
export const evaluarYActualizarEstadoSolicitud = async (solNumero, excludeOcIds = []) => {
  if (!solNumero) return;
  try {
    let solData = null;
    const trimmed = solNumero.trim();
    const upper = trimmed.toUpperCase();
    const withPrefix = upper.startsWith('S-') ? upper : `S-${upper}`;
    const withoutPrefix = upper.startsWith('S-') ? upper.substring(2) : upper;

    for (const candidate of [trimmed, withPrefix, withoutPrefix]) {
      const { data } = await supabase
        .from('solicitudes_compra')
        .select(`
          id,
          numero_solicitud,
          codigo_articulo,
          solicitudes_compra_articulos (
            codigo_articulo
          )
        `)
        .eq('numero_solicitud', candidate)
        .maybeSingle();
      
      if (data) {
        solData = data;
        break;
      }
    }

    if (!solData) {
      console.warn('[evaluarEstadoSolicitud] Solicitud no encontrada para:', solNumero);
      return;
    }

    const exactNumSol = solData.numero_solicitud;

    // Coleccionar todos los códigos de artículos solicitados
    const requestedCodes = new Set();
    if (solData.solicitudes_compra_articulos && solData.solicitudes_compra_articulos.length > 0) {
      solData.solicitudes_compra_articulos.forEach(a => {
        if (a.codigo_articulo) requestedCodes.add(a.codigo_articulo.trim().toUpperCase());
      });
    } else if (solData.codigo_articulo) {
      requestedCodes.add(solData.codigo_articulo.trim().toUpperCase());
    }

    if (requestedCodes.size === 0) return;

    // Buscar todas las OCs asociadas a esta solicitud
    const { data: ocsData } = await supabase
      .from('ordenes_compra')
      .select(`
        id,
        numero_oc,
        solicitud_compra,
        estado,
        ordenes_compra_articulos (
          codigo_articulo,
          estado_recepcion
        )
      `)
      .ilike('solicitud_compra', exactNumSol);

    const excludeSet = new Set(excludeOcIds.map(id => String(id)));
    const activeOcs = (ocsData || []).filter(oc => {
      const isCancelled = oc.estado === 'Cancelado' || oc.estado === 'Cancelada';
      const isExcluded = excludeSet.has(String(oc.id));
      return !isCancelled && !isExcluded;
    });

    // Un artículo se considera asignado SOLO si la OC está activa Y el artículo NO fue rechazado
    const assignedCodes = new Set();
    activeOcs.forEach(oc => {
      (oc.ordenes_compra_articulos || []).forEach(art => {
        if (art.codigo_articulo && art.estado_recepcion !== 'Rechazado') {
          assignedCodes.add(art.codigo_articulo.trim().toUpperCase());
        }
      });
    });

    let assignedCount = 0;
    requestedCodes.forEach(code => {
      if (assignedCodes.has(code)) assignedCount++;
    });

    let nuevoEstado = 'Sin OC asignada';
    if (assignedCount >= requestedCodes.size) {
      nuevoEstado = 'OC asignada completa';
    } else if (assignedCount > 0) {
      nuevoEstado = 'OC asignada parcial';
    }

    console.log(`[evaluarEstadoSolicitud] ${exactNumSol} -> Asignados=${assignedCount}/${requestedCodes.size} -> Nuevo estado: "${nuevoEstado}"`);

    const { error: updateErr } = await supabase
      .from('solicitudes_compra')
      .update({ estado: nuevoEstado })
      .eq('id', solData.id);

    if (updateErr) {
      console.error('[evaluarEstadoSolicitud] Error al actualizar estado de solicitud:', updateErr);
    }

  } catch (err) {
    console.error('[evaluarEstadoSolicitud] Excepción:', err);
  }
};
