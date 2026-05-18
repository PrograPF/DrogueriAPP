import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, Trash2, Save, Printer, AlertTriangle, ArrowLeft, History, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import useArsenalLookup from '../../hooks/useArsenalLookup';
import { labelStyle, thStyle, tdStyle } from '../../styles/sharedStyles';

const RevisionBodegaModule = () => {
  const [activeTab, setActiveTab] = useState('nueva'); // 'nueva', 'historial'
  const [flowStep, setFlowStep] = useState('ingreso'); // 'ingreso', 'informe'
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alertas, setAlertas] = useState([]);
  const [sessionId, setSessionId] = useState('');
  
  // Estado Historial
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Estado del formulario actual
  const [form, setForm] = useState({
    tipo_documento: 'Factura',
    numero_documento: '',
    codigo: '',
    lote: '',
    isp: '',
    cantidad: ''
  });

  const nombreArticulo = useArsenalLookup(form.codigo);

  // Cargar Historial
  useEffect(() => {
    if (activeTab === 'historial') {
      cargarHistorial();
    }
  }, [activeTab]);

  const cargarHistorial = async () => {
    setLoadingHistorial(true);
    try {
      // Obtenemos los nombres de articulos también para mostrar en el detalle
      const { data, error } = await supabase
        .from('revisiones_bodega')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      // Agrupar por session_id
      const grupos = {};
      data.forEach(item => {
        if (!grupos[item.session_id]) {
          grupos[item.session_id] = {
            session_id: item.session_id,
            fecha: new Date(item.created_at || item.fecha).toLocaleString(),
            items: [],
            totalArticulos: 0,
            totalUnidades: 0
          };
        }
        grupos[item.session_id].items.push({
          id: item.id,
          codigo: item.codigo_articulo,
          nombre: 'Consultando...',
          lote: item.lote,
          isp: item.isp,
          cantidad: item.cantidad,
          tipo_documento: item.tipo_documento || '',
          numero_documento: item.numero_documento || ''
        });
        grupos[item.session_id].totalUnidades += item.cantidad;
        grupos[item.session_id].totalArticulos += 1;
      });

      setHistorial(Object.values(grupos));
    } catch (err) {
      alert("Error al cargar historial: " + err.message);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddItem = () => {
    if (!form.codigo || !form.cantidad || parseInt(form.cantidad) <= 0) {
      alert("Por favor ingrese al menos el Código y una Cantidad válida.");
      return;
    }
    
    const newItem = {
      id: Date.now().toString(),
      codigo: form.codigo,
      nombre: nombreArticulo || 'Desconocido',
      lote: form.lote || 'S/L',
      isp: form.isp || 'S/I',
      cantidad: parseInt(form.cantidad),
      tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento || 'S/D'
    };

    setItems(prev => [...prev, newItem]);
    
    // No borramos tipo_documento ni numero_documento para que sirvan para el siguiente artículo escaneado en la misma guía/factura
    setForm(prev => ({ ...prev, codigo: '', lote: '', isp: '', cantidad: '' }));
  };

  const handleRemoveItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const calcularCrucePendientes = async (itemsToProcess) => {
    const { data: pendientesVigentes, error: pendError } = await supabase
      .from('pendientes')
      .select('*, articulos(codigo, nombre), centros(nombre)')
      .eq('es_vigente', true);

    if (pendError) throw pendError;

    const sumIngresado = itemsToProcess.reduce((acc, curr) => {
      if (!acc[curr.codigo]) acc[curr.codigo] = { nombre: curr.nombre, total: 0 };
      acc[curr.codigo].total += curr.cantidad;
      return acc;
    }, {});

    const agrupacionPendientes = {};
    pendientesVigentes.forEach(p => {
      const cod = p.articulos?.codigo;
      if (!cod) return;
      if (!agrupacionPendientes[cod]) agrupacionPendientes[cod] = [];
      agrupacionPendientes[cod].push({
        centro: p.centros?.nombre || 'Desconocido',
        cantidadPendiente: p.pendiente,
        id: p.id
      });
    });

    const nuevasAlertas = [];
    Object.keys(sumIngresado).forEach(cod => {
      const ingresadoTotal = sumIngresado[cod].total;
      if (agrupacionPendientes[cod]) {
        let totalDeuda = 0;
        agrupacionPendientes[cod].forEach(deuda => totalDeuda += deuda.cantidadPendiente);
        let porcentaje = Math.min((ingresadoTotal / totalDeuda) * 100, 100).toFixed(1);
        
        nuevasAlertas.push({
          codigo: cod,
          nombre: sumIngresado[cod].nombre,
          ingresado: ingresadoTotal,
          deudaTotal: totalDeuda,
          porcentajeCubierto: porcentaje,
          detalleCentros: agrupacionPendientes[cod]
        });
      }
    });

    return nuevasAlertas;
  };

  const handleFinalizar = async () => {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const currentSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      setSessionId(currentSessionId);

      const insertData = items.map(item => ({
        session_id: currentSessionId,
        codigo_articulo: item.codigo,
        lote: item.lote,
        isp: item.isp,
        cantidad: item.cantidad,
        tipo_documento: item.tipo_documento,
        numero_documento: item.numero_documento
      }));

      const { error: insertError } = await supabase.from('revisiones_bodega').insert(insertData);
      if (insertError) throw insertError;

      const nuevasAlertas = await calcularCrucePendientes(items);
      setAlertas(nuevasAlertas);
      setFlowStep('informe');
    } catch (err) {
      console.error(err);
      alert("Error al procesar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const verSesionHistorial = async (sesion) => {
    setLoadingHistorial(true);
    try {
      // Para el historial, cargamos los items en el estado,
      // corremos el cruce (para ver si a día de hoy esos códigos sirven)
      setSessionId(sesion.session_id);
      
      // Intentamos recuperar nombres (simulado rápido)
      const itemsCompletos = sesion.items.map(it => ({
        ...it,
        nombre: it.nombre !== 'Consultando...' ? it.nombre : 'Artículo ' + it.codigo
      }));
      
      setItems(itemsCompletos);
      const nuevasAlertas = await calcularCrucePendientes(itemsCompletos);
      setAlertas(nuevasAlertas);
      
      // Cambiamos a la pestaña nueva pero en paso de informe (para imprimir)
      setActiveTab('nueva');
      setFlowStep('informe');
    } catch(err) {
      alert("Error cargando detalles: " + err.message);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleEliminarHistorial = async (sessionId) => {
    if (!window.confirm("¿Está seguro de que desea eliminar esta revisión y todos sus artículos? Esta acción no se puede deshacer.")) {
      return;
    }
    
    setLoadingHistorial(true);
    try {
      const { error } = await supabase
        .from('revisiones_bodega')
        .delete()
        .eq('session_id', sessionId);
        
      if (error) throw error;
      
      // Recargar la tabla de historial
      cargarHistorial();
    } catch (err) {
      alert("Error al eliminar: " + err.message);
      setLoadingHistorial(false);
    }
  };

  const handleNuevaRevision = () => {
    setItems([]);
    setAlertas([]);
    setSessionId('');
    setFlowStep('ingreso');
    setActiveTab('nueva');
  };

  const handlePrint = () => window.print();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* NAVEGACIÓN POR PESTAÑAS (Oculto en impresión) */}
      {flowStep !== 'informe' && (
        <div className="no-print" style={{ display: 'flex', gap: '15px', marginBottom: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
          <button 
            onClick={() => setActiveTab('nueva')}
            style={{ 
              background: 'transparent', border: 'none', color: activeTab === 'nueva' ? '#3b82f6' : '#94a3b8', 
              fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer', padding: '10px 20px',
              borderBottom: activeTab === 'nueva' ? '3px solid #3b82f6' : '3px solid transparent',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <ClipboardCheck size={20} /> Ingreso Revisión
          </button>
          <button 
            onClick={() => setActiveTab('historial')}
            style={{ 
              background: 'transparent', border: 'none', color: activeTab === 'historial' ? '#3b82f6' : '#94a3b8', 
              fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer', padding: '10px 20px',
              borderBottom: activeTab === 'historial' ? '3px solid #3b82f6' : '3px solid transparent',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <History size={20} /> Historial
          </button>
        </div>
      )}

      {/* PESTAÑA: HISTORIAL */}
      {activeTab === 'historial' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '20px', color: '#f8fafc' }}>
              Historial de Revisiones
            </h3>
            {loadingHistorial ? (
              <p style={{ color: '#94a3b8' }}>Cargando historial...</p>
            ) : historial.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No hay revisiones previas registradas.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <th style={thStyle}>FECHA Y HORA</th>
                      <th style={thStyle}>ID DE SESIÓN</th>
                      <th style={thStyle}>TOTAL ÍTEMS</th>
                      <th style={thStyle}>TOTAL UNIDADES</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={tdStyle}>{h.fecha}</td>
                        <td style={tdStyle}>{h?.session_id?.substring(0,8)?.toUpperCase() || 'N/A'}</td>
                        <td style={tdStyle}>{h.totalArticulos}</td>
                        <td style={tdStyle}>{h.totalUnidades}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button 
                            onClick={() => verSesionHistorial(h)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}
                          >
                            <Eye size={14} /> Ver y Reimprimir
                          </button>
                          <button 
                            onClick={() => handleEliminarHistorial(h.session_id)}
                            className="btn-secondary"
                            style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            title="Eliminar esta revisión completa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* PESTAÑA: NUEVA REVISIÓN (INGRESO O INFORME) */}
      {activeTab === 'nueva' && flowStep === 'ingreso' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{ padding: '30px', marginBottom: '30px' }}>
            <div className="responsive-grid-auto" style={{ alignItems: 'end', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <label style={labelStyle}>Documento</label>
                <select name="tipo_documento" value={form.tipo_documento} onChange={handleInputChange} className="input-field">
                  <option value="Factura">Factura</option>
                  <option value="Guía de Despacho">Guía de Despacho</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Nº de Documento</label>
                <input name="numero_documento" value={form.numero_documento} onChange={handleInputChange} className="input-field" placeholder="Escriba el número..." />
              </div>
            </div>

            <div className="responsive-grid-auto" style={{ alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Código Artículo</label>
                <input name="codigo" value={form.codigo} onChange={handleInputChange} className="input-field" placeholder="Ej: 888" autoFocus />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Descripción (Auto)</label>
                <div style={{ 
                  padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', 
                  color: form.codigo ? '#3b82f6' : '#64748b', fontWeight: '600',
                  border: '1px dashed var(--border-color)', minHeight: '45px', display: 'flex', alignItems: 'center'
                }}>
                  {nombreArticulo}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Lote</label>
                <input name="lote" value={form.lote} onChange={handleInputChange} className="input-field" placeholder="Lote..." />
              </div>
              <div>
                <label style={labelStyle}>Registro ISP</label>
                <input name="isp" value={form.isp} onChange={handleInputChange} className="input-field" placeholder="ISP..." />
              </div>
              <div>
                <label style={labelStyle}>Cantidad</label>
                <input type="number" name="cantidad" value={form.cantidad} onChange={handleInputChange} className="input-field" placeholder="0" />
              </div>
              <div>
                <button onClick={handleAddItem} className="btn-primary" style={{ width: '100%', padding: '12px', background: '#3b82f6' }}>
                  <Plus size={20} /> Añadir
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Lista Actual */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                Lista de Revisión Actual ({items.length} ítems)
              </h3>
              {items.length > 0 && (
                <button onClick={handleFinalizar} className="btn-primary" style={{ background: '#10b981' }} disabled={loading}>
                  {loading ? 'Procesando...' : <><Save size={18} /> Guardar y Cotejar</>}
                </button>
              )}
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={thStyle}>CÓDIGO</th>
                    <th style={thStyle}>DESCRIPCIÓN</th>
                    <th style={thStyle}>LOTE</th>
                    <th style={thStyle}>DOC. / ISP</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>CANTIDAD</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>X</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                          No hay artículos agregados todavía.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <motion.tr key={item.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={tdStyle}><strong>{item.codigo}</strong></td>
                          <td style={tdStyle}>{item.nombre}</td>
                          <td style={tdStyle}>{item.lote}</td>
                          <td style={tdStyle}>
                            <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 'bold' }}>{item.tipo_documento} {item.numero_documento}</div>
                            <div style={{ fontSize: '0.8rem' }}>ISP: {item.isp}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#10b981' }}>{item.cantidad}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button onClick={() => handleRemoveItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}>
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* PESTAÑA: NUEVA REVISIÓN -> VISTA INFORME */}
      {activeTab === 'nueva' && flowStep === 'informe' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="informes-container">
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button onClick={handleNuevaRevision} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={18} /> Volver a Nueva Revisión
            </button>
            <button onClick={handlePrint} className="btn-primary" style={{ background: '#10b981' }}>
              <Printer size={18} /> Imprimir Comprobante
            </button>
          </div>

          <div className="print-only" style={{ display: 'none', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src="/logo-desam.png" alt="Logo DESAM" style={{ height: '50px' }} />
                <div style={{ textAlign: 'left' }}>
                  <h2 style={{ margin: 0, fontSize: '12pt', fontWeight: '800' }}>DESAM</h2>
                  <p style={{ margin: 0, fontSize: '9pt', fontWeight: '600' }}>Unidad de Droguería</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ fontSize: '16pt', margin: 0, fontWeight: '900' }}>INFORME DE REVISIÓN EN BODEGA</h1>
                <p style={{ margin: 0, fontSize: '8pt' }}>ID: {sessionId?.substring(0,8)?.toUpperCase() || ''}</p>
              </div>
            </div>
          </div>

          <div className="no-break no-print" style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: alertas?.length > 0 ? '#f59e0b' : '#10b981', marginBottom: '15px' }}>
              <AlertTriangle size={20} /> 
              {alertas?.length > 0 ? "Alertas de Cruce con Pendientes" : "No hay cruce con artículos pendientes"}
            </h3>
            
            {alertas?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {(alertas || []).map((alerta, idx) => (
                  <div key={idx} style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '15px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: '700', marginBottom: '5px' }}>CÓDIGO {alerta?.codigo}</div>
                    <div style={{ fontWeight: '600', marginBottom: '10px', fontSize: '0.9rem', lineHeight: '1.2' }}>{alerta?.nombre}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px' }}>
                      <span style={{ color: '#94a3b8' }}>Ingresado Total:</span>
                      <span style={{ fontWeight: '800', color: '#10b981' }}>{alerta?.ingresado}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px' }}>
                      <span style={{ color: '#94a3b8' }}>Deuda Total (Pendiente):</span>
                      <span style={{ fontWeight: '800', color: '#ef4444' }}>{alerta?.deudaTotal}</span>
                    </div>
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(245, 158, 11, 0.3)' }}>
                      <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: '700' }}>Suministro Posible: {alerta?.porcentajeCubierto}%</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '5px' }}>
                        Requerido por: {(alerta?.detalleCentros || []).map(c => `${c?.centro} (${c?.cantidadPendiente})`).join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="print-container">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '15px', color: '#f8fafc' }} className="no-print">
              Detalle de Artículos Revisados
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={thStyle} className="col-codigo">CÓDIGO</th>
                  <th style={thStyle} className="col-descripcion">DESCRIPCIÓN</th>
                  <th style={thStyle} className="col-lote">LOTE</th>
                  <th style={thStyle} className="col-isp">DOCUMENTO / ISP</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} className="col-cantidad">CANTIDAD</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={tdStyle}><strong>{item?.codigo}</strong></td>
                    <td style={tdStyle}>{item?.nombre}</td>
                    <td style={tdStyle}>{item?.lote}</td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>{item?.tipo_documento} {item?.numero_documento}</div>
                      <div style={{ fontSize: '8pt' }}>ISP: {item?.isp}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800' }}>{item?.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="print-only" style={{ display: 'none', marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #000', fontSize: '10pt' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', width: '300px' }}>
                  <br /><br />
                  <p style={{ margin: 0 }}><strong>_________________________________</strong></p>
                  <p style={{ margin: '5px 0 0 0' }}>Firma y Timbre Responsable de Revisión</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            @media print {
              body, html { background: white !important; color: black !important; padding: 1cm !important; box-sizing: border-box !important; }
              .no-print { display: none !important; }
              .print-only { display: block !important; }
              .print-container { width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
              .informes-container { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
              table { width: 100% !important; border: 1px solid #000 !important; table-layout: fixed; }
              th, td { 
                border: 1px solid #000 !important; color: black !important; padding: 6px !important; 
                font-size: 9pt !important; opacity: 1 !important; background: white !important;
                word-wrap: break-word; overflow-wrap: break-word;
              }
              th { background: #eee !important; font-weight: bold !important; }
              .no-break { page-break-inside: avoid; }
              
              th.col-codigo { width: 10% !important; }
              th.col-descripcion { width: 35% !important; }
              th.col-lote { width: 25% !important; }
              th.col-isp { width: 15% !important; }
              th.col-cantidad { width: 15% !important; }

              @page { size: portrait; margin: 0; }
            }
          `}</style>
        </motion.div>
      )}

    </div>
  );
};

export default RevisionBodegaModule;
