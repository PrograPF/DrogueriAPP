import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Search, Trash2, Calendar, FileText, ArrowLeft, 
  RefreshCw, CheckCircle, Clock, AlertTriangle, XCircle, ShoppingBag, 
  Activity, ClipboardList 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { labelStyle } from '../../styles/sharedStyles';
import { formatDate } from '../../utils/dateFormatter';

// Custom hook local to quickly check arsenal descriptions
const useArsenalAutoSuggest = (codigo) => {
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [exists, setExists] = useState(true);

  useEffect(() => {
    if (!codigo || codigo.trim() === '') {
      setNombre('');
      setExists(true);
      return;
    }

    const lookup = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('articulos')
          .select('nombre')
          .eq('codigo', codigo.trim())
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setNombre(data.nombre);
          setExists(true);
        } else {
          setNombre('');
          setExists(false);
        }
      } catch (err) {
        console.error(err);
        setNombre('');
        setExists(false);
      } finally {
        setLoading(false);
      }
    };

    const handler = setTimeout(() => {
      lookup();
    }, 400);

    return () => clearTimeout(handler);
  }, [codigo]);

  return { nombre, loading, exists };
};

const SeguimientoOCModule = () => {
  const [view, setView] = useState('list'); // 'list' | 'create'
  const [activeDept, setActiveDept] = useState('drogueria'); // 'drogueria' | 'dental'
  const [activeSubTab, setActiveSubTab] = useState('list'); // 'list' | 'recepcion'
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ocs, setOcs] = useState([]);
  
  // Articles catalog mapping for instant code -> name translation
  const [articulosCatalog, setArticulosCatalog] = useState({});

  // Reception sub-tab state
  const [selectedOcIdForRecepcion, setSelectedOcIdForRecepcion] = useState('');
  const [recepcionQuantities, setRecepcionQuantities] = useState({}); // { [articleId]: incomingQty }
  const [savingRecepcion, setSavingRecepcion] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    numero_oc: '',
    proveedor: '',
    rut_proveedor: '',
    tipo_oc: 'AG', // 'AG', 'SE', 'CM', 'L1'
    dias_plazo_atraso: 4, // Default to 4
    estado: 'Enviada' // 'Enviada', 'Aceptada', 'Cancelada', 'Aceptada con multa', 'Completada'
  });

  // Dynamic articles rows state
  const [articulosForm, setArticulosForm] = useState([
    { key: Date.now(), codigo: '', nombre: '', cantidad: 1, isNew: false, tempName: '' }
  ]);

  // Load articles catalog
  const cargarArticulosCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('articulos')
        .select('codigo, nombre');
      if (error) throw error;
      
      const mapping = {};
      (data || []).forEach(art => {
        if (art.codigo) {
          mapping[art.codigo.trim()] = art.nombre;
        }
      });
      setArticulosCatalog(mapping);
    } catch (err) {
      console.error('Error al cargar catálogo de artículos:', err);
    }
  };

  // Load active OCs from Supabase
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
            cantidad_recepcionada
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

  useEffect(() => {
    cargarOcs();
    cargarArticulosCatalog();
  }, []);

  // Update status directly from table
  const handleUpdateEstado = async (ocId, nuevoEstado) => {
    try {
      const updates = { estado: nuevoEstado };
      if (nuevoEstado === 'Aceptada') {
        updates.fecha_aceptacion = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('ordenes_compra')
        .update(updates)
        .eq('id', ocId);

      if (error) throw error;
      alert('Estado de la OC actualizado correctamente.');
      cargarOcs();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert('Error al actualizar: ' + err.message);
    }
  };

  // Add a new row to article sub-form
  const handleAddRow = () => {
    setArticulosForm(prev => [
      ...prev,
      { key: Date.now() + Math.random(), codigo: '', nombre: '', cantidad: 1, isNew: false, tempName: '' }
    ]);
  };

  // Remove row from article sub-form
  const handleRemoveRow = (keyToRemove) => {
    if (articulosForm.length === 1) return;
    setArticulosForm(prev => prev.filter(row => row.key !== keyToRemove));
  };

  // Handle article row changes
  const handleRowChange = (key, field, value) => {
    setArticulosForm(prev => prev.map(row => {
      if (row.key === key) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  // Save the OC and create new items if necessary
  const handleSaveOC = async () => {
    if (!formData.numero_oc.trim() || !formData.proveedor.trim()) {
      alert('Por favor complete el Número de OC y Proveedor.');
      return;
    }

    // Validate that we have articles
    const validArticles = articulosForm.filter(art => art.codigo.trim() !== '');
    if (validArticles.length === 0) {
      alert('Debe agregar al menos un artículo válido.');
      return;
    }

    setLoading(true);
    try {
      // 1. Register any new products in the catalog base table ('articulos')
      for (const art of validArticles) {
        if (art.isNew && art.tempName.trim()) {
          // Check if it already exists to avoid PK clash
          const { data: extArt } = await supabase
            .from('articulos')
            .select('codigo')
            .eq('codigo', art.codigo.trim())
            .maybeSingle();

          if (!extArt) {
            const { error: insertArtErr } = await supabase
              .from('articulos')
              .insert([{
                codigo: art.codigo.trim(),
                nombre: art.tempName.trim()
              }]);
            if (insertArtErr) throw insertArtErr;
          }
        }
      }

      // 2. Insert parent OC
      const ocInsert = {
        numero_oc: formData.numero_oc.trim(),
        proveedor: formData.proveedor.trim(),
        rut_proveedor: formData.rut_proveedor.trim(),
        tipo_oc: formData.tipo_oc,
        dias_plazo_atraso: formData.tipo_oc === 'AG' ? 4 : parseInt(formData.dias_plazo_atraso),
        estado: formData.estado,
        fecha_envio: new Date().toISOString()
      };

      if (formData.estado === 'Aceptada') {
        ocInsert.fecha_aceptacion = new Date().toISOString();
      }

      const { data: insertedOC, error: insertOCErr } = await supabase
        .from('ordenes_compra')
        .insert([ocInsert])
        .select();

      if (insertOCErr) throw insertOCErr;
      const newOCId = insertedOC[0].id;

      // 3. Insert child articles
      const childItems = validArticles.map(art => ({
        oc_id: newOCId,
        codigo_articulo: art.codigo.trim(),
        cantidad: parseInt(art.cantidad) || 1,
        cantidad_recepcionada: 0 // Initialize at 0
      }));

      const { error: insertItemsErr } = await supabase
        .from('ordenes_compra_articulos')
        .insert(childItems);

      if (insertItemsErr) throw insertItemsErr;

      alert('Orden de Compra creada exitosamente y catálogo base actualizado.');
      
      // Reset form
      setFormData({
        numero_oc: '',
        proveedor: '',
        rut_proveedor: '',
        tipo_oc: 'AG',
        dias_plazo_atraso: 4,
        estado: 'Enviada'
      });
      setArticulosForm([{ key: Date.now(), codigo: '', nombre: '', cantidad: 1, isNew: false, tempName: '' }]);
      setView('list');
      cargarOcs();
      cargarArticulosCatalog();

    } catch (err) {
      console.error('Error al guardar OC:', err);
      alert('Error al guardar OC: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate state dates and visual alerts
  const checkPlazos = (oc) => {
    // Completed OCs or Cancelled OCs do not trigger alerts
    if (oc.estado === 'Cancelada' || oc.estado === 'Completada') {
      return { isExpired: false, alertMessage: '' };
    }

    const today = new Date();
    const dateEnvio = new Date(oc.fecha_envio);
    const dateAceptacion = oc.fecha_aceptacion ? new Date(oc.fecha_aceptacion) : null;

    const diffDaysEnvio = Math.floor((today - dateEnvio) / (1000 * 60 * 60 * 24));
    const diffDaysAceptada = dateAceptacion ? Math.floor((today - dateAceptacion) / (1000 * 60 * 60 * 24)) : 0;

    let isExpired = false;
    let alertMessage = '';

    if (oc.tipo_oc === 'AG') {
      if (oc.estado === 'Enviada' && diffDaysEnvio > 4) {
        isExpired = true;
        alertMessage = `Atrasada: Han pasado ${diffDaysEnvio} días sin aceptación (Límite: 4 días).`;
      } else if (oc.estado === 'Aceptada' && diffDaysAceptada > 4) {
        isExpired = true;
        alertMessage = `Atraso en entrega: Aceptada hace ${diffDaysAceptada} días (Límite: 4 días).`;
      }
    } else {
      const limite = oc.dias_plazo_atraso || 0;
      if (oc.estado === 'Aceptada' && diffDaysAceptada > limite) {
        isExpired = true;
        alertMessage = `Atraso en entrega: Aceptada hace ${diffDaysAceptada} días (Límite personalizado: ${limite} días).`;
      }
    }

    return { isExpired, alertMessage };
  };

  // Handle manual delivery input change
  const handleRecepcionQtyChange = (artId, value) => {
    setRecepcionQuantities(prev => ({
      ...prev,
      [artId]: value
    }));
  };

  // Register manual partial deliveries in Supabase
  const handleRegisterRecepcion = async () => {
    const selectedOc = ocs.find(o => o.id === selectedOcIdForRecepcion);
    if (!selectedOc) return;

    // Check if there's any value entered
    const incomingEntries = Object.entries(recepcionQuantities).filter(
      ([_, val]) => val && parseInt(val) > 0
    );

    if (incomingEntries.length === 0) {
      alert('Por favor ingrese al menos una cantidad a recibir mayor a 0.');
      return;
    }

    setSavingRecepcion(true);
    try {
      // 1. Update each article with its new accumulated received quantity
      for (const [artId, qtyStr] of incomingEntries) {
        const incomingQty = parseInt(qtyStr) || 0;
        const currentArt = selectedOc.ordenes_compra_articulos.find(a => a.id === artId);
        if (!currentArt) continue;

        const currentAcum = currentArt.cantidad_recepcionada || 0;
        const newAcum = currentAcum + incomingQty;

        const { error } = await supabase
          .from('ordenes_compra_articulos')
          .update({ cantidad_recepcionada: newAcum })
          .eq('id', artId);

        if (error) throw error;
      }

      // Reload latest OCs data from database to perform correct completada checks
      const { data: refreshedOcs, error: refreshErr } = await supabase
        .from('ordenes_compra')
        .select(`
          *,
          ordenes_compra_articulos (
            id,
            codigo_articulo,
            cantidad,
            cantidad_recepcionada
          )
        `)
        .eq('id', selectedOcIdForRecepcion);

      if (refreshErr) throw refreshErr;
      
      const updatedOc = refreshedOcs?.[0];
      if (updatedOc) {
        // 2. Check if the OC is now fully completed (all articles quantity_received >= quantity)
        const allCompleted = (updatedOc.ordenes_compra_articulos || []).every(
          art => (art.cantidad_recepcionada || 0) >= (art.cantidad || 0)
        );

        if (allCompleted && updatedOc.estado !== 'Completada') {
          const { error: updateOcErr } = await supabase
            .from('ordenes_compra')
            .update({ estado: 'Completada' })
            .eq('id', selectedOcIdForRecepcion);

          if (updateOcErr) throw updateOcErr;
          alert('¡Excelente! Todas las cantidades han sido completadas. La OC se ha marcado como "Completada" automáticamente.');
        } else {
          alert('Recepción parcial registrada correctamente.');
        }
      }

      // Reset local inputs and reload everything
      setRecepcionQuantities({});
      await cargarOcs();

    } catch (err) {
      console.error('Error al registrar recepción:', err);
      alert('Error al registrar recepción: ' + err.message);
    } finally {
      setSavingRecepcion(false);
    }
  };

  /**
   * FUTURE INTEGRATION NOTE:
   * Eventualmente, desde el módulo de Revisión de Bodega, se enviará una solicitud automática
   * con las cantidades recepcionadas y revisadas de la OC "X".
   * Para implementar esta lógica, se puede habilitar una tabla intermedia de solicitudes ('recepciones_pendientes_aprobacion')
   * o un endpoint RPC. El usuario recibirá una notificación aquí para aceptar o rechazar la solicitud, 
   * lo cual incrementará de forma automatizada los valores de 'cantidad_recepcionada'.
   */

  // Filtered OCs
  const filteredOcs = ocs.filter(oc => {
    const q = searchQuery.toLowerCase();
    return (
      oc.numero_oc.toLowerCase().includes(q) ||
      oc.proveedor.toLowerCase().includes(q)
    );
  });

  // Active OCs suitable for receiving (excluding completely cancelled ones)
  const activeOcsForRecepcion = ocs.filter(o => o.estado !== 'Cancelada');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px' }}>
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div
            key="list-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-card"
            style={{ padding: '30px' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
                  <Truck size={30} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Seguimiento de OC</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Monitoreo de plazos y entregas de Órdenes de Compra</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={cargarOcs} className="btn-secondary" style={{ padding: '10px 16px' }} title="Recargar">
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {/* Department Tabs Selector (Top Level) */}
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px', marginBottom: '25px' }}>
              <button
                onClick={() => setActiveDept('drogueria')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: activeDept === 'drogueria' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: activeDept === 'drogueria' ? '#3b82f6' : '#94a3b8',
                  border: 'none',
                  borderBottom: activeDept === 'drogueria' ? '2px solid #3b82f6' : '2px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease'
                }}
              >
                <Truck size={18} /> Droguería
              </button>
              <button
                onClick={() => setActiveDept('dental')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: activeDept === 'dental' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: activeDept === 'dental' ? '#3b82f6' : '#94a3b8',
                  border: 'none',
                  borderBottom: activeDept === 'dental' ? '2px solid #3b82f6' : '2px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease'
                }}
              >
                <Activity size={18} /> Dental
              </button>
            </div>

            {activeDept === 'drogueria' ? (
              <>
                {/* Drogueria Sub-Tabs Selector (Second Level) */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '30px', 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  padding: '6px', 
                  borderRadius: '10px', 
                  border: '1px solid rgba(255, 255, 255, 0.04)', 
                  width: 'fit-content' 
                }}>
                  <button
                    onClick={() => setActiveSubTab('list')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: activeSubTab === 'list' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      color: activeSubTab === 'list' ? '#3b82f6' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Search size={14} /> Seguimiento y Registro
                  </button>
                  <button
                    onClick={() => setActiveSubTab('recepcion')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: activeSubTab === 'recepcion' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      color: activeSubTab === 'recepcion' ? '#10b981' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <ClipboardList size={14} /> Recepción de Productos
                  </button>
                </div>

                {activeSubTab === 'list' ? (
                  /* SUB-TAB 1: LISTADO Y REGISTRO */
                  <motion.div
                    key="subtab-list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Quick Stats Panel */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                      gap: '15px', 
                      marginBottom: '30px' 
                    }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>TOTAL OC ACTIVAS</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0' }}>{ocs.length}</h3>
                      </div>
                      <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: '500' }}>ENVIADAS</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0', color: '#3b82f6' }}>
                          {ocs.filter(o => o.estado === 'Enviada').length}
                        </h3>
                      </div>
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '500' }}>ACEPTADAS</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0', color: '#10b981' }}>
                          {ocs.filter(o => o.estado === 'Aceptada').length}
                        </h3>
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: '500' }}>ATRASADAS (ALERTA ROJA)</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0', color: '#ef4444' }}>
                          {ocs.filter(o => checkPlazos(o).isExpired).length}
                        </h3>
                      </div>
                    </div>

                    {/* Search and Action Bar */}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '25px', width: '100%', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                        <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Buscar por número de OC, proveedor..."
                          className="input-field"
                          style={{ paddingLeft: '48px', width: '100%' }}
                        />
                      </div>
                      
                      <button 
                        onClick={() => setView('create')} 
                        className="btn-primary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', height: '46px', flexShrink: 0 }}
                      >
                        <Plus size={20} /> Crear Nueva OC
                      </button>
                    </div>

                    {/* List Table */}
                    {loading ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
                        Cargando Órdenes de Compra...
                      </div>
                    ) : filteredOcs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                        <ShoppingBag size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                        No se encontraron Órdenes de Compra registradas.
                      </div>
                    ) : (
                      <div className="table-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>N° OC</th>
                              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>TIPO</th>
                              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>PROVEEDOR / RUT</th>
                              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>ARTÍCULOS</th>
                              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>FECHAS CLAVE</th>
                              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>ESTADO OC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOcs.map(oc => {
                              const plazos = checkPlazos(oc);
                              const rowStyle = plazos.isExpired ? {
                                background: 'rgba(239, 68, 68, 0.04)',
                                borderLeft: '4px solid #ef4444',
                                transition: 'all 0.3s ease'
                              } : {
                                borderLeft: '4px solid transparent',
                                transition: 'all 0.3s ease'
                              };

                              return (
                                <tr key={oc.id} style={{ 
                                  borderBottom: '1px solid var(--border-color)', 
                                  ...rowStyle
                                }} className="table-row">
                                  <td style={{ padding: '16px', fontWeight: '700', fontSize: '1rem', color: '#3b82f6' }}>
                                    {oc.numero_oc}
                                  </td>
                                  <td style={{ padding: '16px' }}>
                                    <span style={{ 
                                      padding: '4px 8px', 
                                      borderRadius: '6px', 
                                      fontSize: '0.8rem', 
                                      fontWeight: '700',
                                      background: oc.tipo_oc === 'AG' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                                      color: oc.tipo_oc === 'AG' ? '#3b82f6' : '#a78bfa'
                                    }}>
                                      {oc.tipo_oc}
                                    </span>
                                  </td>
                                  <td style={{ padding: '16px' }}>
                                    <div style={{ fontWeight: '600' }}>{oc.proveedor}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>RUT: {oc.rut_proveedor || 'No registrado'}</div>
                                  </td>
                                  <td style={{ padding: '16px', maxWidth: '250px' }}>
                                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {oc.ordenes_compra_articulos?.map((art, idx) => {
                                        const nombreArt = articulosCatalog[art.codigo_articulo] || `Cód ${art.codigo_articulo}`;
                                        return (
                                          <span key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'block' }}>
                                            <div style={{ fontWeight: '500', color: '#f8fafc', fontSize: '0.8rem' }}>{nombreArt}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                              <span>Cód: {art.codigo_articulo}</span>
                                              <span>Recibido: <strong style={{ color: art.cantidad_recepcionada >= art.cantidad ? '#10b981' : '#f59e0b' }}>{art.cantidad_recepcionada || 0} / {art.cantidad}</strong></span>
                                            </div>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                                    <div>Envío: {formatDate(oc.fecha_envio)}</div>
                                    {oc.fecha_aceptacion && (
                                      <div style={{ color: '#10b981', marginTop: '2px' }}>
                                        Acept.: {formatDate(oc.fecha_aceptacion)}
                                      </div>
                                    )}
                                    {plazos.isExpired && (
                                      <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontWeight: '600' }}>
                                        <AlertTriangle size={14} /> {plazos.alertMessage}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '16px' }}>
                                    <select 
                                      value={oc.estado} 
                                      onChange={(e) => handleUpdateEstado(oc.id, e.target.value)}
                                      className="input-field"
                                      style={{ 
                                        padding: '6px 12px', 
                                        fontSize: '0.85rem', 
                                        fontWeight: '600',
                                        width: 'auto',
                                        cursor: 'pointer',
                                        background: oc.estado === 'Enviada' ? 'rgba(59, 130, 246, 0.1)' : 
                                                    oc.estado === 'Aceptada' ? 'rgba(16, 185, 129, 0.1)' : 
                                                    oc.estado === 'Cancelada' ? 'rgba(239, 68, 68, 0.1)' : 
                                                    oc.estado === 'Completada' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.1)',
                                        color: oc.estado === 'Enviada' ? '#3b82f6' : 
                                               oc.estado === 'Aceptada' ? '#10b981' : 
                                               oc.estado === 'Cancelada' ? '#ef4444' : 
                                               oc.estado === 'Completada' ? '#10b981' : '#f59e0b',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                      }}
                                    >
                                      <option value="Enviada" style={{ background: '#1e293b' }}>Enviada</option>
                                      <option value="Aceptada" style={{ background: '#1e293b' }}>Aceptada</option>
                                      <option value="Cancelada" style={{ background: '#1e293b' }}>Cancelada</option>
                                      <option value="Aceptada con multa" style={{ background: '#1e293b' }}>Aceptada con multa (Atrasada)</option>
                                      <option value="Completada" style={{ background: '#1e293b' }}>Completada</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  /* SUB-TAB 2: RECEPCIÓN Y ENTREGAS PARCIALES */
                  <motion.div
                    key="subtab-recepcion"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', marginBottom: '30px' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '8px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ClipboardList size={22} /> Control de Recepciones de Bodega
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0 0 20px 0', lineHeight: '1.5' }}>
                        Seleccione una Orden de Compra para registrar la entrega física de los productos. Ingrese las cantidades parciales que han llegado en esta recepción. El sistema cambiará el estado de la OC a "Completada" de forma automática cuando todos los productos solicitados hayan ingresado.
                      </p>

                      {/* OC Selector */}
                      <div style={{ maxWidth: '500px', marginBottom: '25px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.85rem', color: '#f8fafc' }}>Seleccionar Orden de Compra Activa</label>
                        <select
                          value={selectedOcIdForRecepcion}
                          onChange={(e) => {
                            setSelectedOcIdForRecepcion(e.target.value);
                            setRecepcionQuantities({});
                          }}
                          className="input-field"
                          style={{ background: 'rgba(30, 41, 59, 0.5)', cursor: 'pointer' }}
                        >
                          <option value="">-- Seleccione una OC activa --</option>
                          {activeOcsForRecepcion.map(oc => (
                            <option key={oc.id} value={oc.id} style={{ background: '#1e293b' }}>
                              {oc.numero_oc} - {oc.proveedor} ({oc.estado})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Detail Panel of Selected OC */}
                      {(() => {
                        const selOc = ocs.find(o => o.id === selectedOcIdForRecepcion);
                        if (!selOc) {
                          return (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px dashed var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.005)' }}>
                              <Truck size={36} style={{ marginBottom: '10px', opacity: 0.3 }} />
                              Seleccione una Orden de Compra para desplegar los artículos y registrar ingresos.
                            </div>
                          );
                        }

                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ 
                              background: 'rgba(255,255,255,0.015)', 
                              border: '1px solid rgba(255,255,255,0.05)', 
                              borderRadius: '10px', 
                              padding: '20px'
                            }}
                          >
                            {/* OC Summary Info */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                              gap: '15px', 
                              borderBottom: '1px solid rgba(255,255,255,0.08)',
                              paddingBottom: '20px',
                              marginBottom: '20px',
                              fontSize: '0.9rem'
                            }}>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Proveedor</span>
                                <strong style={{ color: '#f8fafc' }}>{selOc.proveedor}</strong>
                                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>RUT: {selOc.rut_proveedor || 'No registrado'}</span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Tipo de OC</span>
                                <strong style={{ color: '#3b82f6' }}>{selOc.tipo_oc}</strong>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Estado de OC</span>
                                <span style={{ 
                                  padding: '2px 8px', 
                                  borderRadius: '6px', 
                                  fontSize: '0.8rem', 
                                  fontWeight: '700',
                                  background: selOc.estado === 'Enviada' ? 'rgba(59, 130, 246, 0.15)' : 
                                              selOc.estado === 'Aceptada' ? 'rgba(16, 185, 129, 0.15)' : 
                                              selOc.estado === 'Completada' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.15)',
                                  color: selOc.estado === 'Enviada' ? '#3b82f6' : 
                                         selOc.estado === 'Aceptada' ? '#10b981' : 
                                         selOc.estado === 'Completada' ? '#10b981' : '#f59e0b',
                                  display: 'inline-block',
                                  marginTop: '4px'
                                }}>
                                  {selOc.estado}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Fecha de Envío</span>
                                <strong style={{ color: '#f8fafc' }}>{formatDate(selOc.fecha_envio)}</strong>
                              </div>
                            </div>

                            {/* Articles Grid / Table for Partial Reception */}
                            <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '15px', color: '#f8fafc' }}>Artículos por Recepcionar</h4>
                            <div className="table-container" style={{ marginBottom: '25px', overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', fontSize: '0.8rem' }}>
                                    <th style={{ padding: '10px 12px', color: '#94a3b8' }}>ARTÍCULO</th>
                                    <th style={{ padding: '10px 12px', color: '#94a3b8', width: '120px' }}>SOLICITADO</th>
                                    <th style={{ padding: '10px 12px', color: '#94a3b8', width: '160px' }}>RECIBIDO ACUMULADO</th>
                                    <th style={{ padding: '10px 12px', color: '#94a3b8' }}>PROGRESO</th>
                                    <th style={{ padding: '10px 12px', color: '#94a3b8', width: '140px' }}>NUEVA RECEPCIÓN</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(selOc.ordenes_compra_articulos || []).map(art => {
                                    const nombreArt = articulosCatalog[art.codigo_articulo] || `Cód ${art.codigo_articulo}`;
                                    const cantSolicitada = art.cantidad || 1;
                                    const cantRecibida = art.cantidad_recepcionada || 0;
                                    const pct = Math.min(Math.round((cantRecibida / cantSolicitada) * 100), 100);

                                    return (
                                      <tr key={art.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                                        <td style={{ padding: '12px' }}>
                                          <div style={{ fontWeight: '600', color: '#f8fafc' }}>{nombreArt}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Código: {art.codigo_articulo}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: '600' }}>
                                          {cantSolicitada} uds.
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <span style={{ 
                                            fontWeight: '700', 
                                            color: cantRecibida >= cantSolicitada ? '#10b981' : '#f59e0b',
                                            background: cantRecibida >= cantSolicitada ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                            padding: '2px 6px',
                                            borderRadius: '4px'
                                          }}>
                                            {cantRecibida} / {cantSolicitada}
                                          </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', minWidth: '100px' }}>
                                            <div style={{ 
                                              flex: 1, 
                                              height: '8px', 
                                              background: 'rgba(255,255,255,0.05)', 
                                              borderRadius: '4px',
                                              border: '1px solid rgba(255,255,255,0.08)',
                                              overflow: 'hidden',
                                              position: 'relative'
                                            }}>
                                              <div style={{ 
                                                width: `${pct}%`, 
                                                height: '100%', 
                                                background: pct >= 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #10b981)',
                                                borderRadius: '4px',
                                                transition: 'width 0.4s ease-out'
                                              }} />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', width: '32px', textAlign: 'right', fontWeight: '600' }}>{pct}%</span>
                                          </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <input
                                            type="number"
                                            value={recepcionQuantities[art.id] || ''}
                                            onChange={(e) => handleRecepcionQtyChange(art.id, e.target.value)}
                                            placeholder="+ 0"
                                            className="input-field"
                                            style={{ 
                                              padding: '6px 10px', 
                                              fontSize: '0.85rem',
                                              textAlign: 'right',
                                              borderColor: (recepcionQuantities[art.id] && parseInt(recepcionQuantities[art.id]) > 0) ? '#10b981' : 'rgba(255,255,255,0.1)'
                                            }}
                                            min="0"
                                            disabled={cantRecibida >= cantSolicitada}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Submit Button */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
                              <button
                                onClick={handleRegisterRecepcion}
                                className="btn-primary"
                                style={{ 
                                  background: '#10b981', 
                                  color: '#ffffff', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '8px', 
                                  padding: '12px 24px',
                                  fontSize: '0.9rem',
                                  fontWeight: '700',
                                  borderColor: '#10b981'
                                }}
                                disabled={savingRecepcion}
                              >
                                {savingRecepcion ? 'Registrando...' : 'Registrar Entrega Parcial'}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              /* DENTAL DEPARTMENT */
              <motion.div
                key="dental-placeholder"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                style={{ 
                  padding: '60px 20px', 
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '20px',
                  maxWidth: '500px',
                  margin: '40px auto'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '50%', border: '1px dashed rgba(59, 130, 246, 0.3)' }}>
                  <Activity size={44} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px' }}>Seguimiento Dental</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                    Este panel permitirá gestionar el seguimiento de Órdenes de Compra del área odontológica.
                  </p>
                  <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '12px', fontStyle: 'italic' }}>
                    Estado: En desarrollo. Próximamente se replicarán las funcionalidades operacionales de Droguería.
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* CREATE OC VIEW */
          <motion.div
            key="create-view"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            className="glass-card"
            style={{ padding: '30px' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Truck size={28} color="#3b82f6" />
                <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Nueva Orden de Compra (OC)</h2>
              </div>
              <button onClick={() => setView('list')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeft size={16} /> Volver
              </button>
            </div>

            {/* Form layout grid */}
            <div className="responsive-grid-2" style={{ marginBottom: '30px' }}>
              {/* Lado Izquierdo - Datos Generales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={labelStyle}><FileText size={16} /> Número de OC</label>
                  <input
                    type="text"
                    value={formData.numero_oc}
                    onChange={e => setFormData(prev => ({ ...prev, numero_oc: e.target.value }))}
                    placeholder="Ej: 10452-87-SE26"
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Proveedor</label>
                  <input
                    type="text"
                    value={formData.proveedor}
                    onChange={e => setFormData(prev => ({ ...prev, proveedor: e.target.value }))}
                    placeholder="Ej: Droguería Chile S.A."
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={labelStyle}>RUT Proveedor</label>
                  <input
                    type="text"
                    value={formData.rut_proveedor}
                    onChange={e => setFormData(prev => ({ ...prev, rut_proveedor: e.target.value }))}
                    placeholder="Ej: 76.224.551-3"
                    className="input-field"
                  />
                </div>
              </div>

              {/* Lado Derecho - Config OC */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Tipo de OC</label>
                  <select
                    value={formData.tipo_oc}
                    onChange={e => setFormData(prev => ({ ...prev, tipo_oc: e.target.value }))}
                    className="input-field"
                  >
                    <option value="AG">AG (Convenio Marco AG)</option>
                    <option value="SE">SE (Servicio de Entrega)</option>
                    <option value="CM">CM (Convenio)</option>
                    <option value="L1">L1 (Licitación Pública)</option>
                  </select>
                </div>

                {/* Conditional Field: Plazo de Días */}
                {formData.tipo_oc !== 'AG' ? (
                  <div>
                    <label style={labelStyle}>Plazo de días (Aceptada ➔ Atrasada)</label>
                    <input
                      type="number"
                      value={formData.dias_plazo_atraso}
                      onChange={e => setFormData(prev => ({ ...prev, dias_plazo_atraso: e.target.value }))}
                      placeholder="Ej: 10 días"
                      className="input-field"
                      min="1"
                    />
                    <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Cantidad personalizada de días antes de marcar como atraso de entrega.
                    </small>
                  </div>
                ) : (
                  <div style={{ 
                    background: 'rgba(59, 130, 246, 0.05)', 
                    border: '1px solid rgba(59, 130, 246, 0.2)', 
                    padding: '15px', 
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#94a3b8'
                  }}>
                    <strong>Lógica Convenio AG Activa:</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>Máximo <strong>4 días</strong> para pasar de <strong>Enviada</strong> a <strong>Aceptada</strong>.</li>
                      <li>Máximo <strong>4 días</strong> adicionales para entregar tras ser aceptada antes de marcarse como <strong>Atrasada</strong>.</li>
                    </ul>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Estado Inicial</label>
                  <select
                    value={formData.estado}
                    onChange={e => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                    className="input-field"
                  >
                    <option value="Enviada">Enviada</option>
                    <option value="Aceptada">Aceptada</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ARTICULOS DE LA OC */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '30px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Artículos de la OC</h3>
                <button onClick={handleAddRow} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.85rem' }}>
                  <Plus size={16} /> Añadir Artículo
                </button>
              </div>

              {/* Dynamic Rows Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {articulosForm.map((row) => (
                  <ArticleRow 
                    key={row.key}
                    rowKey={row.key}
                    row={row}
                    onChange={handleRowChange}
                    onRemove={handleRemoveRow}
                    showRemove={articulosForm.length > 1}
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '25px' }}>
              <button onClick={() => setView('list')} className="btn-secondary" style={{ minWidth: '120px' }}>
                Cancelar
              </button>
              <button onClick={handleSaveOC} className="btn-primary" style={{ minWidth: '200px' }} disabled={loading}>
                {loading ? 'Guardando...' : 'Crear OC y Registrar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Isolated Sub-component to manage single article row state lookup
const ArticleRow = ({ rowKey, row, onChange, onRemove, showRemove }) => {
  const { nombre, loading, exists } = useArsenalAutoSuggest(row.codigo);

  // Sync auto-suggest back to parent row state
  useEffect(() => {
    if (loading) return;
    if (exists && nombre) {
      onChange(rowKey, 'nombre', nombre);
      onChange(rowKey, 'isNew', false);
    } else if (row.codigo.trim() !== '') {
      onChange(rowKey, 'nombre', '');
      onChange(rowKey, 'isNew', true);
    } else {
      onChange(rowKey, 'nombre', '');
      onChange(rowKey, 'isNew', false);
    }
  }, [nombre, exists, loading]);

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '150px 1fr 120px auto', 
      gap: '15px', 
      alignItems: 'start',
      background: 'rgba(255,255,255,0.01)',
      border: '1px solid var(--border-color)',
      padding: '15px',
      borderRadius: '8px'
    }}>
      <div>
        <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '600' }}>CÓDIGO</label>
        <input
          type="text"
          value={row.codigo}
          onChange={e => onChange(rowKey, 'codigo', e.target.value)}
          placeholder="Ej: 1227"
          className="input-field"
        />
      </div>

      <div>
        <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '600' }}>NOMBRE / DESCRIPCIÓN</label>
        {row.codigo.trim() === '' ? (
          <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: '#64748b', fontSize: '0.85rem' }}>
            Ingrese código para buscar o registrar...
          </div>
        ) : loading ? (
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '10px 0' }}>Buscando en catálogo base...</div>
        ) : exists && nombre ? (
          <div style={{ padding: '10px 16px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: '600', fontSize: '0.9rem' }}>
            {nombre} (Registrado)
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={14} /> El artículo no existe. Escriba el nombre para crearlo:
            </span>
            <input
              type="text"
              value={row.tempName}
              onChange={e => onChange(rowKey, 'tempName', e.target.value)}
              placeholder="Ej: Paracetamol 500mg comprimidos"
              className="input-field"
              style={{ borderColor: '#f59e0b' }}
            />
          </div>
        )}
      </div>

      <div>
        <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '600' }}>CANTIDAD</label>
        <input
          type="number"
          value={row.cantidad}
          onChange={e => onChange(rowKey, 'cantidad', e.target.value)}
          placeholder="Ej: 100"
          className="input-field"
          min="1"
        />
      </div>

      {showRemove && (
        <button 
          onClick={() => onRemove(rowKey)} 
          className="btn-secondary" 
          style={{ 
            marginTop: '25px', 
            padding: '10px', 
            borderColor: 'rgba(239,68,68,0.2)', 
            color: '#ef4444',
            background: 'rgba(239,68,68,0.05)'
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};

export default SeguimientoOCModule;
