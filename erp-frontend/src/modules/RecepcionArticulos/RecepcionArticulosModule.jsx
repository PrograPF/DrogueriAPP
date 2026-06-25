import React, { useState, useEffect } from 'react';
import { 
  Truck, ClipboardList, Search, Activity, Calendar, FileText, 
  RefreshCw, CheckCircle, Clock, AlertTriangle, ArrowRight, ShoppingBag, 
  MapPin, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { formatDate } from '../../utils/dateFormatter';

const RecepcionArticulosModule = () => {
  const [activeMode, setActiveMode] = useState('oc'); // 'oc' | 'cenabast'
  const [loading, setLoading] = useState(false);
  const [ocs, setOcs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
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
            fecha_almacenamiento
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

  // Perform full article reception
  const handleRecepcionarArticulo = async (artId, ocId, currentCantidad) => {
    if (!window.confirm('¿Seguro que deseas marcar este artículo como RECEPCIONADO?')) return;
    try {
      const now = new Date().toISOString();
      
      // 1. Update the article details
      const { error: artErr } = await supabase
        .from('ordenes_compra_articulos')
        .update({
          cantidad_recepcionada: currentCantidad,
          estado: 'Recepcionado',
          fecha_almacenamiento: now
        })
        .eq('id', artId);

      if (artErr) throw artErr;

      // 2. Fetch parent OC with all its articles to check completeness
      const { data: updatedOcs, error: refreshErr } = await supabase
        .from('ordenes_compra')
        .select(`
          *,
          ordenes_compra_articulos (
            id,
            estado,
            cantidad,
            cantidad_recepcionada
          )
        `)
        .eq('id', ocId);

      if (refreshErr) throw refreshErr;

      const ocToCheck = updatedOcs?.[0];
      if (ocToCheck) {
        const allCompleted = (ocToCheck.ordenes_compra_articulos || []).every(
          art => art.estado === 'Recepcionado' || (art.cantidad_recepcionada || 0) >= (art.cantidad || 0)
        );

        if (allCompleted) {
          // Update parent OC status to 'Completada'
          const { error: ocErr } = await supabase
            .from('ordenes_compra')
            .update({ estado: 'Completada' })
            .eq('id', ocId);

          if (ocErr) throw ocErr;
          alert('Artículo recepcionado. ¡La OC se ha marcado como COMPLETADA!');
        } else {
          // If not all are completed, but we just received something, we can change the OC status to 'Aceptada'
          if (ocToCheck.estado === 'Enviada') {
            await supabase
              .from('ordenes_compra')
              .update({ estado: 'Aceptada', fecha_aceptacion: now })
              .eq('id', ocId);
          }
          alert('Artículo recepcionado correctamente.');
        }
      }

      await cargarOcs();
    } catch (err) {
      console.error('Error al recepcionar artículo:', err);
      alert('Error al recepcionar: ' + err.message);
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
                                        oc.estado === 'Completada' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.15)',
                            color: oc.estado === 'Enviada' ? '#3b82f6' : 
                                   oc.estado === 'Aceptada' ? '#10b981' : 
                                   oc.estado === 'Completada' ? '#10b981' : '#f59e0b'
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
                          const isRecepcionando = art.estado === 'Recepcionado';
                          
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
                                {isRecepcionando && art.fecha_almacenamiento && (
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    Almacenamiento: {formatDate(art.fecha_almacenamiento)}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: '600', color: '#94a3b8' }}>
                                  {art.cantidad_recepcionada || 0} / {art.cantidad} uds.
                                </span>
                                {isRecepcionando ? (
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    color: '#10b981', 
                                    background: 'rgba(16,185,129,0.1)', 
                                    padding: '3px 8px', 
                                    borderRadius: '6px', 
                                    fontWeight: '700' 
                                  }}>
                                    Recepcionado
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      color: '#f59e0b', 
                                      background: 'rgba(245,158,11,0.1)', 
                                      padding: '3px 8px', 
                                      borderRadius: '6px', 
                                      fontWeight: '700' 
                                    }}>
                                      {art.cantidad_recepcionada > 0 ? 'Parcial' : 'Pendiente'}
                                    </span>
                                    <button
                                      onClick={() => handleRecepcionarArticulo(art.id, oc.id, art.cantidad)}
                                      style={{
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: 'white',
                                        padding: '5px 12px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        boxShadow: '0 2px 5px rgba(16,185,129,0.2)'
                                      }}
                                    >
                                      <CheckCircle size={12} /> Recepcionar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
