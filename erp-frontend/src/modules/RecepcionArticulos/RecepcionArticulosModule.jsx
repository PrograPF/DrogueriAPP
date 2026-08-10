import React, { useState, useEffect } from 'react';
import {
  Truck, ClipboardList, Search, Activity,
  RefreshCw, ShoppingBag, X, Save, CheckCircle,
  AlertTriangle, Clock, XCircle, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { formatDate } from '../../utils/dateFormatter';
import { fetchArticulosCatalogMap } from '../../utils/catalogHelper';

// ─── Helpers de estado ────────────────────────────────────────────────────────

/**
 * Calcula el estado_recepcion de una OC a partir de los estados
 * individuales de sus artículos (Sistema 2).
 * Reglas:
 *   - Todos Recepcionado | Revisado            → 'Recepcion Completa'
 *   - Todos Rechazado                          → 'Rechazo'
 *   - Al menos 1 (Recepcionado | Revisado) + al menos 1 Rechazado → 'Recepcion Parcial/Rechazo'
 *   - Al menos 1 Pendiente, ningún Rechazado   → 'Recepcion Parcial'
 */
function calcularEstadoRecepcionOc(articulos) {
  if (!articulos || articulos.length === 0) return null;

  const estados = articulos.map(a => a.estado_recepcion || 'Pendiente');

  const todosPendientes  = estados.every(e => e === 'Pendiente');
  const todosListos      = estados.every(e => e === 'Recepcionado' || e === 'Revisado');
  const todosRechazados  = estados.every(e => e === 'Rechazado');
  const hayRecepcionado  = estados.some(e => e === 'Recepcionado' || e === 'Revisado');
  const hayRechazado     = estados.some(e => e === 'Rechazado');

  if (todosPendientes)                    return null;
  if (todosListos)                        return 'Recepcion Completa';
  if (todosRechazados)                    return 'Rechazo';
  if (hayRecepcionado && hayRechazado)    return 'Recepcion Parcial/Rechazo';
  if (hayRecepcionado)                    return 'Recepcion Parcial';
  if (hayRechazado)                       return 'Recepcion Parcial/Rechazo';
  return null;
}

const ESTADO_ART_CONFIG = {
  'Pendiente':     { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  icon: Clock,        label: 'Pendiente'    },
  'Recepcionado':  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: CheckCircle,  label: 'Recepcionado' },
  'Revisado':      { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle,  label: 'Revisado'     },
  'Rechazado':     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: XCircle,      label: 'Rechazado'    },
};

const ESTADO_OC_CONFIG = {
  'Recepcion Completa':        { color: '#10b981', bg: 'rgba(16,185,129,0.15)',  label: 'Recepción Completa'        },
  'Recepcion Parcial':         { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Recepción Parcial'         },
  'Rechazo':                   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  label: 'Rechazo'                   },
  'Recepcion Parcial/Rechazo': { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'Recepción Parcial/Rechazo' },
};

// ─── Componente principal ─────────────────────────────────────────────────────

