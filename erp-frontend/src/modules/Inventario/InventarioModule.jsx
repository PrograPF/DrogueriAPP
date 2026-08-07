import React, { useState, useEffect } from 'react';
import { 
  Search, Package, History, Calendar, ClipboardList, RefreshCw, 
  AlertTriangle, TrendingUp, User, Truck, ShieldAlert, ArrowRight, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { formatDate, formatDateTime } from '../../utils/dateFormatter';

const InventarioModule = () => {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'trazabilidad'
  const [loading, setLoading] = useState(false);
  
  // Datos crudos de la BD
  const [articulos, setArticulos] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [revisiones, setRevisiones] = useState([]);
  const [ordenesCompra, setOrdenesCompra] = useState([]);
  const [categorias, setCategorias] = useState([]);

  // Estados para comentarios de lotes/variantes
  const [comentariosVariantes, setComentariosVariantes] = useState([]);
  const [selectedLoteForModal, setSelectedLoteForModal] = useState(null);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [usuarioFirma, setUsuarioFirma] = useState(localStorage.getItem('firma_operador') || '');
  const [guardandoComentario, setGuardandoComentario] = useState(false);
  
  // Buscadores
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [trazabilidadSearchQuery, setTrazabilidadSearchQuery] = useState('');
  
  // Artículos expandidos en el acordeón de Stock
  const [expandedArticles, setExpandedArticles] = useState({});
  // Artículos expandidos en el acordeón de Trazabilidad
  const [expandedTrazabilidad, setExpandedTrazabilidad] = useState({});

  // Cargar todos los datos necesarios
  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Obtener catálogo de artículos
      const { data: artsData, error: artsErr } = await supabase
        .from('articulos')
        .select('*')
        .range(0, 9999)
        .order('descripcion');
      if (artsErr) throw artsErr;

      // 2. Obtener variantes de artículos (lotes/inventario físico)
      const { data: varData, error: varErr } = await supabase
        .from('articulos_variantes')
        .select('*');
      if (varErr) throw varErr;

      // 3. Obtener revisiones de bodega (historial de ingresos de lotes)
      const { data: revData, error: revErr } = await supabase
        .from('revisiones_bodega')
        .select('*')
        .order('created_at', { ascending: false });
      if (revErr) throw revErr;

      // 4. Obtener proveedores de OCs para cruzar en trazabilidad
      const { data: ocData, error: ocErr } = await supabase
        .from('ordenes_compra')
        .select('numero_oc, proveedor');
      if (ocErr) throw ocErr;

      // 5. Obtener categorías para cruzar el tipo (Fármaco o Dispositivo Médico)
      const { data: catData, error: catErr } = await supabase
        .from('categorias')
        .select('*');
      if (catErr) throw catErr;

      // 6. Obtener comentarios de variantes (lotes)
      const { data: comData, error: comErr } = await supabase
        .from('articulos_variantes_comentarios')
        .select('*')
        .order('created_at', { ascending: true });
      if (comErr) throw comErr;

      setArticulos(artsData || []);
      setVariantes(varData || []);
      setRevisiones(revData || []);
      setOrdenesCompra(ocData || []);
      setCategorias(catData || []);
      setComentariosVariantes(comData || []);
    } catch (err) {
      console.error('Error al cargar datos de inventario:', err);
      alert('Error al cargar los datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleAbrirBitacoraLote = (lote) => {
    setSelectedLoteForModal(lote);
    setNuevoComentario('');
  };

  const handleAddComentarioLote = async (e) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || !usuarioFirma.trim() || !selectedLoteForModal) return;

    setGuardandoComentario(true);
    try {
      // Guardar firma en localStorage
      localStorage.setItem('firma_operador', usuarioFirma.trim());

      const { error } = await supabase
        .from('articulos_variantes_comentarios')
        .insert([
          {
            variante_id: selectedLoteForModal.id,
            comentario: nuevoComentario.trim(),
            usuario: usuarioFirma.trim()
          }
        ]);

      if (error) throw error;

      // Recargar comentarios
      const { data: newComData, error: newComErr } = await supabase
        .from('articulos_variantes_comentarios')
        .select('*')
        .order('created_at', { ascending: true });
      if (newComErr) throw newComErr;

      setComentariosVariantes(newComData || []);
      setNuevoComentario('');
    } catch (err) {
      console.error('Error al guardar comentario del lote:', err);
      alert('Error al guardar el comentario: ' + err.message);
    } finally {
      setGuardandoComentario(false);
    }
  };

  const toggleExpandArticle = (codigo) => {
    setExpandedArticles(prev => ({
      ...prev,
      [codigo]: !prev[codigo]
    }));
  };

  const toggleExpandTrazabilidad = (codigo) => {
    setExpandedTrazabilidad(prev => ({
      ...prev,
      [codigo]: !prev[codigo]
    }));
  };

  // --- PROCESAMIENTO EN MEMORIA ---

  // Mapear descripción de artículos
  const articulosMap = {};
  articulos.forEach(art => {
    if (art && art.codigo) {
      const rawCode = String(art.codigo).trim();
      const cleanCode = rawCode.replace(/^0+/, '');
      articulosMap[rawCode] = art.descripcion;
      if (cleanCode) {
        articulosMap[cleanCode] = art.descripcion;
        articulosMap[cleanCode.padStart(4, '0')] = art.descripcion;
        articulosMap[cleanCode.padStart(6, '0')] = art.descripcion;
      }
    }
  });

  // Mapear proveedores de órdenes de compra
  const ocProveedoresMap = {};
  ordenesCompra.forEach(oc => {
    if (oc.numero_oc) {
      ocProveedoresMap[oc.numero_oc.trim()] = oc.proveedor;
    }
  });

  // Mapear categorías
  const categoriasMap = {};
  categorias.forEach(cat => {
    categoriasMap[cat.id] = cat.nombre;
  });

  // Agrupar variantes por artículo
  const variantesPorArticulo = {};
  variantes.forEach(v => {
    const codigo = v.codigo_articulo?.trim();
    if (codigo) {
      if (!variantesPorArticulo[codigo]) {
        variantesPorArticulo[codigo] = [];
      }
      variantesPorArticulo[codigo].push(v);
    }
  });

  // Agrupar comentarios por variante_id
  const comentariosPorVariante = {};
  comentariosVariantes.forEach(c => {
    const varId = c.variante_id;
    if (varId) {
      if (!comentariosPorVariante[varId]) {
        comentariosPorVariante[varId] = [];
      }
      comentariosPorVariante[varId].push(c);
    }
  });

  // Calcular métricas
  const totalArticulosConStock = Object.keys(variantesPorArticulo).length;
  const totalLotesUnicos = variantes.filter(v => v.lote && v.lote !== 'S/L').length;
  
  let totalStockGlobal = 0;
  let lotesPorVencer = 0; // Vence en los próximos 6 meses
  let lotesVencidos = 0;
  const hoy = new Date();
  const seisMesesMas = new Date();
  seisMesesMas.setMonth(hoy.getMonth() + 6);

  variantes.forEach(v => {
    totalStockGlobal += v.cantidad || 0;
    if (v.vencimiento) {
      const fechaVenc = new Date(v.vencimiento);
      if (fechaVenc < hoy) {
        lotesVencidos++;
      } else if (fechaVenc >= hoy && fechaVenc <= seisMesesMas) {
        lotesPorVencer++;
      }
    }
  });

  // Función para clasificar estado de vencimiento
  const getVencimientoStatus = (fechaString) => {
    if (!fechaString) return { label: 'Sin Venc.', color: '#94a3b8', bg: 'rgba(255,255,255,0.05)' };
    const fechaVenc = new Date(fechaString);
    if (fechaVenc < hoy) {
      return { label: 'VENCIDO', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239,68,68,0.3)' };
    }
    if (fechaVenc <= seisMesesMas) {
      return { label: 'POR VENCER', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245,158,11,0.3)' };
    }
    return { label: 'VIGENTE', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16,185,129,0.3)' };
  };

  // --- FILTROS ---

  // Filtrar artículos para la pestaña 1 (Stock)
  const filteredArticulos = articulos.filter(art => {
    const q = stockSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      art.codigo?.toLowerCase().includes(q) || 
      art.descripcion?.toLowerCase().includes(q)
    );
  }).map(art => {
    const code = art.codigo?.trim();
    const items = variantesPorArticulo[code] || [];
    const stockTotal = items.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
    const categoriaNombre = art.categoria_id ? (categoriasMap[art.categoria_id] || 'Sin Categoría') : 'Sin Categoría';
    return {
      ...art,
      categoriaNombre,
      variantes: items,
      stockTotal
    };
  });

  // Filtrar revisiones para la pestaña 2 (Trazabilidad)
  const filteredTrazabilidad = revisiones.filter(rev => {
    const q = trazabilidadSearchQuery.toLowerCase().trim();
    if (!q) return true;
    
    const artName = (articulosMap[rev.codigo_articulo?.trim()] || '').toLowerCase();
    return (
      rev.lote?.toLowerCase().includes(q) ||
      rev.codigo_articulo?.toLowerCase().includes(q) ||
      artName.includes(q) ||
      rev.numero_oc?.toLowerCase().includes(q) ||
      (rev.numero_documento && rev.numero_documento.toLowerCase().includes(q))
    );
  }).map(rev => {
    const ocNum = rev.numero_oc?.trim();
    const proveedor = ocNum ? (ocProveedoresMap[ocNum] || 'No especificado') : 'Ingreso Directo';
    const artName = articulosMap[rev.codigo_articulo?.trim()] || `Artículo [${rev.codigo_articulo}]`;
    return {
      ...rev,
      articulo_descripcion: artName,
      proveedor
    };
  });

  // Agrupar revisiones por código de artículo para evitar repetir el nombre del artículo
  const trazabilidadAgrupada = {};
  filteredTrazabilidad.forEach(rev => {
    const code = rev.codigo_articulo?.trim();
    if (code) {
      if (!trazabilidadAgrupada[code]) {
        trazabilidadAgrupada[code] = {
          codigo: code,
          descripcion: rev.articulo_descripcion,
          ingresos: []
        };
      }
      trazabilidadAgrupada[code].ingresos.push(rev);
    }
  });
  const listadoTrazabilidad = Object.values(trazabilidadAgrupada);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '35px' }}>
        <div style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '14px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
          <Package size={32} color="#a855f7" />
        </div>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Inventario de Artículos</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '4px 0 0 0' }}>Gestión centralizada de stock, lotes, vencimientos y trazabilidad de origen</p>
        </div>
      </div>

      {/* KPI Stats Widgets */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '20px', 
        marginBottom: '35px' 
      }}>
        {/* KPI 1: Lotes por Vencer */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.015)', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', margin: 0, letterSpacing: '0.5px' }}>Por Vencer (Próximos 6 Meses)</h4>
            <p style={{ fontSize: '1.45rem', fontWeight: '800', color: '#f59e0b', margin: '2px 0 0 0' }}>{lotesPorVencer} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '400' }}>lotes</span></p>
          </div>
        </div>

        {/* KPI 2: Lotes Vencidos */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.015)', borderLeft: '3px solid #ef4444' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', margin: 0, letterSpacing: '0.5px' }}>Lotes Vencidos</h4>
            <p style={{ fontSize: '1.45rem', fontWeight: '800', color: '#ef4444', margin: '2px 0 0 0' }}>{lotesVencidos} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '400' }}>lotes</span></p>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('stock')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'stock' ? '2px solid #a855f7' : 'none',
            color: activeTab === 'stock' ? '#a855f7' : '#94a3b8',
            fontSize: '1.05rem',
            fontWeight: '700',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Package size={18} /> Stock Físico y Lotes
        </button>
        <button
          onClick={() => setActiveTab('trazabilidad')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'trazabilidad' ? '2px solid #a855f7' : 'none',
            color: activeTab === 'trazabilidad' ? '#a855f7' : '#94a3b8',
            fontSize: '1.05rem',
            fontWeight: '700',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <History size={18} /> Trazabilidad de Ingresos
        </button>

        <div style={{ marginLeft: 'auto' }}>
          <button 
            onClick={cargarDatos} 
            className="btn-secondary" 
            style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'stock' ? (
          <motion.div
            key="stock-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-card"
            style={{ padding: '30px' }}
          >
            {/* Search Stock Input */}
            <div style={{ position: 'relative', width: '100%', marginBottom: '25px' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
              <input
                type="text"
                value={stockSearchQuery}
                onChange={e => setStockSearchQuery(e.target.value)}
                placeholder="Buscar por código o descripción de fármaco / insumo..."
                className="input-field"
                style={{ paddingLeft: '48px', width: '100%' }}
              />
            </div>

            {/* List and Accordions */}
            {loading && articulos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
                Cargando inventario de bodega...
              </div>
            ) : filteredArticulos.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '50px 20px', 
                color: '#64748b', 
                border: '1px dashed var(--border-color)', 
                borderRadius: '12px' 
              }}>
                <Package size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', margin: '0 0 4px 0' }}>No se encontraron artículos</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Prueba con otros términos de búsqueda.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {filteredArticulos.map(art => {
                  const isExpanded = !!expandedArticles[art.codigo];
                  const hasStock = art.stockTotal > 0;
                  
                  return (
                    <div 
                      key={art.codigo} 
                      style={{ 
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        background: 'rgba(255, 255, 255, 0.01)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'border 0.2s'
                      }}
                    >
                      {/* Header Row Accordion */}
                      <div 
                        onClick={() => toggleExpandArticle(art.codigo)}
                        style={{
                          padding: '18px 24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                          transition: 'background 0.2s',
                          flexWrap: 'wrap',
                          gap: '15px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                        onMouseOut={(e) => e.currentTarget.style.background = isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent'}
                      >
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', display: 'block', letterSpacing: '0.5px' }}>CÓDIGO: {art.codigo}</span>
                          <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', marginTop: '2px', display: 'inline-block' }}>{art.descripcion}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Lotes</span>
                            <span style={{ fontSize: '1rem', fontWeight: '700', color: '#cbd5e1' }}>{art.variantes.length}</span>
                          </div>
                          
                          <div style={{ textAlign: 'right', minWidth: '100px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Stock Total</span>
                            <span style={{ 
                              fontSize: '1.15rem', 
                              fontWeight: '800', 
                              color: hasStock ? '#10b981' : '#64748b' 
                            }}>
                              {art.stockTotal} <span style={{ fontSize: '0.8rem', fontWeight: '400' }}>uds</span>
                            </span>
                          </div>

                          <div style={{ color: '#64748b', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      </div>

                      {/* Expandable Variants Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ 
                              padding: '20px 24px', 
                              borderTop: '1px solid rgba(255, 255, 255, 0.04)', 
                              background: 'rgba(0, 0, 0, 0.1)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}>
                              {art.variantes.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Info size={14} /> Sin stock registrado. No se han recepcionado lotes vigentes de este fármaco en bodega.
                                </p>
                              ) : (
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'left', color: '#64748b' }}>
                                        <th style={{ padding: '10px 8px', fontWeight: '700' }}>VENCIMIENTO</th>
                                        <th style={{ padding: '10px 8px', fontWeight: '700' }}>LOTE</th>
                                        <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'right' }}>CANTIDAD</th>
                                        <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'center' }}>CARTA CANJE</th>
                                        <th style={{ padding: '10px 8px', fontWeight: '700' }}>ISP</th>
                                        <th style={{ padding: '10px 8px', fontWeight: '700' }}>TIPO</th>
                                        <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'center', width: '80px' }}>NOTAS</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {art.variantes.map((v, vIdx) => {
                                        const status = getVencimientoStatus(v.vencimiento);
                                        const comentariosLote = comentariosPorVariante[v.id] || [];
                                        const tieneComentarios = comentariosLote.length > 0;
                                        const ultimoComentario = tieneComentarios ? comentariosLote[comentariosLote.length - 1] : null;
                                        
                                        return (
                                          <tr 
                                            key={vIdx} 
                                            style={{ 
                                              borderBottom: vIdx < art.variantes.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                                              color: '#cbd5e1'
                                            }}
                                          >
                                            <td style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              <span>{v.vencimiento ? formatDate(v.vencimiento) : 'No registra'}</span>
                                              <span style={{ 
                                                padding: '2px 8px', 
                                                borderRadius: '6px', 
                                                fontSize: '0.7rem', 
                                                fontWeight: '800',
                                                background: status.bg,
                                                color: status.color,
                                                border: status.border ? `1px solid ${status.border}` : 'none'
                                              }}>
                                                {status.label}
                                              </span>
                                            </td>
                                            <td style={{ padding: '12px 8px', fontWeight: '700', color: '#f8fafc' }}>
                                              {v.lote || 'S/L'}
                                            </td>
                                            <td style={{ padding: '12px 8px', fontWeight: '700', color: '#10b981', textAlign: 'right' }}>
                                              {v.cantidad} uds
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                              <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                background: v.carta_canje === 'SI' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                color: v.carta_canje === 'SI' ? '#10b981' : '#94a3b8',
                                                border: v.carta_canje === 'SI' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)'
                                              }}>
                                                {v.carta_canje || 'NO'}
                                              </span>
                                            </td>
                                            <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>
                                              {v.isp || 'S/I'}
                                            </td>
                                            <td style={{ padding: '12px 8px' }}>
                                              <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                background: art.categoriaNombre?.includes('FARMACO') ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                color: art.categoriaNombre?.includes('FARMACO') ? '#a855f7' : '#3b82f6',
                                                border: art.categoriaNombre?.includes('FARMACO') ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                                              }}>
                                                {art.categoriaNombre || 'Sin Categoría'}
                                              </span>
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                              <button
                                                onClick={() => handleAbrirBitacoraLote(v)}
                                                title={ultimoComentario ? `Último comentario (${formatDate(ultimoComentario.created_at)} por ${ultimoComentario.usuario}): ${ultimoComentario.comentario}` : 'Agregar anotación'}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  color: tieneComentarios ? '#a855f7' : '#475569',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                  padding: '4px 8px',
                                                  borderRadius: '4px',
                                                  transition: 'all 0.2s',
                                                }}
                                              >
                                                <ClipboardList size={16} />
                                                {tieneComentarios && (
                                                  <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                                                    ({comentariosLote.length})
                                                  </span>
                                                )}
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="trazabilidad-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-card"
            style={{ padding: '30px' }}
          >
            {/* Search Trazabilidad Input */}
            <div style={{ position: 'relative', width: '100%', marginBottom: '25px' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
              <input
                type="text"
                value={trazabilidadSearchQuery}
                onChange={e => setTrazabilidadSearchQuery(e.target.value)}
                placeholder="Buscar por lote, código, descripción de artículo, factura/guía o N° de OC..."
                className="input-field"
                style={{ paddingLeft: '48px', width: '100%' }}
              />
            </div>

            {/* List results */}
            {loading && revisiones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
                Consultando historial de auditoría...
              </div>
            ) : listadoTrazabilidad.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '50px 20px', 
                color: '#64748b', 
                border: '1px dashed var(--border-color)', 
                borderRadius: '12px' 
              }}>
                <History size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', margin: '0 0 4px 0' }}>Sin registros de trazabilidad</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No se encontraron ingresos que coincidan con la búsqueda.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {listadoTrazabilidad.map(art => {
                  const isExpanded = !!expandedTrazabilidad[art.codigo];
                  
                  return (
                    <div 
                      key={art.codigo} 
                      style={{ 
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        background: 'rgba(255, 255, 255, 0.01)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'border 0.2s'
                      }}
                    >
                      {/* Cabecera del Acordeón: Código y Nombre de Artículo */}
                      <div 
                        onClick={() => toggleExpandTrazabilidad(art.codigo)}
                        style={{
                          padding: '18px 24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                          transition: 'background 0.2s',
                          flexWrap: 'wrap',
                          gap: '15px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                        onMouseOut={(e) => e.currentTarget.style.background = isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent'}
                      >
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', display: 'block', letterSpacing: '0.5px' }}>CÓDIGO: {art.codigo}</span>
                          <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', marginTop: '2px', display: 'inline-block' }}>{art.descripcion}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Ingresos</span>
                            <span style={{ fontSize: '1rem', fontWeight: '700', color: '#cbd5e1' }}>{art.ingresos.length}</span>
                          </div>
                          <div style={{ color: '#64748b', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      </div>

                      {/* Contenido Expandido: Cuadros con lotes y sus detalles */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ 
                              padding: '20px 24px', 
                              borderTop: '1px solid rgba(255, 255, 255, 0.04)', 
                              background: 'rgba(0, 0, 0, 0.1)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '15px'
                            }}>
                              {art.ingresos.map((rev, rIdx) => {
                                // Obtener vencimiento desde variantes
                                const varInfo = variantes.find(
                                  v => v.codigo_articulo?.trim() === rev.codigo_articulo?.trim() && 
                                       v.lote?.trim().toUpperCase() === rev.lote?.trim().toUpperCase()
                                );
                                const vencimiento = varInfo ? varInfo.vencimiento : null;
                                const isp = rev.isp || (varInfo ? varInfo.isp : null);

                                return (
                                  <div 
                                    key={rIdx}
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.015)',
                                      border: '1px solid rgba(255, 255, 255, 0.03)',
                                      borderRadius: '10px',
                                      padding: '16px 20px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '12px'
                                    }}
                                  >
                                    {/* Fila superior: Lote y Fecha */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                      <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#a855f7' }}>Lote: {rev.lote || 'S/L'}</span>
                                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        <strong>Recibido el:</strong> {formatDateTime(rev.created_at)}
                                      </div>
                                    </div>

                                    {/* Grid de Detalles del Ingreso */}
                                    <div style={{ 
                                      display: 'grid', 
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                                      gap: '15px',
                                      background: 'rgba(0, 0, 0, 0.15)',
                                      padding: '12px 15px',
                                      borderRadius: '8px',
                                      border: '1px solid rgba(255, 255, 255, 0.01)',
                                      fontSize: '0.85rem'
                                    }}>
                                      <div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Vencimiento</span>
                                        <span style={{ fontWeight: '600', color: '#cbd5e1', marginTop: '2px', display: 'block' }}>
                                          {vencimiento ? formatDate(vencimiento) : 'No registra'}
                                        </span>
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>ISP</span>
                                        <span style={{ fontWeight: '600', color: '#cbd5e1', marginTop: '2px', display: 'block' }}>
                                          {isp || 'S/I'}
                                        </span>
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Documento Bodega</span>
                                        <span style={{ fontWeight: '600', color: '#cbd5e1', marginTop: '2px', display: 'block' }}>
                                          {rev.tipo_documento || 'S/D'} N° {rev.numero_documento || 'S/N'}
                                        </span>
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Orden de Compra</span>
                                        <span style={{ fontWeight: '600', color: '#3b82f6', marginTop: '2px', display: 'block' }}>
                                          {rev.numero_oc ? `OC N° ${rev.numero_oc}` : 'Ingreso Directo'}
                                        </span>
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Cantidad Recibida</span>
                                        <span style={{ fontWeight: '800', color: '#10b981', marginTop: '2px', display: 'block' }}>
                                          {rev.cantidad} uds
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Bitácora del Lote */}
      <AnimatePresence>
        {selectedLoteForModal && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setSelectedLoteForModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '600px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedLoteForModal(null)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '50%',
                  padding: '8px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = '#f8fafc';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                ✕
              </button>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>
                Bitácora de Lote
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px' }}>
                {articulosMap[selectedLoteForModal.codigo_articulo?.trim()] || 'Artículo'} <br />
                <span style={{ fontWeight: '700', color: '#a855f7' }}>Lote: {selectedLoteForModal.lote || 'S/L'}</span>
                {selectedLoteForModal.vencimiento && ` • Vencimiento: ${formatDate(selectedLoteForModal.vencimiento)}`}
              </p>

              {/* Historial de Comentarios */}
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                marginBottom: '20px',
                paddingRight: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {(comentariosPorVariante[selectedLoteForModal.id] || []).length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
                    No hay anotaciones registradas para este lote.
                  </div>
                ) : (
                  (comentariosPorVariante[selectedLoteForModal.id] || []).map((com, index) => (
                    <div key={com.id || index} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '12px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                        <span style={{ fontWeight: '700', color: '#a855f7' }}>Anotación #{index + 1} por {com.usuario}</span>
                        <span>{formatDateTime(com.created_at)}</span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                        {com.comentario}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Formulario de Nueva Anotación */}
              <form onSubmit={handleAddComentarioLote} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8' }}>Tu Firma / Nombre:</label>
                  <input
                    type="text"
                    placeholder="Escribe tu nombre o iniciales (Ej: Juan P.)"
                    value={usuarioFirma}
                    onChange={(e) => {
                      setUsuarioFirma(e.target.value);
                      localStorage.setItem('firma_operador', e.target.value);
                    }}
                    required
                    style={{
                      background: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8' }}>Comentario / Nota:</label>
                  <textarea
                    placeholder="Escribe una observación sobre este lote (ej. cuarentena, estado, ubicación, etc.)..."
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    rows={3}
                    required
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      resize: 'none',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button 
                    type="submit" 
                    style={{ 
                      padding: '10px 20px', 
                      fontSize: '0.85rem', 
                      minWidth: '150px',
                      background: '#a855f7',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontWeight: '700',
                      cursor: 'pointer',
                      opacity: (guardandoComentario || !nuevoComentario.trim() || !usuarioFirma.trim()) ? 0.6 : 1,
                      transition: 'all 0.2s',
                    }} 
                    disabled={guardandoComentario || !nuevoComentario.trim() || !usuarioFirma.trim()}
                    onMouseOver={(e) => {
                      if (!guardandoComentario && nuevoComentario.trim() && usuarioFirma.trim()) {
                        e.currentTarget.style.background = '#9333ea';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#a855f7';
                    }}
                  >
                    {guardandoComentario ? 'Guardando...' : 'Agregar Anotación'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventarioModule;
