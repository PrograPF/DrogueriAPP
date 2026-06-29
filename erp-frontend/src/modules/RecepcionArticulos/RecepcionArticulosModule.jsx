import React, { useState, useEffect } from 'react';
import { 
  Truck, ClipboardList, Search, Activity, Calendar, FileText, 
  RefreshCw, CheckCircle, Clock, AlertTriangle, ArrowRight, ShoppingBag, 
  MapPin, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { formatDate, formatDateTime } from '../../utils/dateFormatter';



const RecepcionArticulosModule = () => {
  const [activeMode, setActiveMode] = useState('oc'); // 'oc' | 'cenabast'
  const [loading, setLoading] = useState(false);
  const [ocs, setOcs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [localStatuses, setLocalStatuses] = useState({}); // { [artId]: status }
  const [guardandoOcId, setGuardandoOcId] = useState(null);
  
  // Articles catalog mapping for instant code -> name translation
  const [articulosCatalog, setArticulosCatalog] = useState({});

  // Fetch articles base catalog
  const cargarArticulosCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('articulos')
        .select('codigo, descripcion');
      if (error) throw error;
      
      const mapping = {};
      (data || []).forEach(art => {
        if (art.codigo) {
          mapping[art.codigo.trim()] = art.descripcion;
        }
      });
      setArticulosCatalog(mapping);
    } catch (err) {
      console.error('Error al cargar catálogo de artículos:', err);
    }
  };

  // Fetch OCs from Supabase
  const cargarOcs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra')
        .select(`
          *,
          ordenes_compra_articulos (
            id,
            codigo_articulo,
            cantidad,
            cantidad_recepcionada,
            estado,
            fecha_almacenamiento,
            historial
          )
        `)
        .order('fecha_envio', { ascending: false });

      if (error) throw error;
      setOcs(data || []);
    } catch (err) {
      console.error('Error al cargar OCs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle status selection in memory
  const handleStatusChange = (artId, value) => {
    setLocalStatuses(prev => ({
      ...prev,
      [artId]: value
    }));
  };

  // Save reception for a specific OC
  const handleSaveOcReception = async (oc) => {
    const changedArts = (oc.ordenes_compra_articulos || []).filter(
      art => localStatuses[art.id] !== undefined && localStatuses[art.id] !== (art.estado || 'Pendiente')
    );

    if (changedArts.length === 0) {
      alert('No hay cambios pendientes para guardar en esta OC.');
      return;
    }

    setGuardandoOcId(oc.id);
    try {
      const now = new Date().toISOString();

      // 1. Update all changed articles in Supabase
      for (const art of changedArts) {
        const nuevoEstado = localStatuses[art.id];
        const currentHistorial = Array.isArray(art.historial) ? art.historial : [];
        const newEntry = {
          estado: nuevoEstado,
          fecha_almacenamiento: nuevoEstado !== 'Pendiente' ? now : null
        };
        const nuevoHistorial = [...currentHistorial, newEntry];

        const payload = {
          estado: nuevoEstado,
          fecha_almacenamiento: nuevoEstado !== 'Pendiente' ? now : null,
          historial: nuevoHistorial
        };

        const { error: artErr } = await supabase
          .from('ordenes_compra_articulos')
          .update(payload)
          .eq('id', art.id);

        if (artErr) throw artErr;
      }

      // 2. Fetch latest articles of this OC to calculate overall completeness
      const { data: updatedOcs, error: refreshErr } = await supabase
        .from('ordenes_compra')
        .select(`
          *,
          ordenes_compra_articulos (
            id,
            estado
          )
        `)
        .eq('id', oc.id);

      if (refreshErr) throw refreshErr;

      const ocToCheck = updatedOcs?.[0];
      if (ocToCheck) {
        const allProcessed = (ocToCheck.ordenes_compra_articulos || []).every(
          art => art.estado && art.estado !== 'Pendiente'
        );

        const someProcessed = (ocToCheck.ordenes_compra_articulos || []).some(
          art => art.estado && art.estado !== 'Pendiente'
        );

        if (allProcessed) {
          // Update parent OC status to 'Recepcionado'
          const { error: ocErr } = await supabase
            .from('ordenes_compra')
            .update({ estado: 'Recepcionado' })
            .eq('id', oc.id);

          if (ocErr) throw ocErr;
          alert('Recepción guardada con éxito. ¡La OC se ha marcado como RECEPCIONADO!');
        } else {
          // Revert parent OC status to 'Aceptada' if it was 'Recepcionado' but no longer fully completed
          if (ocToCheck.estado === 'Recepcionado') {
            await supabase
              .from('ordenes_compra')
              .update({ estado: 'Aceptada' })
              .eq('id', oc.id);
          } else if (ocToCheck.estado === 'Enviada' && someProcessed) {
            // Set to Aceptada if some are processed but was Enviada
            await supabase
              .from('ordenes_compra')
              .update({ estado: 'Aceptada', fecha_aceptacion: now })
              .eq('id', oc.id);
          }
          alert('Recepción guardada correctamente.');
        }
      }

      // Clear local modified states for this OC
      const updatedLocalStatuses = { ...localStatuses };
      changedArts.forEach(art => {
        delete updatedLocalStatuses[art.id];
      });
      setLocalStatuses(updatedLocalStatuses);

      await cargarOcs();
    } catch (err) {
      console.error('Error al guardar recepción de OC:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setGuardandoOcId(null);
    }
  };

  useEffect(() => {
    cargarOcs();
    cargarArticulosCatalog();
  }, []);

  // Filtered OCs based on search query matching OC#, Proveedor, or Articles
  const filteredOcs = ocs.filter(oc => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const matchesOc = oc.numero_oc.toLowerCase().includes(q);
    const matchesProv = oc.proveedor.toLowerCase().includes(q);
    const matchesArt = (oc.ordenes_compra_articulos || []).some(art => {
      const artCode = (art.codigo_articulo || '').toLowerCase();
      const artName = (articulosCatalog[art.codigo_articulo] || '').toLowerCase();
      return artCode.includes(q) || artName.includes(q);
    });

    return matchesOc || matchesProv || matchesArt;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '35px' }}>
        <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '14px', border: '1px solid rgba(59,130,246,0.15)' }}>
          <ClipboardList size={32} color="#3b82f6" />
        </div>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Recepción de Artículos</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '4px 0 0 0' }}>Registro de ingresos y control de stock físico en bodega</p>
        </div>
      </div>

      {/* Two Large Action Buttons */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '20px', 
        marginBottom: '35px' 
      }}>
        {/* Recepción de OC Button */}
        <button
          onClick={() => setActiveMode('oc')}
          style={{
            background: activeMode === 'oc' 
              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)' 
              : 'rgba(30, 41, 59, 0.4)',
            border: activeMode === 'oc' ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'left',
            cursor: 'pointer',
            color: '#ffffff',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: activeMode === 'oc' ? '0 10px 25px -5px rgba(59, 130, 246, 0.15)' : 'none',
            display: 'flex',
            alignItems: 'start',
            gap: '18px'
          }}
          onMouseOver={(e) => {
            if (activeMode !== 'oc') {
              e.currentTarget.style.border = '2px solid rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
            }
          }}
          onMouseOut={(e) => {
            if (activeMode !== 'oc') {
              e.currentTarget.style.border = '2px solid rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)';
            }
          }}
        >
          <div style={{ 
            padding: '12px', 
            background: activeMode === 'oc' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)', 
            borderRadius: '12px',
            color: activeMode === 'oc' ? '#3b82f6' : '#94a3b8',
            transition: 'all 0.3s'
          }}>
            <Truck size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 6px 0', color: activeMode === 'oc' ? '#3b82f6' : '#f8fafc' }}>
              Recepción de OC
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
              Buscar e ingresar recepciones asociadas a Órdenes de Compra creadas en Seguimiento de OC.
            </p>
          </div>
        </button>

        {/* Recepción de Cenabast Button */}
        <button
          onClick={() => setActiveMode('cenabast')}
          style={{
            background: activeMode === 'cenabast' 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)' 
              : 'rgba(30, 41, 59, 0.4)',
            border: activeMode === 'cenabast' ? '2px solid #10b981' : '2px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'left',
            cursor: 'pointer',
            color: '#ffffff',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: activeMode === 'cenabast' ? '0 10px 25px -5px rgba(16, 185, 129, 0.15)' : 'none',
            display: 'flex',
            alignItems: 'start',
            gap: '18px'
          }}
          onMouseOver={(e) => {
            if (activeMode !== 'cenabast') {
              e.currentTarget.style.border = '2px solid rgba(16, 185, 129, 0.4)';
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
            }
          }}
          onMouseOut={(e) => {
            if (activeMode !== 'cenabast') {
              e.currentTarget.style.border = '2px solid rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)';
            }
          }}
        >
          <div style={{ 
            padding: '12px', 
            background: activeMode === 'cenabast' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)', 
            borderRadius: '12px',
            color: activeMode === 'cenabast' ? '#10b981' : '#94a3b8',
            transition: 'all 0.3s'
          }}>
            <Activity size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 6px 0', color: activeMode === 'cenabast' ? '#10b981' : '#f8fafc' }}>
              Recepción de Cenabast
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
              Registrar recepciones de despachos Cenabast, consultando productos programados y envíos directos.
            </p>
          </div>
        </button>
      </div>

      {/* Dynamic Content area */}
      <AnimatePresence mode="wait">
        {activeMode === 'oc' ? (
          <motion.div
            key="oc-buscador"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-card"
            style={{ padding: '30px' }}
          >
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={22} color="#3b82f6" /> Buscador de Órdenes de Compra (OC)
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                  Mostrando todas las OC registradas en el sistema de Droguería y Dental
                </p>
              </div>
              <button 
                onClick={cargarOcs} 
                className="btn-secondary" 
                style={{ padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            {/* Input Search Box */}
            <div style={{ position: 'relative', width: '100%', marginBottom: '25px' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar OC por número, proveedor, RUT o descripción de artículo..."
                className="input-field"
                style={{ paddingLeft: '48px', width: '100%' }}
              />
            </div>

            {/* Results */}
            {loading && ocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
                Cargando Órdenes de Compra...
              </div>
            ) : filteredOcs.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '50px 20px', 
                color: '#64748b', 
                border: '1px dashed var(--border-color)', 
                borderRadius: '12px' 
              }}>
                <ShoppingBag size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', margin: '0 0 4px 0' }}>No se encontraron coincidencias</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Intente buscar con otros términos o registre una OC en el módulo correspondiente.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {filteredOcs.map(oc => (
                  <div 
                    key={oc.id}
                    className="table-row"
                    style={{
                      background: 'rgba(255, 255, 255, 0.015)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '15px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Top Row: N° OC, Proveedor, Status, Dates */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'start', gap: '15px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#3b82f6' }}>{oc.numero_oc}</span>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.75rem', 
                            fontWeight: '700',
                            background: oc.estado === 'Enviada' ? 'rgba(59, 130, 246, 0.15)' : 
                                        oc.estado === 'Aceptada' ? 'rgba(16, 185, 129, 0.15)' : 
                                        oc.estado === 'Recepcionado' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.15)',
                            color: oc.estado === 'Enviada' ? '#3b82f6' : 
                                   oc.estado === 'Aceptada' ? '#10b981' : 
                                   oc.estado === 'Recepcionado' ? '#10b981' : '#f59e0b'
                          }}>
                            {oc.estado}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#cbd5e1', marginTop: '4px' }}>
                          {oc.proveedor} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '400' }}>(RUT: {oc.rut_proveedor || 'S/R'})</span>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'right' }}>
                        <div><strong>Enviada:</strong> {formatDate(oc.fecha_envio)}</div>
                        {oc.fecha_aceptacion && (
                          <div style={{ color: '#10b981', marginTop: '2px' }}><strong>Aceptada:</strong> {formatDate(oc.fecha_aceptacion)}</div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Articles list preview inside the card */}
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.01)', 
                      border: '1px solid rgba(255, 255, 255, 0.02)', 
                      borderRadius: '8px', 
                      padding: '12px 16px'
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                        Artículos en esta OC ({oc.ordenes_compra_articulos?.length || 0})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(oc.ordenes_compra_articulos || []).map((art, idx) => {
                          const artName = articulosCatalog[art.codigo_articulo] || `Cód ${art.codigo_articulo}`;
                          const hasFecha = art.fecha_almacenamiento;
                          const activeStatus = localStatuses[art.id] !== undefined ? localStatuses[art.id] : (art.estado || 'Pendiente');
                          
                          return (
                            <div key={idx} style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              fontSize: '0.85rem', 
                              color: '#cbd5e1',
                              padding: '8px 0',
                              borderBottom: idx < oc.ordenes_compra_articulos.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>[{art.codigo_articulo}]</span>
                                  <span style={{ fontWeight: '500' }}>{artName}</span>
                                </div>
                                {(() => {
                                  const historyEntries = Array.isArray(art.historial) && art.historial.length > 0
                                    ? art.historial
                                    : (art.fecha_almacenamiento ? [{ estado: art.estado || 'Pendiente', fecha_almacenamiento: art.fecha_almacenamiento }] : []);
                                  
                                  if (historyEntries.length === 0) return null;

                                  return (
                                    <div style={{ marginTop: '4px', paddingLeft: '6px', borderLeft: '2px solid rgba(255,255,255,0.06)' }}>
                                      {historyEntries.map((entry, eIdx) => {
                                        const displayState = 
                                          entry.estado === 'recepcion completa' ? 'Recepción Completa' :
                                          entry.estado === 'recepcion incompleta' ? 'Recepción Incompleta' :
                                          entry.estado === 'recepcionado' ? 'Recepcionado' :
                                          entry.estado === 'rechazado por vencimiento' ? 'Rechazado por Vencimiento' :
                                          entry.estado === 'rechazado por calidad' ? 'Rechazado por Calidad' : 'Pendiente';                                        
                                        return (
                                          <div key={eIdx} style={{ fontSize: '0.71rem', color: '#8892b0', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: '#3b82f6' }}></span>
                                            <strong style={{ color: '#cbd5e1' }}>{displayState}:</strong> {formatDateTime(entry.fecha_almacenamiento)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: '600', color: '#94a3b8' }}>
                                  {art.cantidad_recepcionada || 0} / {art.cantidad} uds.
                                </span>
                                <select
                                  value={activeStatus}
                                  onChange={(e) => handleStatusChange(art.id, e.target.value)}
                                  className="input-field"
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    width: 'auto',
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 
                                      activeStatus === 'recepcionado' ? 'rgba(59, 130, 246, 0.15)' :
                                      activeStatus === 'rechazado por vencimiento' ? 'rgba(239, 68, 68, 0.15)' :
                                      activeStatus === 'rechazado por calidad' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.05)',
                                    color: 
                                      activeStatus === 'recepcionado' ? '#3b82f6' :
                                      activeStatus?.startsWith('rechazado') ? '#ef4444' : '#94a3b8'
                                  }}
                                >
                                  <option value="Pendiente" style={{ background: '#1e293b' }}>Pendiente</option>
                                  <option value="recepcionado" style={{ background: '#1e293b' }}>Recepcionado</option>
                                  <option value="rechazado por vencimiento" style={{ background: '#1e293b' }}>Rechazado por Vencimiento</option>
                                  <option value="rechazado por calidad" style={{ background: '#1e293b' }}>Rechazado por Calidad</option>
                                </select>                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Save Button for OC Card */}
                    {(() => {
                      const hasChanges = (oc.ordenes_compra_articulos || []).some(
                        art => localStatuses[art.id] !== undefined && localStatuses[art.id] !== (art.estado || 'Pendiente')
                      );
                      if (!hasChanges) return null;
                      return (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'flex-end', 
                          marginTop: '15px', 
                          paddingTop: '15px', 
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)' 
                        }}>
                          <button
                            onClick={() => handleSaveOcReception(oc)}
                            disabled={guardandoOcId === oc.id}
                            className="btn-primary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 20px',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border: 'none',
                              color: '#ffffff',
                              cursor: 'pointer',
                              borderRadius: '10px',
                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {guardandoOcId === oc.id ? (
                              <>
                                <RefreshCw size={15} className="animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={15} />
                                Guardar Estado
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="cenabast-buscador"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-card"
            style={{ padding: '40px 20px', textAlign: 'center' }}
          >
            <div style={{ 
              maxWidth: '500px', 
              margin: '0 auto', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '20px' 
            }}>
              <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '50%', border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                <Activity size={44} color="#10b981" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px', color: '#f8fafc' }}>
                  Recepción de Cenabast
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                  El buscador y selector de guías Cenabast se encuentra actualmente en preparación.
                </p>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '12px', fontStyle: 'italic' }}>
                  Próximamente se integrará la consulta directa del catálogo y despachos programados de la Central de Abastecimiento.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecepcionArticulosModule;