const RecepcionArticulosModule = () => {
  const [activeMode, setActiveMode] = useState('oc'); // 'oc' | 'cenabast'
  const [loading, setLoading] = useState(false);
  const [ocs, setOcs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOcForModal, setSelectedOcForModal] = useState(null);
  const [activeTab, setActiveTab] = useState('articulos');

  // Estados locales por artículo (solo en memoria mientras no se guarda)
  const [localEstados, setLocalEstados] = useState({});
  const [guardando, setGuardando] = useState(false);

  // Bitácora
  const [comentarios, setComentarios] = useState([]);
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [guardandoComentario, setGuardandoComentario] = useState(false);

  const [articulosCatalog, setArticulosCatalog] = useState({});

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const cargarArticulosCatalog = async () => {
    const mapping = await fetchArticulosCatalogMap();
    setArticulosCatalog(mapping);
  };

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
            estado_recepcion,
            fecha_recepcion
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

  // ── Guardar recepción ───────────────────────────────────────────────────────

  const handleGuardarRecepcion = async () => {
    if (!selectedOcForModal) return;

    const arts = selectedOcForModal.ordenes_compra_articulos || [];
    const cambiados = arts.filter(
      art => localEstados[art.id] !== undefined &&
             localEstados[art.id] !== (art.estado_recepcion || 'Pendiente')
    );

    if (cambiados.length === 0) {
      alert('No hay cambios pendientes para guardar.');
      return;
    }

    setGuardando(true);
    try {
      const now = new Date().toISOString();

      // 1. Actualizar estado_recepcion de cada artículo cambiado
      for (const art of cambiados) {
        const nuevoEstado = localEstados[art.id];
        const { error } = await supabase
          .from('ordenes_compra_articulos')
          .update({
            estado_recepcion: nuevoEstado,
            fecha_recepcion: nuevoEstado !== 'Pendiente' ? now : null,
          })
          .eq('id', art.id);
        if (error) throw error;
      }

      // 2. Leer todos los artículos actualizados de la OC para calcular el estado global
      const { data: artActualizados, error: refErr } = await supabase
        .from('ordenes_compra_articulos')
        .select('id, estado_recepcion')
        .eq('oc_id', selectedOcForModal.id);

      if (refErr) throw refErr;

      // Construir la vista consolidada (combinar DB + cambios locales recién guardados)
      const estadoGlobal = calcularEstadoRecepcionOc(artActualizados);

      // 3. Actualizar estado_recepcion de la OC (Sistema 2 únicamente)
      const { error: ocErr } = await supabase
        .from('ordenes_compra')
        .update({ estado_recepcion: estadoGlobal })
        .eq('id', selectedOcForModal.id);
      if (ocErr) throw ocErr;

      // 4. Limpiar estados locales y recargar
      setLocalEstados({});
      await cargarOcs();

      // Refrescar el modal con datos frescos
      const { data: ocFresh } = await supabase
        .from('ordenes_compra')
        .select(`
          *,
          ordenes_compra_articulos (
            id,
            codigo_articulo,
            cantidad,
            estado_recepcion,
            fecha_recepcion
          )
        `)
        .eq('id', selectedOcForModal.id)
        .single();

      if (ocFresh) setSelectedOcForModal(ocFresh);

      alert(`✅ Recepción guardada.\nEstado de la OC: ${estadoGlobal || 'Sin cambio'}`);
    } catch (err) {
      console.error('Error al guardar recepción:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setGuardando(false);
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
      alert('Error al guardar comentario: ' + err.message);
    } finally {
      setGuardandoComentario(false);
    }
  };

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (selectedOcForModal) {
      fetchComentarios(selectedOcForModal.id);
      setActiveTab('articulos');
      setLocalEstados({});
    } else {
      setComentarios([]);
      setNuevoComentario('');
      setLocalEstados({});
    }
  }, [selectedOcForModal?.id]);

  useEffect(() => {
    cargarOcs();
    cargarArticulosCatalog();
  }, []);

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  const filteredOcs = ocs.filter(oc => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchesOc   = oc.numero_oc.toLowerCase().includes(q);
    const matchesProv = oc.proveedor.toLowerCase().includes(q);
    const matchesArt  = (oc.ordenes_compra_articulos || []).some(art => {
      const code = (art.codigo_articulo || '').toLowerCase();
      const name = (articulosCatalog[art.codigo_articulo] || '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
    return matchesOc || matchesProv || matchesArt;
  });

  // ── Render helpers ───────────────────────────────────────────────────────────

  const EstadoBadge = ({ estado, tipo = 'art' }) => {
    const cfg = tipo === 'oc'
      ? ESTADO_OC_CONFIG[estado]
      : ESTADO_ART_CONFIG[estado || 'Pendiente'];
    if (!cfg) return null;
    return (
      <span style={{
        padding: '2px 10px', borderRadius: '6px',
        fontSize: '0.72rem', fontWeight: '700',
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}30`,
        whiteSpace: 'nowrap'
      }}>
        {cfg.label || estado}
      </span>
    );
  };

  // Resumen rápido de artículos en una OC para la tarjeta de lista
  const ResumenArts = ({ arts }) => {
    const counts = { Pendiente: 0, Recepcionado: 0, Revisado: 0, Rechazado: 0 };
    (arts || []).forEach(a => {
      const e = a.estado_recepcion || 'Pendiente';
      if (counts[e] !== undefined) counts[e]++;
    });
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
        {Object.entries(counts).filter(([, v]) => v > 0).map(([estado, n]) => (
          <span key={estado} style={{
            fontSize: '0.72rem', fontWeight: '700',
            color: ESTADO_ART_CONFIG[estado]?.color,
            background: ESTADO_ART_CONFIG[estado]?.bg,
            padding: '1px 8px', borderRadius: '5px'
          }}>
            {estado}: {n}
          </span>
        ))}
      </div>
    );
  };

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px' }}>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '35px' }}>
        <div style={{ padding: '12px', background: 'rgba(59,130,246,0.1)', borderRadius: '14px', border: '1px solid rgba(59,130,246,0.15)' }}>
          <ClipboardList size={32} color="#3b82f6" />
        </div>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Recepción en Bahía de Descarga</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '4px 0 0 0' }}>Registro de artículos recibidos y control de estado de Órdenes de Compra</p>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '35px' }}>

        {/* OC */}
        <button
          onClick={() => setActiveMode('oc')}
          style={{
            background: activeMode === 'oc'
              ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)'
              : 'rgba(30,41,59,0.4)',
            border: activeMode === 'oc' ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.05)',
            borderRadius: '16px', padding: '24px', textAlign: 'left', cursor: 'pointer',
            color: '#ffffff', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: activeMode === 'oc' ? '0 10px 25px -5px rgba(59,130,246,0.15)' : 'none',
            display: 'flex', alignItems: 'start', gap: '18px'
          }}
          onMouseOver={e => { if (activeMode !== 'oc') { e.currentTarget.style.border = '2px solid rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(30,41,59,0.6)'; }}}
          onMouseOut={e  => { if (activeMode !== 'oc') { e.currentTarget.style.border = '2px solid rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(30,41,59,0.4)'; }}}
        >
          <div style={{ padding: '12px', background: activeMode === 'oc' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)', borderRadius: '12px', color: activeMode === 'oc' ? '#3b82f6' : '#94a3b8', transition: 'all 0.3s' }}>
            <Truck size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 6px 0', color: activeMode === 'oc' ? '#3b82f6' : '#f8fafc' }}>Recepción de OC</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
              Registrar estado de artículos de OC enviadas o aceptadas por el proveedor.
            </p>
          </div>
        </button>

        {/* Cenabast */}
        <button
          onClick={() => setActiveMode('cenabast')}
          style={{
            background: activeMode === 'cenabast'
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)'
              : 'rgba(30,41,59,0.4)',
            border: activeMode === 'cenabast' ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.05)',
            borderRadius: '16px', padding: '24px', textAlign: 'left', cursor: 'pointer',
            color: '#ffffff', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: activeMode === 'cenabast' ? '0 10px 25px -5px rgba(16,185,129,0.15)' : 'none',
            display: 'flex', alignItems: 'start', gap: '18px'
          }}
          onMouseOver={e => { if (activeMode !== 'cenabast') { e.currentTarget.style.border = '2px solid rgba(16,185,129,0.4)'; e.currentTarget.style.background = 'rgba(30,41,59,0.6)'; }}}
          onMouseOut={e  => { if (activeMode !== 'cenabast') { e.currentTarget.style.border = '2px solid rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(30,41,59,0.4)'; }}}
        >
          <div style={{ padding: '12px', background: activeMode === 'cenabast' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)', borderRadius: '12px', color: activeMode === 'cenabast' ? '#10b981' : '#94a3b8', transition: 'all 0.3s' }}>
            <Activity size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 6px 0', color: activeMode === 'cenabast' ? '#10b981' : '#f8fafc' }}>Recepción de Cenabast</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
              Registrar recepciones de despachos Cenabast.
            </p>
          </div>
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">

        {/* ── Modo OC ── */}
        {activeMode === 'oc' && (
          <motion.div key="oc-mode" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="glass-card" style={{ padding: '30px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={22} color="#3b82f6" /> Órdenes de Compra
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                  Registro y recepción física de mercancía en bahía de descarga
                </p>
              </div>
              <button onClick={cargarOcs} className="btn-secondary" style={{ padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            {/* Búsqueda */}
            <div style={{ position: 'relative', width: '100%', marginBottom: '25px' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
              <input
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por N° OC, proveedor o artículo..."
                className="input-field" style={{ paddingLeft: '48px', width: '100%' }}
              />
            </div>

            {/* Resultados */}
            {loading && ocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
                Cargando Órdenes de Compra...
              </div>
            ) : filteredOcs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                <ShoppingBag size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', margin: '0 0 4px 0' }}>Sin coincidencias</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No hay OC en estado Enviada o Aceptada, o prueba otros términos.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredOcs.map(oc => {
                  const estadoRecepOc = oc.estado_recepcion;
                  const ocCfg = estadoRecepOc ? ESTADO_OC_CONFIG[estadoRecepOc] : null;
                  return (
                    <div
                      key={oc.id}
                      onClick={() => setSelectedOcForModal(oc)}
                      style={{
                        background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '12px', padding: '18px 20px',
                        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
                        alignItems: 'flex-start', gap: '14px', cursor: 'pointer', transition: 'all 0.2s ease'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'; }}
                      onMouseOut={e  => { e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#3b82f6' }}>{oc.numero_oc}</span>
                          {/* Estado Recepción (Sistema 2) */}
                          {ocCfg && (
                            <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', background: ocCfg.bg, color: ocCfg.color, border: `1px solid ${ocCfg.color}40` }}>
                              {ocCfg.label}
                            </span>
                          )}
                          {oc.tipo_oc === 'PEDIDO ESPECIAL' && (
                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>
                              PEDIDO ESPECIAL
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#cbd5e1', marginTop: '4px' }}>
                          {oc.proveedor} <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '400' }}>(RUT: {oc.rut_proveedor || 'S/R'})</span>
                        </div>
                        <ResumenArts arts={oc.ordenes_compra_articulos} />
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: '700' }}>
                          {(oc.ordenes_compra_articulos || []).length} artículo(s) → Gestionar
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Modo Cenabast ── */}
        {activeMode === 'cenabast' && (
          <motion.div key="cenabast-mode" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="glass-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{ padding: '20px', background: 'rgba(16,185,129,0.05)', borderRadius: '50%', border: '1px dashed rgba(16,185,129,0.3)' }}>
                <Activity size={44} color="#10b981" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px', color: '#f8fafc' }}>Recepción de Cenabast</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>Próximamente disponible.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {selectedOcForModal && (
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
            onClick={() => setSelectedOcForModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px', width: '100%', maxWidth: '780px', padding: '28px', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.7)', position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button onClick={() => setSelectedOcForModal(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}>
                <X size={18} />
              </button>

              {/* Modal title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <div style={{ padding: '10px', background: 'rgba(59,130,246,0.1)', borderRadius: '12px' }}>
                  <Truck size={26} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0 }}>OC: {selectedOcForModal.numero_oc}</h3>
                  {selectedOcForModal.estado_recepcion && (() => {
                    const cfg = ESTADO_OC_CONFIG[selectedOcForModal.estado_recepcion];
                    return cfg ? (
                      <div style={{ marginTop: '6px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                          Recepción: {cfg.label}
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', marginBottom: '22px', fontSize: '0.88rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Proveedor</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedOcForModal.proveedor}</strong>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '1px' }}>RUT: {selectedOcForModal.rut_proveedor || 'S/R'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Total Artículos</span>
                  <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>{(selectedOcForModal.ordenes_compra_articulos || []).length} artículo(s)</strong>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', paddingBottom: '2px' }}>
                {[['articulos', `Artículos (${(selectedOcForModal.ordenes_compra_articulos || []).length})`], ['bitacora', `Bitácora (${comentarios.length})`]].map(([key, label]) => (
                  <button key={key} onClick={() => setActiveTab(key)} style={{ background: 'none', border: 'none', borderBottom: activeTab === key ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === key ? '#3b82f6' : 'var(--text-secondary)', padding: '8px 4px', fontWeight: '700', fontSize: '0.92rem', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab: Artículos */}
              {activeTab === 'articulos' && (() => {
                const arts = selectedOcForModal.ordenes_compra_articulos || [];
                const hayPendingChanges = arts.some(
                  art => localEstados[art.id] !== undefined && localEstados[art.id] !== (art.estado_recepcion || 'Pendiente')
                );

                // Preview del estado global si se guarda ahora
                const estadosPreview = arts.map(art => ({
                  estado_recepcion: localEstados[art.id] !== undefined ? localEstados[art.id] : (art.estado_recepcion || 'Pendiente')
                }));
                const estadoGlobalPreview = calcularEstadoRecepcionOc(estadosPreview);
                const cfgPreview = estadoGlobalPreview ? ESTADO_OC_CONFIG[estadoGlobalPreview] : null;

                return (
                  <>
                    {/* Preview estado OC */}
                    {cfgPreview && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 14px', background: `${cfgPreview.color}10`, borderRadius: '10px', border: `1px solid ${cfgPreview.color}30` }}>
                        <Package size={16} color={cfgPreview.color} />
                        <span style={{ fontSize: '0.82rem', color: cfgPreview.color, fontWeight: '700' }}>
                          Estado de recepción de la OC: {cfgPreview.label}
                          {hayPendingChanges && <span style={{ fontWeight: '400', opacity: 0.8 }}> (preview — sin guardar)</span>}
                        </span>
                      </div>
                    )}

                    {/* Lista artículos */}
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Artículos — selecciona el estado de cada uno
                      </div>
                      {arts.map((art, idx) => {
                        const artName = articulosCatalog[art.codigo_articulo] || `Cód ${art.codigo_articulo}`;
                        const estadoActivo = localEstados[art.id] !== undefined ? localEstados[art.id] : (art.estado_recepcion || 'Pendiente');
                        const cfg = ESTADO_ART_CONFIG[estadoActivo] || ESTADO_ART_CONFIG['Pendiente'];
                        const cambiado = localEstados[art.id] !== undefined && localEstados[art.id] !== (art.estado_recepcion || 'Pendiente');

                        return (
                          <div key={art.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '14px 16px', gap: '12px', flexWrap: 'wrap',
                            borderBottom: idx < arts.length - 1 ? '1px solid var(--border-color)' : 'none',
                            background: cambiado ? 'rgba(59,130,246,0.03)' : 'transparent',
                            transition: 'background 0.2s'
                          }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.88rem',
                                  fontWeight: '800',
                                  color: '#38bdf8',
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontFamily: 'monospace',
                                  letterSpacing: '0.5px'
                                }}>
                                  [{art.codigo_articulo}]
                                </span>
                                <span style={{ fontWeight: '700', fontSize: '0.92rem' }}>{artName}</span>
                                {cambiado && <span style={{ fontSize: '0.68rem', color: '#3b82f6', fontWeight: '700', background: 'rgba(59,130,246,0.1)', padding: '1px 6px', borderRadius: '4px' }}>modificado</span>}
                              </div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Cantidad: <strong style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{art.cantidad} uds.</strong>
                                {art.fecha_recepcion && <span style={{ marginLeft: '10px' }}>Recibido: {new Date(art.fecha_recepcion).toLocaleDateString('es-CL')}</span>}
                              </div>
                            </div>

                            {/* Selector de estado */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {['Pendiente', 'Recepcionado', 'Rechazado'].map(estado => {
                                const eCfg = ESTADO_ART_CONFIG[estado];
                                const activo = estadoActivo === estado;
                                return (
                                  <button
                                    key={estado}
                                    onClick={() => setLocalEstados(prev => ({ ...prev, [art.id]: estado }))}
                                    style={{
                                      padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700',
                                      cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
                                      background: activo ? eCfg.bg : 'rgba(255,255,255,0.03)',
                                      border: activo ? `1.5px solid ${eCfg.color}` : '1.5px solid rgba(255,255,255,0.08)',
                                      color: activo ? eCfg.color : '#64748b',
                                      transform: activo ? 'scale(1.04)' : 'scale(1)'
                                    }}
                                  >
                                    {eCfg.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botones */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--border-color)' }}>
                      <button onClick={() => setSelectedOcForModal(null)} className="btn-secondary" style={{ minWidth: '90px' }}>Cerrar</button>
                      <button
                        onClick={handleGuardarRecepcion}
                        disabled={guardando || !hayPendingChanges}
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '170px', opacity: !hayPendingChanges ? 0.5 : 1, cursor: !hayPendingChanges ? 'not-allowed' : 'pointer' }}
                      >
                        <Save size={16} />
                        {guardando ? 'Guardando...' : 'Guardar Recepción'}
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* Tab: Bitácora */}
              {activeTab === 'bitacora' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ maxHeight: '230px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {loadingComentarios ? (
                      <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>Cargando bitácora...</div>
                    ) : comentarios.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px', fontSize: '0.88rem' }}>Sin anotaciones en esta OC.</div>
                    ) : comentarios.map((com, i) => (
                      <div key={com.id || i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: '700', color: '#3b82f6' }}>Anotación #{i + 1}</span>
                          <span>{com.created_at ? new Date(com.created_at).toLocaleString('es-CL') : ''}</span>
                        </div>
                        <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{com.comentario}</div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleAddComentario} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                      placeholder="Escribe una observación sobre esta OC..."
                      value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)} rows={3}
                      style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'none', outline: 'none', transition: 'border-color 0.2s' }}
                      onFocus={e => e.target.style.borderColor = '#3b82f6'}
                      onBlur={e  => e.target.style.borderColor = 'var(--border-color)'}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button type="button" onClick={() => setSelectedOcForModal(null)} className="btn-secondary" style={{ padding: '8px 18px', fontSize: '0.82rem' }}>Cerrar</button>
                      <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.82rem', minWidth: '130px' }} disabled={guardandoComentario || !nuevoComentario.trim()}>
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
