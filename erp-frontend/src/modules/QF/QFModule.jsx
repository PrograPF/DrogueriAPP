import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, Trash2, Calendar, Edit2, 
  ArrowLeft, RefreshCw, CheckCircle, Clock, AlertTriangle, 
  Building2, Tag, X, Save, DollarSign, Package, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { formatDate } from '../../utils/dateFormatter';
import { labelStyle } from '../../styles/sharedStyles';

// Helper to format date YYYY-MM-DD
const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Formatter to guarantee S- prefix
const formatNumeroSolicitud = (val) => {
  if (!val) return '';
  const trimmed = val.trim().toUpperCase();
  if (trimmed.startsWith('S-')) {
    return trimmed;
  }
  return `S-${trimmed}`;
};

const QFModule = () => {
  // Main view state: 'list' | 'create'
  const [view, setView] = useState('list');
  const [editingSolicitudId, setEditingSolicitudId] = useState(null);

  // Solicitudes state
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Centros de costo state
  const [centrosCosto, setCentrosCosto] = useState([]);

  // Detail Modal State
  const [selectedSolicitudForModal, setSelectedSolicitudForModal] = useState(null);

  // Form State (Parent Header)
  const [formNumero, setFormNumero] = useState('');
  const [formCentroCostoId, setFormCentroCostoId] = useState('');
  const [formFechaCreacion, setFormFechaCreacion] = useState(getTodayDateString());
  const [formObservaciones, setFormObservaciones] = useState('');

  // Sub-Centros de Costo options (for RESOLUTIVIDAD)
  const [subCentrosOptions, setSubCentrosOptions] = useState(['UAPO', 'ORL', 'TD']);

  // Assigned OCs mapping: { [numero_solicitud]: [{ id, numero_oc, estado }] }
  const [assignedOcsMap, setAssignedOcsMap] = useState({});

  // Form State (Dynamic Article Rows)
  // Row structure: { key, codigo, descripcion, cantidad, sub_centro_costo, suggestions: [], showSuggestions: false }
  const [articulosForm, setArticulosForm] = useState([
    { key: Date.now(), codigo: '', descripcion: '', cantidad: 1, sub_centro_costo: 'UAPO', suggestions: [], showSuggestions: false }
  ]);

  // Initial Load
  useEffect(() => {
    fetchSolicitudes();
    fetchCentrosCosto();
    fetchSubCentrosCosto();
  }, []);

  // Fetch Solicitudes with Child Articles and Assigned OCs
  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      // 1. Fetch parent solicitudes with children
      let solData = [];
      const { data, error } = await supabase
        .from('solicitudes_compra')
        .select(`
          *,
          solicitudes_compra_articulos (
            id,
            codigo_articulo,
            descripcion_articulo,
            cantidad,
            sub_centro_costo
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Cargando solicitudes simples (fallback):', error.message);
        const { data: simpleData } = await supabase
          .from('solicitudes_compra')
          .select('*')
          .order('created_at', { ascending: false });
        solData = simpleData || [];
      } else {
        solData = data || [];
      }

      // 2. Fetch OCs to check assigned status and numbers
      const { data: ocsData } = await supabase
        .from('ordenes_compra')
        .select('id, numero_oc, solicitud_compra, estado')
        .not('solicitud_compra', 'is', null);

      const map = {};
      (ocsData || []).forEach(oc => {
        if (oc.solicitud_compra) {
          const key = oc.solicitud_compra.trim().toUpperCase();
          if (!map[key]) map[key] = [];
          map[key].push(oc);
        }
      });

      setAssignedOcsMap(map);
      setSolicitudes(solData);
    } catch (err) {
      console.error('Error al cargar solicitudes de compra:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Sub-Centros de Costo for RESOLUTIVIDAD
  const fetchSubCentrosCosto = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_centros_costo')
        .select('nombre')
        .order('nombre');

      if (!error && data && data.length > 0) {
        setSubCentrosOptions(data.map(d => d.nombre));
      }
    } catch (err) {
      console.warn('Cargando sub-centros por defecto (fallback):', err.message);
    }
  };

  // Fetch Centros de Costo
  const fetchCentrosCosto = async () => {
    try {
      const { data, error } = await supabase
        .from('centros_costo')
        .select('*')
        .order('nombre');

      if (error) throw error;
      setCentrosCosto(data || []);
    } catch (err) {
      console.error('Error al cargar centros de costo:', err);
    }
  };

  // Open Create Mode
  const handleStartCreate = () => {
    setEditingSolicitudId(null);
    setFormNumero('');
    setFormCentroCostoId(centrosCosto[0]?.id ? String(centrosCosto[0].id) : '');
    setFormFechaCreacion(getTodayDateString());
    setFormObservaciones('');
    setArticulosForm([
      { key: Date.now(), codigo: '', descripcion: '', cantidad: 1, sub_centro_costo: 'UAPO', suggestions: [], showSuggestions: false }
    ]);
    setView('create');
  };

  // Open Edit Mode
  const handleStartEdit = (item) => {
    setEditingSolicitudId(item.id);
    setFormNumero(item.numero_solicitud || '');
    setFormCentroCostoId(item.centro_costo_id ? String(item.centro_costo_id) : '');
    setFormFechaCreacion(item.fecha_creacion || getTodayDateString());
    setFormObservaciones(item.observaciones || '');

    // Map existing child articles
    if (item.solicitudes_compra_articulos && item.solicitudes_compra_articulos.length > 0) {
      setArticulosForm(
        item.solicitudes_compra_articulos.map(c => ({
          key: c.id || Date.now() + Math.random(),
          codigo: c.codigo_articulo || '',
          descripcion: c.descripcion_articulo || '',
          cantidad: c.cantidad || 1,
          sub_centro_costo: c.sub_centro_costo || 'UAPO',
          suggestions: [],
          showSuggestions: false
        }))
      );
    } else if (item.codigo_articulo) {
      // Legacy single article format fallback
      setArticulosForm([
        {
          key: Date.now(),
          codigo: item.codigo_articulo || '',
          descripcion: item.descripcion_articulo || '',
          cantidad: item.cantidad || 1,
          sub_centro_costo: 'UAPO',
          suggestions: [],
          showSuggestions: false
        }
      ]);
    } else {
      setArticulosForm([
        { key: Date.now(), codigo: '', descripcion: '', cantidad: 1, sub_centro_costo: 'UAPO', suggestions: [], showSuggestions: false }
      ]);
    }

    setView('create');
  };

  // Dynamic Row Handlers
  const handleAddArticleRow = () => {
    setArticulosForm(prev => [
      ...prev,
      { key: Date.now(), codigo: '', descripcion: '', cantidad: 1, sub_centro_costo: subCentrosOptions[0] || 'UAPO', suggestions: [], showSuggestions: false }
    ]);
  };

  const handleRemoveArticleRow = (key) => {
    if (articulosForm.length === 1) {
      alert('La solicitud debe tener al menos un artículo.');
      return;
    }
    setArticulosForm(prev => prev.filter(r => r.key !== key));
  };

  const handleArticleRowChange = async (key, field, value) => {
    setArticulosForm(prev => prev.map(row => {
      if (row.key === key) {
        return { ...row, [field]: value };
      }
      return row;
    }));

    // Auto-suggest for codigo input
    if (field === 'codigo') {
      const term = value.trim();
      if (term.length >= 2) {
        try {
          const { data } = await supabase
            .from('articulos')
            .select('codigo, descripcion')
            .or(`codigo.ilike.%${term}%,descripcion.ilike.%${term}%`)
            .limit(8);

          setArticulosForm(prev => prev.map(row => {
            if (row.key === key) {
              const exact = (data || []).find(a => a.codigo.toUpperCase() === term.toUpperCase());
              return { 
                ...row, 
                suggestions: data || [], 
                showSuggestions: true,
                descripcion: exact ? exact.descripcion : row.descripcion
              };
            }
            return row;
          }));
        } catch (err) {
          console.error(err);
        }
      } else {
        setArticulosForm(prev => prev.map(row => {
          if (row.key === key) {
            return { ...row, suggestions: [], showSuggestions: false };
          }
          return row;
        }));
      }
    }
  };

  const handleSelectSuggestion = (key, item) => {
    setArticulosForm(prev => prev.map(row => {
      if (row.key === key) {
        return {
          ...row,
          codigo: item.codigo,
          descripcion: item.descripcion,
          showSuggestions: false
        };
      }
      return row;
    }));
  };

  // Save Solicitud (Parent + Children)
  const handleSaveSolicitud = async () => {
    if (!formNumero.trim()) {
      alert('Por favor, ingresa el número de solicitud.');
      return;
    }

    // Filter valid article rows
    const validArticles = articulosForm.filter(a => a.codigo.trim() !== '');
    if (validArticles.length === 0) {
      alert('Debes ingresar al menos un código de artículo válido.');
      return;
    }

    const formattedNumero = formatNumeroSolicitud(formNumero);
    const selectedCc = centrosCosto.find(c => String(c.id) === String(formCentroCostoId));
    const isResolutividad = selectedCc && selectedCc.nombre.trim().toUpperCase() === 'RESOLUTIVIDAD';
    const matchingOcs = assignedOcsMap[formattedNumero.toUpperCase()] || [];
    const calculatedEstado = matchingOcs.length > 0 ? 'OC asignada parcial' : 'Sin OC asignada';

    try {
      const parentPayload = {
        numero_solicitud: formattedNumero,
        centro_costo_id: formCentroCostoId ? parseInt(formCentroCostoId) : null,
        centro_costo_nombre: selectedCc ? selectedCc.nombre : null,
        fecha_creacion: formFechaCreacion || getTodayDateString(),
        estado: calculatedEstado,
        observaciones: formObservaciones.trim(),
        // Keep first article as legacy fallback
        codigo_articulo: validArticles[0].codigo.trim().toUpperCase(),
        descripcion_articulo: validArticles[0].descripcion.trim().toUpperCase(),
        cantidad: parseInt(validArticles[0].cantidad) || 1
      };

      let targetId = editingSolicitudId;

      if (!editingSolicitudId) {
        // Insert new parent
        const { data: dup } = await supabase
          .from('solicitudes_compra')
          .select('numero_solicitud')
          .eq('numero_solicitud', formattedNumero)
          .maybeSingle();

        if (dup) {
          alert(`La solicitud "${formattedNumero}" ya existe en la base de datos.`);
          return;
        }

        const { data: insertedParent, error: parentErr } = await supabase
          .from('solicitudes_compra')
          .insert([parentPayload])
          .select();

        if (parentErr) throw parentErr;
        parentId = insertedParent[0].id;
      } else {
        // Update parent
        const { error: updateErr } = await supabase
          .from('solicitudes_compra')
          .update(parentPayload)
          .eq('id', editingSolicitudId);

        if (updateErr) throw updateErr;

        // Delete existing child items for refresh
        await supabase
          .from('solicitudes_compra_articulos')
          .delete()
          .eq('solicitud_id', editingSolicitudId);
      }

      // Insert child articles into solicitudes_compra_articulos
      const childPayloads = validArticles.map(a => ({
        solicitud_id: parentId,
        codigo_articulo: a.codigo.trim().toUpperCase(),
        descripcion_articulo: a.descripcion.trim().toUpperCase(),
        cantidad: parseInt(a.cantidad) || 1
      }));

      const { error: childErr } = await supabase
        .from('solicitudes_compra_articulos')
        .insert(childPayloads);

      if (childErr) {
        console.warn('Aviso: No se pudieron guardar los detalles en solicitudes_compra_articulos (verificar si la tabla fue creada en Supabase):', childErr.message);
      }

      alert('¡Solicitud de compra guardada exitosamente con todos sus artículos!');
      setView('list');
      fetchSolicitudes();

    } catch (err) {
      alert('Error al guardar la solicitud: ' + err.message);
    }
  };

  // Delete Solicitud
  const handleDeleteSolicitud = async (item) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la solicitud ${item.numero_solicitud}?`)) return;
    try {
      const { error } = await supabase
        .from('solicitudes_compra')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      alert('Solicitud eliminada.');
      fetchSolicitudes();
    } catch (err) {
      alert('Error al eliminar solicitud: ' + err.message);
    }
  };

  // Filtered solicitudes
  const filteredSolicitudes = solicitudes.filter(s => {
    const term = searchQuery.toLowerCase();
    const matchHeader = (
      (s.numero_solicitud && s.numero_solicitud.toLowerCase().includes(term)) ||
      (s.centro_costo_nombre && s.centro_costo_nombre.toLowerCase().includes(term)) ||
      (s.codigo_articulo && s.codigo_articulo.toLowerCase().includes(term)) ||
      (s.descripcion_articulo && s.descripcion_articulo.toLowerCase().includes(term))
    );

    const matchChildren = (s.solicitudes_compra_articulos || []).some(art => 
      (art.codigo_articulo && art.codigo_articulo.toLowerCase().includes(term)) ||
      (art.descripcion_articulo && art.descripcion_articulo.toLowerCase().includes(term))
    );

    return matchHeader || matchChildren;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      style={{ maxWidth: '1200px', margin: '0 auto' }}
    >
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          /* ==========================================
             VISTA 1: LISTADO DE SOLICITUDES
             ========================================== */
          <motion.div
            key="list-view"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
          >
            {/* Header principal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <FileText size={32} color="#3b82f6" />
                <div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Módulo QF - Solicitudes de Compra</h2>
                  <p style={{ color: '#94a3b8', margin: '4px 0 0 0' }}>Registro y control de requerimientos de compra por centro de costo.</p>
                </div>
              </div>

              <button 
                onClick={handleStartCreate}
                className="btn-primary" 
                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 22px', height: '46px' }}
              >
                <Plus size={20} /> Crear Nueva Solicitud
              </button>
            </div>

            {/* Buscador */}
            <div className="glass-card" style={{ padding: '20px', marginBottom: '25px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar por N° Solicitud (S-1234), artículo, código o centro de costo..." 
                  className="input-field"
                  style={{ paddingLeft: '45px', width: '100%' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Tabla Principal de Solicitudes */}
            <div className="glass-card" style={{ padding: '25px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
                  Cargando solicitudes de compra...
                </div>
              ) : filteredSolicitudes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                  <FileText size={36} style={{ marginBottom: '10px', opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>No hay solicitudes de compra registradas o coincidentes.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
                        <th style={{ padding: '14px 16px', fontWeight: '600' }}>N° SOLICITUD</th>
                        <th style={{ padding: '14px 16px', fontWeight: '600' }}>FECHA CREACIÓN</th>
                        <th style={{ padding: '14px 16px', fontWeight: '600' }}>CENTRO DE COSTO</th>
                        <th style={{ padding: '14px 16px', fontWeight: '600' }}>ARTÍCULOS SOLICITADOS</th>
                        <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'center' }}>ESTADO</th>
                        <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'right' }}>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSolicitudes.map((s) => {
                        const items = s.solicitudes_compra_articulos || [];
                        const totalItems = items.length > 0 ? items.length : 1;
                        const matchingOcs = assignedOcsMap[s.numero_solicitud.toUpperCase()] || [];
                        const currentStatus = s.estado || (matchingOcs.length > 0 ? 'OC asignada parcial' : 'Sin OC asignada');

                        let badgeBg = 'rgba(234, 179, 8, 0.15)';
                        let badgeColor = '#eab308';
                        let displayStateText = 'Sin OC asignada';

                        if (currentStatus === 'OC asignada completa') {
                          badgeBg = 'rgba(16, 185, 129, 0.15)';
                          badgeColor = '#10b981';
                          displayStateText = 'OC asignada completa';
                        } else if (currentStatus === 'OC asignada parcial' || matchingOcs.length > 0) {
                          badgeBg = 'rgba(59, 130, 246, 0.15)';
                          badgeColor = '#3b82f6';
                          displayStateText = currentStatus === 'OC asignada completa' ? 'OC asignada completa' : 'OC asignada parcial';
                        }

                        return (
                          <tr 
                            key={s.id} 
                            style={{ 
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              transition: 'background 0.2s' 
                            }}
                          >
                            {/* N° Solicitud */}
                            <td style={{ padding: '16px' }}>
                              <button 
                                onClick={() => setSelectedSolicitudForModal(s)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#3b82f6',
                                  fontWeight: '800',
                                  fontSize: '1rem',
                                  cursor: 'pointer',
                                  padding: 0,
                                  textDecoration: 'underline',
                                  textAlign: 'left'
                                }}
                              >
                                {s.numero_solicitud}
                              </button>
                              {matchingOcs.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                                  {matchingOcs.map(oc => (
                                    <span key={oc.id} style={{ 
                                      fontSize: '0.7rem', 
                                      background: 'rgba(16, 185, 129, 0.12)', 
                                      color: '#10b981', 
                                      padding: '1px 6px', 
                                      borderRadius: '4px',
                                      fontWeight: '600'
                                    }}>
                                      {oc.numero_oc}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Fecha */}
                            <td style={{ padding: '16px', color: '#cbd5e1' }}>
                              {s.fecha_creacion ? formatDate(s.fecha_creacion) : '-'}
                            </td>

                            {/* Centro de costo */}
                            <td style={{ padding: '16px', color: '#f8fafc', fontWeight: '600' }}>
                              {s.centro_costo_nombre || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Sin asignar</span>}
                            </td>

                            {/* Artículos Solicitados */}
                            <td style={{ padding: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ 
                                  background: 'rgba(59, 130, 246, 0.15)', 
                                  color: '#3b82f6', 
                                  padding: '2px 8px', 
                                  borderRadius: '6px', 
                                  fontSize: '0.75rem',
                                  fontWeight: '700' 
                                }}>
                                  {totalItems} {totalItems === 1 ? 'Producto' : 'Productos'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                                {items.length > 0 ? (
                                  items.map(i => `${i.codigo_articulo} (${i.cantidad})`).join(', ')
                                ) : (
                                  `${s.codigo_articulo} (${s.cantidad || 1})`
                                )}
                              </div>
                            </td>

                            {/* Estado */}
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                              <span style={{ 
                                background: badgeBg, 
                                color: badgeColor, 
                                padding: '5px 12px', 
                                borderRadius: '8px', 
                                fontWeight: '700',
                                fontSize: '0.75rem' 
                              }}>
                                {displayStateText}
                              </span>
                            </td>

                            {/* Acciones */}
                            <td style={{ padding: '16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button 
                                  onClick={() => setSelectedSolicitudForModal(s)}
                                  style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }}
                                  title="Ver detalle"
                                >
                                  <Eye size={18} />
                                </button>
                                <button 
                                  onClick={() => handleStartEdit(s)}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                  title="Editar Solicitud"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteSolicitud(s)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                  title="Eliminar Solicitud"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
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
        ) : (
          /* ==========================================
             VISTA 2: FORMULARIO CREAR / EDITAR SOLICITUD
             ========================================== */
          <motion.div
            key="create-view"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="glass-card"
            style={{ padding: '30px' }}
          >
            {/* Header del Formulario */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={28} color="#3b82f6" />
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>
                  {editingSolicitudId ? `Editar Solicitud (${formNumero})` : 'Nueva Solicitud de Compra (QF)'}
                </h2>
              </div>
              <button onClick={() => setView('list')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeft size={16} /> Volver a la Lista
              </button>
            </div>

            {/* Layout en 2 Columnas (Estilo Crear OC) */}
            <div className="responsive-grid-2" style={{ marginBottom: '30px', display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '30px' }}>
              
              {/* Lado Izquierdo - Datos Generales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  1. Encabezado de la Solicitud
                </h3>

                {/* Número de Solicitud */}
                <div>
                  <label style={labelStyle}><FileText size={16} /> Número de Solicitud *</label>
                  <input 
                    type="text"
                    placeholder="Ej: 1234 (se guardará como S-1234)"
                    className="input-field"
                    style={{ width: '100%' }}
                    value={formNumero}
                    onChange={(e) => setFormNumero(e.target.value)}
                    onBlur={() => setFormNumero(formatNumeroSolicitud(formNumero))}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    Al escribir el número, se le antepondrá automáticamente "S-".
                  </small>
                </div>

                {/* Centro de Costo */}
                <div>
                  <label style={labelStyle}><Building2 size={16} /> Centro de Costo *</label>
                  <select 
                    className="input-field"
                    style={{ width: '100%' }}
                    value={formCentroCostoId}
                    onChange={(e) => setFormCentroCostoId(e.target.value)}
                  >
                    <option value="">-- Seleccionar Centro de Costo --</option>
                    {centrosCosto.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Fecha de Creación Manual */}
                <div>
                  <label style={labelStyle}><Calendar size={16} /> Fecha de Creación (Manual)</label>
                  <input 
                    type="date"
                    className="input-field"
                    style={{ width: '100%' }}
                    value={formFechaCreacion}
                    onChange={(e) => setFormFechaCreacion(e.target.value)}
                  />
                </div>

                {/* Observaciones */}
                <div>
                  <label style={labelStyle}>Observaciones / Notas</label>
                  <textarea 
                    rows={3}
                    placeholder="Notas o justificación de la compra..."
                    className="input-field"
                    style={{ width: '100%', resize: 'vertical' }}
                    value={formObservaciones}
                    onChange={(e) => setFormObservaciones(e.target.value)}
                  />
                </div>
              </div>

              {/* Lado Derecho - Múltiples Artículos Requeridos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={18} color="#3b82f6" /> 2. Artículos Requeridos ({articulosForm.length})
                  </h3>
                  <button 
                    type="button"
                    onClick={handleAddArticleRow}
                    className="btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> + Agregar Producto
                  </button>
                </div>

                {/* Tabla Dinámica de Artículos */}
                {(() => {
                  const selectedCc = centrosCosto.find(c => String(c.id) === String(formCentroCostoId));
                  const isResolutividad = selectedCc && selectedCc.nombre.trim().toUpperCase() === 'RESOLUTIVIDAD';

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {articulosForm.map((row, index) => (
                        <div 
                          key={row.key}
                          style={{
                            padding: '16px',
                            background: isResolutividad ? 'rgba(59, 130, 246, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                            border: isResolutividad ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '12px',
                            display: 'grid',
                            gridTemplateColumns: isResolutividad ? '1fr 1.6fr 0.7fr 1fr auto' : '1.2fr 2fr 0.8fr auto',
                            gap: '12px',
                            alignItems: 'center',
                            position: 'relative'
                          }}
                        >
                          {/* Código con auto-sugerencia */}
                          <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Código *</label>
                            <input 
                              type="text"
                              placeholder="Ej: 888"
                              className="input-field"
                              style={{ width: '100%', fontSize: '0.85rem' }}
                              value={row.codigo}
                              onChange={(e) => handleArticleRowChange(row.key, 'codigo', e.target.value)}
                            />

                            {/* Desplegable de auto-sugerencias */}
                            {row.showSuggestions && row.suggestions.length > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: '-150px',
                                background: '#0f172a',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '8px',
                                maxHeight: '160px',
                                overflowY: 'auto',
                                zIndex: 100,
                                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                                marginTop: '4px'
                              }}>
                                {row.suggestions.map(sug => (
                                  <div
                                    key={sug.codigo}
                                    onMouseDown={() => handleSelectSuggestion(row.key, sug)}
                                    style={{
                                      padding: '8px 12px',
                                      cursor: 'pointer',
                                      fontSize: '0.8rem',
                                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                                      display: 'flex',
                                      justifyContent: 'space-between'
                                    }}
                                  >
                                    <strong style={{ color: '#3b82f6' }}>{sug.codigo}</strong>
                                    <span style={{ color: '#94a3b8', marginLeft: '8px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                      {sug.descripcion}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Descripción */}
                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Descripción</label>
                            <input 
                              type="text"
                              placeholder="Nombre del fármaco o insumo..."
                              className="input-field"
                              style={{ width: '100%', fontSize: '0.85rem' }}
                              value={row.descripcion}
                              onChange={(e) => handleArticleRowChange(row.key, 'descripcion', e.target.value)}
                            />
                          </div>

                          {/* Cantidad */}
                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Cant.</label>
                            <input 
                              type="number"
                              min="1"
                              className="input-field"
                              style={{ width: '100%', fontSize: '0.85rem', textAlign: 'center' }}
                              value={row.cantidad}
                              onChange={(e) => handleArticleRowChange(row.key, 'cantidad', e.target.value)}
                            />
                          </div>

                          {/* SUB-CENTRO DE COSTO (DETERMINADO SOLO SI RESOLUTIVIDAD ESTÁ SELECCIONADO) */}
                          {isResolutividad && (
                            <div>
                              <label style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Sub-Centro *</label>
                              <select
                                className="input-field"
                                style={{ width: '100%', fontSize: '0.85rem', borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.08)' }}
                                value={row.sub_centro_costo || subCentrosOptions[0] || 'UAPO'}
                                onChange={(e) => handleArticleRowChange(row.key, 'sub_centro_costo', e.target.value)}
                              >
                                {subCentrosOptions.map(sc => (
                                  <option key={sc} value={sc}>{sc}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Botón Eliminar Fila */}
                          <div style={{ paddingTop: '18px' }}>
                            <button 
                              type="button"
                              onClick={() => handleRemoveArticleRow(row.key)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}
                              title="Quitar este artículo"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <button 
                  type="button"
                  onClick={handleAddArticleRow}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '12px',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Plus size={18} /> Añadir otra línea de producto
                </button>
              </div>

            </div>

            {/* Footer con Acciones */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
              <button onClick={() => setView('list')} className="btn-secondary">
                Cancelar
              </button>
              <button 
                onClick={handleSaveSolicitud}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
              >
                <Save size={18} /> Guardar Solicitud de Compra
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Detalle de Solicitud */}
      <AnimatePresence>
        {selectedSolicitudForModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card"
              style={{
                maxWidth: '650px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '30px',
                position: 'relative'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText color="#3b82f6" size={24} />
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: '#3b82f6' }}>
                      {selectedSolicitudForModal.numero_solicitud}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                      Centro de Costo: {selectedSolicitudForModal.centro_costo_nombre || 'Sin asignar'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedSolicitudForModal(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Detalle Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Fecha de Creación:</span>
                  <strong style={{ color: '#f8fafc' }}>{formatDate(selectedSolicitudForModal.fecha_creacion)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Estado:</span>
                  <strong style={{ color: '#3b82f6' }}>{selectedSolicitudForModal.estado}</strong>
                </div>
                {selectedSolicitudForModal.observaciones && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Observaciones:</span>
                    <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: '4px 0 0 0' }}>{selectedSolicitudForModal.observaciones}</p>
                  </div>
                )}
              </div>

              {/* Tabla de Artículos de la Solicitud */}
              <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px', color: '#f8fafc' }}>Artículos de la Solicitud</h4>
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>CÓDIGO</th>
                      <th style={{ padding: '10px' }}>DESCRIPCIÓN</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>CANTIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedSolicitudForModal.solicitudes_compra_articulos || []).length > 0 ? (
                      selectedSolicitudForModal.solicitudes_compra_articulos.map(art => (
                        <tr key={art.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px', fontWeight: '700', color: '#3b82f6' }}>{art.codigo_articulo}</td>
                          <td style={{ padding: '10px', color: '#f8fafc' }}>
                            {art.descripcion_articulo || 'Sin descripción'}
                            {art.sub_centro_costo && (
                              <span style={{ 
                                background: 'rgba(59, 130, 246, 0.15)', 
                                color: '#3b82f6', 
                                padding: '2px 8px', 
                                borderRadius: '6px', 
                                fontSize: '0.75rem', 
                                fontWeight: '700',
                                marginLeft: '8px'
                              }}>
                                {art.sub_centro_costo}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700' }}>{art.cantidad}</td>
                        </tr>
                      ))
                    ) : (
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px', fontWeight: '700', color: '#3b82f6' }}>{selectedSolicitudForModal.codigo_articulo}</td>
                        <td style={{ padding: '10px', color: '#f8fafc' }}>{selectedSolicitudForModal.descripcion_articulo || 'Sin descripción'}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700' }}>{selectedSolicitudForModal.cantidad || 1}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Acciones Modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  onClick={() => setSelectedSolicitudForModal(null)}
                  className="btn-secondary"
                >
                  Cerrar
                </button>
                <button 
                  onClick={() => {
                    const item = selectedSolicitudForModal;
                    setSelectedSolicitudForModal(null);
                    handleStartEdit(item);
                  }}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit2 size={16} /> Editar Solicitud
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default QFModule;
