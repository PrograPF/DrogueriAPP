import React, { useState, useEffect } from 'react';
import {
  Truck, ClipboardList, Search, Activity,
  RefreshCw, ShoppingBag, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { formatDate } from '../../utils/dateFormatter';
import { fetchArticulosCatalogMap } from '../../utils/catalogHelper';

const RecepcionArticulosModule = () => {
  const [activeMode, setActiveMode] = useState('oc'); // 'oc' | 'cenabast'
  const [loading, setLoading] = useState(false);
  const [ocs, setOcs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOcForModal, setSelectedOcForModal] = useState(null);
  const [activeTab, setActiveTab] = useState('articulos'); // 'articulos' | 'bitacora'
  const [comentarios, setComentarios] = useState([]);
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [guardandoComentario, setGuardandoComentario] = useState(false);

  // Articles catalog mapping for instant code -> name translation
  const [articulosCatalog, setArticulosCatalog] = useState({});

  // Fetch articles base catalog
  const cargarArticulosCatalog = async () => {
    const mapping = await fetchArticulosCatalogMap();
    setArticulosCatalog(mapping);
  };

  // Fetch OCs from Supabase — solo Enviadas o Aceptadas por el proveedor
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
            cantidad
          )
        `)
        .or('estado.eq.Enviada,estado.eq.Aceptada')
        .order('fecha_envio', { ascending: false });

      if (error) throw error;
      setOcs(data || []);
    } catch (err) {
      console.error('Error al cargar OCs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComentarios = async (ocId) => {
    if (!ocId) return;
    setLoadingComentarios(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra_comentarios')
        .select('*')
        .eq('oc_id', ocId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComentarios(data || []);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
    } finally {
      setLoadingComentarios(false);
    }
  };

  const handleAddComentario = async (e) => {
    if (e) e.preventDefault();
    if (!nuevoComentario.trim() || !selectedOcForModal) return;

    setGuardandoComentario(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra_comentarios')
        .insert([{ oc_id: selectedOcForModal.id, comentario: nuevoComentario.trim() }])
        .select();

      if (error) throw error;
      setComentarios(prev => [...prev, ...(data || [])]);
      setNuevoComentario('');
    } catch (err) {
      console.error('Error al guardar comentario:', err);
      alert('Error al guardar comentario: ' + err.message);
    } finally {
      setGuardandoComentario(false);
    }
  };

  useEffect(() => {
    if (selectedOcForModal) {
      fetchComentarios(selectedOcForModal.id);
      setActiveTab('articulos');
    } else {
      setComentarios([]);
      setNuevoComentario('');
    }
  }, [selectedOcForModal]);

  useEffect(() => {
    cargarOcs();
    cargarArticulosCatalog();
  }, []);

  // Filtrar OCs por búsqueda (el filtro de estado ya viene desde la query)
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
          <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Recepción en Bahía de Descarga</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '4px 0 0 0' }}>Registro de bultos recibidos y trazabilidad de Órdenes de Compra</p>
        </div>
      </div>

      {/* Two Large Action Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
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
              Consultar y registrar la llegada de bultos asociados a Órdenes de Compra enviadas o aceptadas por el proveedor.
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
        {activeMode === 'oc' && (
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
                  <Search size={22} color="#3b82f6" /> Buscador de Órdenes de Compra
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                  Mostrando OC en estado <strong style={{ color: '#3b82f6' }}>Enviada</strong> o <strong style={{ color: '#10b981' }}>Aceptada</strong> por el proveedor
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
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No hay OC en estado Enviada o Aceptada, o intente otros términos de búsqueda.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {filteredOcs.map(oc => (
                  <div
                    key={oc.id}
                    className="table-row"
                    onClick={() => setSelectedOcForModal(oc)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.015)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '15px',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.015)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                    }}
                  >
                    {/* Top Row: N° OC, Proveedor, Status, Dates */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'start', gap: '15px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#3b82f6' }}>{oc.numero_oc}</span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            background: oc.estado === 'Enviada' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: oc.estado === 'Enviada' ? '#3b82f6' : '#10b981'
                          }}>
                            {oc.estado}
                          </span>
                          {oc.tipo_oc === 'PEDIDO ESPECIAL' && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#c084fc',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              letterSpacing: '0.5px'
                            }}>
                              PEDIDO ESPECIAL
                            </span>
                          )}
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
                        <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#3b82f6', fontWeight: '600' }}>
                          {(oc.ordenes_compra_articulos || []).length} artículo(s) ➔ Ver detalle
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeMode === 'cenabast' && (
          <motion.div
            key="cenabast-buscador"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-card"
            style={{ padding: '40px 20px', textAlign: 'center' }}
          >
            <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
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

      {/* MODAL DE DETALLE DE OC */}
      <AnimatePresence>
        {selectedOcForModal && (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setSelectedOcForModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '700px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedOcForModal(null)}
                style={{
                  position: 'absolute', top: '20px', right: '20px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '50%', padding: '8px', cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s', outline: 'none'
                }}
              >
                <X size={18} />
              </button>

              {/* Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
                  <Truck size={24} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    OC: {selectedOcForModal.numero_oc}
                  </h3>
                </div>
              </div>

              {/* Details Info Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '15px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '25px',
                fontSize: '0.9rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Proveedor</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{selectedOcForModal.proveedor}</strong>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>RUT: {selectedOcForModal.rut_proveedor || 'No registrado'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Estado OC (Seguimiento)</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700',
                    background: selectedOcForModal.estado === 'Enviada' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: selectedOcForModal.estado === 'Enviada' ? '#3b82f6' : '#10b981',
                    display: 'inline-block', marginTop: '4px'
                  }}>
                    {selectedOcForModal.estado}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Fechas</span>
                  <strong style={{ color: 'var(--text-primary)' }}>Envío: {formatDate(selectedOcForModal.fecha_envio)}</strong>
                  {selectedOcForModal.fecha_aceptacion && (
                    <span style={{ display: 'block', color: '#10b981', fontSize: '0.8rem', marginTop: '2px' }}>
                      Aceptada: {formatDate(selectedOcForModal.fecha_aceptacion)}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs Navigation */}
              <div style={{
                display: 'flex', gap: '20px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '20px', paddingBottom: '2px'
              }}>
                <button
                  onClick={() => setActiveTab('articulos')}
                  style={{
                    background: 'none', border: 'none',
                    borderBottom: activeTab === 'articulos' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: activeTab === 'articulos' ? '#3b82f6' : 'var(--text-secondary)',
                    padding: '8px 4px', fontWeight: '700', fontSize: '0.95rem',
                    cursor: 'pointer', transition: 'all 0.2s', outline: 'none'
                  }}
                >
                  Artículos ({(selectedOcForModal.ordenes_compra_articulos || []).length})
                </button>
                <button
                  onClick={() => setActiveTab('bitacora')}
                  style={{
                    background: 'none', border: 'none',
                    borderBottom: activeTab === 'bitacora' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: activeTab === 'bitacora' ? '#3b82f6' : 'var(--text-secondary)',
                    padding: '8px 4px', fontWeight: '700', fontSize: '0.95rem',
                    cursor: 'pointer', transition: 'all 0.2s', outline: 'none'
                  }}
                >
                  Bitácora ({comentarios.length})
                </button>
              </div>

              {activeTab === 'articulos' ? (
                <>
                  {/* Artículos — vista de solo lectura, sin cambio de estado */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                      Artículos en esta OC ({(selectedOcForModal.ordenes_compra_articulos || []).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(selectedOcForModal.ordenes_compra_articulos || []).map((art, idx) => {
                        const artName = articulosCatalog[art.codigo_articulo] || `Cód ${art.codigo_articulo}`;
                        return (
                          <div key={idx} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem',
                            color: 'var(--text-primary)',
                            padding: '10px 0',
                            borderBottom: idx < selectedOcForModal.ordenes_compra_articulos.length - 1 ? '1px solid var(--border-color)' : 'none'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>[{art.codigo_articulo}]</span>
                                <span style={{ fontWeight: '600' }}>{artName}</span>
                              </div>
                            </div>
                            <div style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>
                              Cant. solicitada: {art.cantidad} uds.
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '25px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                    <button onClick={() => setSelectedOcForModal(null)} className="btn-secondary" style={{ minWidth: '100px' }}>
                      Cerrar
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Listado de Anotaciones */}
                  <div style={{
                    maxHeight: '230px', overflowY: 'auto',
                    background: 'rgba(0,0,0,0.15)', borderRadius: '10px', padding: '16px',
                    border: '1px solid var(--border-color)',
                    display: 'flex', flexDirection: 'column', gap: '12px'
                  }}>
                    {loadingComentarios ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                        Cargando bitácora...
                      </div>
                    ) : comentarios.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
                        No hay anotaciones registradas en la bitácora de esta OC.
                      </div>
                    ) : (
                      comentarios.map((com, index) => (
                        <div key={com.id || index} style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px', padding: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: '700', color: '#3b82f6' }}>Anotación #{index + 1}</span>
                            <span>{com.created_at ? new Date(com.created_at).toLocaleString('es-CL') : ''}</span>
                          </div>
                          <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                            {com.comentario}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Nueva Anotación */}
                  <form onSubmit={handleAddComentario} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                      placeholder="Escribe una observación o comentario sobre esta OC..."
                      value={nuevoComentario}
                      onChange={(e) => setNuevoComentario(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%', background: 'var(--input-bg)',
                        border: '1px solid var(--border-color)', borderRadius: '8px',
                        padding: '12px', color: 'var(--text-primary)',
                        fontSize: '0.85rem', resize: 'none', outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                      <button type="button" onClick={() => setSelectedOcForModal(null)} className="btn-secondary" style={{ padding: '8px 20px', fontSize: '0.8rem' }}>
                        Cerrar
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '0.8rem', minWidth: '130px' }}
                        disabled={guardandoComentario || !nuevoComentario.trim()}
                      >
                        {guardandoComentario ? 'Guardando...' : 'Agregar Anotación'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecepcionArticulosModule;
