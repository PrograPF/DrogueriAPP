import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, Trash2, Save, Printer, AlertTriangle, ArrowLeft, History, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import useArsenalLookup from '../../hooks/useArsenalLookup';
import { labelStyle, thStyle, tdStyle } from '../../styles/sharedStyles';
import { formatDate, formatDateTime } from '../../utils/dateFormatter';

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
    vencimiento: '',
    isp: '',
    cantidad: '',
    carta_canje: false,
    valor_sin_iva: ''
  });

  // OCs y selección
  const [loadingOcs, setLoadingOcs] = useState(false);
  const [ocs, setOcs] = useState([]);
  const [ocSeleccionada, setOcSeleccionada] = useState(null);
  const [articulosOc, setArticulosOc] = useState([]);
  const [articulosCatalog, setArticulosCatalog] = useState({});

  const nombreArticulo = useArsenalLookup(form.codigo);

  // Auto-detectar lote, vencimiento e ISP desde la tabla 'articulos_variantes' en Supabase
  useEffect(() => {
    if (form.codigo) {
      let isCurrent = true;

      const timeoutId = setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from('articulos_variantes')
            .select('lote, vencimiento, isp')
            .eq('codigo_articulo', form.codigo.trim())
            .order('vencimiento', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (!error && data && isCurrent) {
            setForm(prev => ({
              ...prev,
              vencimiento: data.vencimiento || prev.vencimiento,
              lote: prev.lote || data.lote || '',
              isp: prev.isp || data.isp || ''
            }));
          }
        } catch (err) {
          if (isCurrent) {
            console.error("Error auto-detectando lote/vencimiento/isp:", err);
          }
        }
      }, 500);

      return () => {
        isCurrent = false;
        clearTimeout(timeoutId);
      };
    }
  }, [form.codigo]);

  // Cargar OCs disponibles para asociar a una revisión de bodega
  // Se muestran solo las OCs con recepción física iniciada o completada
  const cargarOcsDisponibles = async () => {
    setLoadingOcs(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra')
        .select(`
          *,
          ordenes_compra_articulos (
            id,
            codigo_articulo,
            cantidad,
            estado_recepcion
          )
        `)
        .in('estado_recepcion', ['Recepcion Completa', 'Recepcion Parcial', 'Recepcion Parcial/Rechazo'])
        .order('fecha_envio', { ascending: false });
      if (error) throw error;
      setOcs(data || []);
    } catch (err) {
      console.error('Error al cargar OCs disponibles:', err);
    } finally {
      setLoadingOcs(false);
    }
  };

  // Seleccionar una OC y cargar solo sus artículos recepcionados
  const seleccionarOc = async (oc) => {
    setOcSeleccionada(oc);
    setItems([]);
    setForm({
      tipo_documento: 'Factura',
      numero_documento: '',
      codigo: '',
      lote: '',
      vencimiento: '',
      isp: '',
      cantidad: '',
      carta_canje: false,
      valor_sin_iva: ''
    });

    // Filtrar estrictamente los artículos con estado 'Recepcionado'
    const arts = (oc.ordenes_compra_articulos || []).filter(a => a.estado_recepcion === 'Recepcionado');
    if (arts.length === 0) {
      setArticulosOc([]);
      return;
    }

    const codigos = arts.map(a => a.codigo_articulo);
    try {
      const { data, error } = await supabase
        .from('articulos')
        .select('codigo, descripcion')
        .in('codigo', codigos);

      if (error) throw error;

      const mapping = {};
      (data || []).forEach(a => {
        mapping[a.codigo.trim()] = a.descripcion;
      });

      setArticulosCatalog(mapping);

      const combinados = arts.map(art => ({
        ...art,
        descripcion: mapping[art.codigo_articulo?.trim()] || 'Artículo ' + art.codigo_articulo
      }));

      setArticulosOc(combinados);
      // El formulario inicia completamente vacío
    } catch (err) {
      console.error('Error al obtener artículos de la OC:', err);
      alert('Error al cargar artículos de la OC: ' + err.message);
    }
  };

  // Cargar OCs al iniciar
  useEffect(() => {
    cargarOcsDisponibles();
  }, []);

  // Cargar Historial
  useEffect(() => {
    if (activeTab === 'historial') {
      cargarHistorial();
    }
  }, [activeTab]);

  const cargarHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const { data, error } = await supabase
        .from('revisiones_bodega')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      // Consultar todos los artículos para tener nombres
      const { data: articulos, error: artError } = await supabase
        .from('articulos')
        .select('codigo, descripcion');
      
      const articulosMap = {};
      if (!artError && articulos) {
        articulos.forEach(a => {
          articulosMap[a.codigo] = a.descripcion;
        });
      }

      // Consultar variantes para tener vencimientos por lote
      const { data: variantes, error: varError } = await supabase
        .from('articulos_variantes')
        .select('codigo_articulo, lote, vencimiento');

      const vencimientosMap = {};
      if (!varError && variantes) {
        variantes.forEach(v => {
          const key = `${v.codigo_articulo?.trim()}_${v.lote?.trim().toUpperCase()}`;
          vencimientosMap[key] = v.vencimiento;
        });
      }

      // Agrupar por session_id
      const grupos = {};
      data.forEach(item => {
        if (!grupos[item.session_id]) {
          grupos[item.session_id] = {
            session_id: item.session_id,
            fecha: formatDateTime(item.created_at || item.fecha),
            items: [],
            totalArticulos: 0,
            totalUnidades: 0
          };
        }
        
        const nombreArt = articulosMap[item.codigo_articulo] || 'Artículo ' + item.codigo_articulo;
        const keyVenc = `${item.codigo_articulo?.trim()}_${item.lote?.trim().toUpperCase()}`;
        const vencimiento = vencimientosMap[keyVenc] || 'S/V';

        grupos[item.session_id].items.push({
          id: item.id,
          codigo: item.codigo_articulo,
          nombre: nombreArt,
          lote: item.lote,
          vencimiento: vencimiento,
          isp: item.isp,
          amount: item.cantidad, // wait, is it amount or cantidad? The original had cantidad. Let me keep cantidad.
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
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAddItem = (e) => {
    if (e) e.preventDefault();

    if (!form.tipo_documento?.trim()) {
      alert("Por favor seleccione el Tipo de Documento.");
      return;
    }
    if (!form.numero_documento?.trim()) {
      alert("Por favor ingrese el Nº de Documento.");
      return;
    }
    if (!form.codigo?.trim()) {
      alert("Por favor seleccione un Artículo de la lista de recepcionados.");
      return;
    }
    if (!form.lote?.trim()) {
      alert("Por favor ingrese el Lote.");
      return;
    }
    if (!form.vencimiento) {
      alert("Por favor ingrese la Fecha de Vencimiento.");
      return;
    }
    if (!form.isp?.trim()) {
      alert("Por favor ingrese el Registro ISP.");
      return;
    }
    const cantidad = parseInt(form.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor ingrese una Cantidad válida mayor a 0.");
      return;
    }
    if (form.valor_sin_iva === '' || form.valor_sin_iva === null || form.valor_sin_iva === undefined) {
      alert("Por favor ingrese el Precio Unitario Sin IVA ($). Puede ser 0 o superior.");
      return;
    }
    const valorSinIva = parseFloat(form.valor_sin_iva);
    if (isNaN(valorSinIva) || valorSinIva < 0) {
      alert("El Precio Unitario Sin IVA debe ser un número mayor o igual a 0.");
      return;
    }

    // Validar Carta de Canje si tiene 14 meses o menos de vencimiento
    const hoy = new Date();
    const vencimiento = new Date(form.vencimiento);
    const añosDiff = vencimiento.getFullYear() - hoy.getFullYear();
    const mesesDiff = vencimiento.getMonth() - hoy.getMonth();
    const totalMeses = añosDiff * 12 + mesesDiff;

    if (totalMeses <= 14 && !form.carta_canje) {
      alert("Este artículo debe tener Carta de Canje (vencimiento igual o menor a 14 meses).");
      return;
    }

    const valorConIva = Math.round(valorSinIva * 1.19);

    const newItem = {
      id: Date.now().toString(),
      codigo: form.codigo,
      nombre: articulosCatalog[form.codigo] || nombreArticulo || 'Desconocido',
      lote: form.lote.trim(),
      vencimiento: form.vencimiento,
      isp: form.isp.trim(),
      cantidad: cantidad,
      tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento.trim(),
      carta_canje: form.carta_canje ? 'SI' : 'NO',
      valor_sin_iva: valorSinIva,
      valor_con_iva: valorConIva,
      total_sin_iva: cantidad * valorSinIva,
      total_con_iva: cantidad * valorConIva
    };

    setItems(prev => [...prev, newItem]);
    
    // Limpiar completamente el formulario de artículo para agregar otro desde cero
    setForm(prev => ({ 
      ...prev, 
      codigo: '', 
      lote: '', 
      vencimiento: '', 
      isp: '', 
      cantidad: '',
      carta_canje: false,
      valor_sin_iva: ''
    }));
  };
  const handleRemoveItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const calcularCrucePendientes = async (itemsToProcess) => {
    const { data: pendientesVigentes, error: pendError } = await supabase
      .from('pendientes')
      .select('*, centros(nombre)')
      .eq('es_vigente', true);

    if (pendError) throw pendError;

    const sumIngresado = itemsToProcess.reduce((acc, curr) => {
      if (!acc[curr.codigo]) acc[curr.codigo] = { nombre: curr.nombre, total: 0 };
      acc[curr.codigo].total += curr.cantidad;
      return acc;
    }, {});

    const agrupacionPendientes = {};
    pendientesVigentes.forEach(p => {
      const cod = p.codigo_articulo;
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

      // 1. Insertar en revisiones_bodega (historial)
      const insertData = items.map(item => ({
        session_id: currentSessionId,
        codigo_articulo: item.codigo,
        lote: item.lote,
        isp: item.isp,
        cantidad: item.cantidad,
        tipo_documento: item.tipo_documento,
        numero_documento: item.numero_documento,
        numero_oc: ocSeleccionada ? ocSeleccionada.numero_oc : null
      }));

      const { error: insertError } = await supabase.from('revisiones_bodega').insert(insertData);
      if (insertError) throw insertError;

      // 2. Insertar en articulos_variantes (inventario físico de lotes)
      const insertVariantes = items.map(item => ({
        codigo_articulo: item.codigo,
        lote: item.lote,
        vencimiento: item.vencimiento || null,
        cantidad: item.cantidad,
        carta_canje: item.carta_canje || 'NO',
        estado: 'VIGENTE',
        comentario: `Ingreso desde Revisión Bodega (${item.tipo_documento} N° ${item.numero_documento})`,
        ultimo_valor_sin_iva: item.valor_sin_iva || 0,
        ultimo_valor_con_iva: item.valor_con_iva || 0,
        total_sin_iva: item.total_sin_iva || 0,
        total_con_iva: item.total_con_iva || 0,
        isp: item.isp || 'S/I',
        fecha_ingreso: new Date().toISOString().split('T')[0]
      }));

      const { error: insertVarError } = await supabase.from('articulos_variantes').insert(insertVariantes);
      if (insertVarError) throw insertVarError;

      // Nota: La revisión de bodega es un proceso independiente.
      // El estado de los artículos en ordenes_compra_articulos es gestionado
      // exclusivamente desde el módulo de Seguimiento de OC.

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
      setSessionId(sesion.session_id);
      
      // Recuperar nombres actualizados
      const { data: articulos, error: artError } = await supabase
        .from('articulos')
        .select('codigo, descripcion');
      
      const articulosMap = {};
      if (!artError && articulos) {
        articulos.forEach(a => {
          articulosMap[a.codigo] = a.descripcion;
        });
      }

      // Recuperar vencimientos por lote
      const { data: variantes, error: varError } = await supabase
        .from('articulos_variantes')
        .select('codigo_articulo, lote, vencimiento');

      const vencimientosMap = {};
      if (!varError && variantes) {
        variantes.forEach(v => {
          const key = `${v.codigo_articulo?.trim()}_${v.lote?.trim().toUpperCase()}`;
          vencimientosMap[key] = v.vencimiento;
        });
      }
      
      const itemsCompletos = sesion.items.map(it => {
        const nombreArt = articulosMap[it.codigo] || it.nombre;
        const keyVenc = `${it.codigo?.trim()}_${it.lote?.trim().toUpperCase()}`;
        const vencimiento = vencimientosMap[keyVenc] || it.vencimiento || 'S/V';
        return {
          ...it,
          nombre: nombreArt,
          vencimiento: vencimiento
        };
      });
      
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
          {!ocSeleccionada ? (
            <div className="glass-card" style={{ padding: '30px', marginBottom: '30px' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Seleccione la Orden de Compra (OC) a Revisar
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
                Solo se muestran las OCs que han sido recepcionadas en bodega (con estado Recepción Completa o Incompleta).
              </p>

              {loadingOcs ? (
                <p style={{ color: '#94a3b8' }}>Cargando órdenes de compra...</p>
              ) : ocs.length === 0 ? (
                <p style={{ color: '#64748b', fontStyle: 'italic' }}>No hay órdenes de compra recepcionadas listas para revisión física en bodega.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                  {ocs.map(oc => (
                    <div 
                      key={oc.id} 
                      onClick={() => seleccionarOc(oc)}
                      style={{
                        padding: '16px 20px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.border = '1px solid rgba(59, 130, 246, 0.4)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: '800', color: '#3b82f6', fontSize: '1.05rem' }}>{oc.numero_oc}</span>
                          <span style={{ 
                            background: 'rgba(16, 185, 129, 0.15)', 
                            color: '#10b981', 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.75rem', 
                            fontWeight: '700' 
                          }}>
                            {oc.estado}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '4px', fontWeight: '500' }}>
                          {oc.proveedor}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'right' }}>
                        <div><strong>Fecha:</strong> {formatDate(oc.fecha_envio)}</div>
                        <div style={{ color: '#3b82f6', marginTop: '2px', fontWeight: '600' }}>
                          {oc.ordenes_compra_articulos?.length || 0} ítems recepcionados
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="glass-card" style={{ padding: '24px', marginBottom: '25px' }}>
                {/* Header Banner de la OC */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                      OC EN REVISIÓN
                    </span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                      {ocSeleccionada.numero_oc}
                    </h3>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      • Proveedor: {ocSeleccionada.proveedor}
                    </span>
                  </div>
                  <button 
                    onClick={() => { setOcSeleccionada(null); setArticulosOc([]); setItems([]); }} 
                    className="btn-secondary" 
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    Cambiar OC
                  </button>
                </div>

                {/* Fila 1: Documento de Recepción */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: '16px', paddingBottom: '18px', borderBottom: '1px dashed var(--border-color)', marginBottom: '18px' }}>
                  <div>
                    <label style={labelStyle}>Documento</label>
                    <select name="tipo_documento" value={form.tipo_documento} onChange={handleInputChange} className="input-field" style={{ width: '100%' }}>
                      <option value="Factura">Factura</option>
                      <option value="Guía de Despacho">Guía de Despacho</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Nº de Documento</label>
                    <input 
                      name="numero_documento" 
                      value={form.numero_documento} 
                      onChange={handleInputChange} 
                      className="input-field" 
                      placeholder="Escriba el número de factura o guía..." 
                    />
                  </div>
                </div>

                {/* Fila 2: Selector Unificado de Artículo Recepcionado */}
                <div style={{ background: 'var(--btn-secondary-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
                  <label style={{ ...labelStyle, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Seleccionar Artículo Recepcionado</span>
                    <span style={{ color: '#10b981', fontSize: '0.75rem', textTransform: 'none', fontWeight: '600' }}>
                      ✓ Solo artículos con estado 'Recepcionado' ({articulosOc.length})
                    </span>
                  </label>
                  <select 
                    name="codigo" 
                    value={form.codigo} 
                    onChange={handleInputChange} 
                    className="input-field"
                    style={{ fontWeight: '700', fontSize: '0.95rem', color: form.codigo ? '#3b82f6' : 'var(--text-secondary)' }}
                  >
                    <option value="">-- Seleccione un artículo recepcionado --</option>
                    {articulosOc
                      .filter(art => !items.some(item => item.codigo === art.codigo_articulo))
                      .map(art => (
                        <option key={art.id} value={art.codigo_articulo}>
                          ({art.codigo_articulo}) {art.descripcion}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Fila 3: Trazabilidad y Cantidad (4 columnas fluidas) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Lote</label>
                    <input 
                      name="lote" 
                      value={form.lote} 
                      onChange={handleInputChange} 
                      className="input-field" 
                      placeholder="Lote..." 
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>F. Vencimiento</label>
                    <input 
                      type="date" 
                      name="vencimiento" 
                      value={form.vencimiento} 
                      onChange={handleInputChange} 
                      className="input-field" 
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Registro ISP</label>
                    <input 
                      name="isp" 
                      value={form.isp} 
                      onChange={handleInputChange} 
                      className="input-field" 
                      placeholder="Registro ISP..." 
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Cantidad a Ingresar</label>
                    <input 
                      type="number" 
                      name="cantidad" 
                      value={form.cantidad} 
                      onChange={handleInputChange} 
                      className="input-field" 
                      placeholder="0" 
                      style={{ fontWeight: '700' }}
                    />
                  </div>
                </div>

                {/* Fila 4: Precios y Carta de Canje */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end', marginBottom: '22px' }}>
                  <div>
                    <label style={labelStyle}>P. Unitario Sin IVA ($)</label>
                    <input 
                      type="number" 
                      step="any"
                      name="valor_sin_iva" 
                      value={form.valor_sin_iva} 
                      onChange={handleInputChange} 
                      className="input-field" 
                      placeholder="0" 
                      style={{ fontWeight: '700' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Condición Especial</label>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: 'var(--input-bg)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '8px', 
                      padding: '9px 14px', 
                      height: '42px', 
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>Carta de Canje</span>
                      <input 
                        type="checkbox" 
                        name="carta_canje" 
                        id="carta_canje"
                        checked={form.carta_canje} 
                        onChange={handleInputChange} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                      />
                    </label>
                  </div>
                </div>

                {/* Botón de Añadir */}
                <button 
                  onClick={handleAddItem} 
                  className="btn-primary" 
                  style={{ width: '100%', padding: '14px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '700', fontSize: '0.95rem' }}
                >
                  <Plus size={20} /> Añadir Artículo a la Revisión
                </button>
              </div>

              {/* Tabla de Lista Actual */}
              <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                      Artículos Listos para Ingreso ({items.length})
                    </h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Total unidades: {items.reduce((acc, curr) => acc + curr.cantidad, 0)} uds.
                    </span>
                  </div>
                  {items.length > 0 && (
                    <button onClick={handleFinalizar} className="btn-primary" style={{ background: '#10b981', padding: '10px 20px', fontWeight: '700' }} disabled={loading}>
                      {loading ? 'Procesando...' : <><Save size={18} /> Finalizar y Generar Informe</>}
                    </button>
                  )}
                </div>
                
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--btn-secondary-bg)' }}>
                        <th style={thStyle}>CÓDIGO Y DESCRIPCIÓN</th>
                        <th style={thStyle}>LOTE / VENC.</th>
                        <th style={thStyle}>DOC. / ISP</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>CANTIDAD</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>P. UNIT. S/IVA</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>TOTAL S/IVA</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan="7" style={{ padding: '35px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              No hay artículos añadidos a la revisión todavía.
                            </td>
                          </tr>
                        ) : (
                          items.map((item) => (
                            <motion.tr key={item.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={tdStyle}>
                                <strong>({item.codigo})</strong> {item.nombre}
                              </td>
                              <td style={tdStyle}>
                                <div><strong>{item.lote}</strong></div>
                                {item.vencimiento && <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Venc: {formatDate(item.vencimiento)}</div>}
                              </td>
                              <td style={tdStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 'bold' }}>{item.tipo_documento} {item.numero_documento}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ISP: {item.isp}</div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#10b981' }}>{item.cantidad}</td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>${(item.valor_sin_iva || 0).toLocaleString('es-CL')}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700' }}>${(item.total_sin_iva || 0).toLocaleString('es-CL')}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <button onClick={() => handleRemoveItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px', fontWeight: '600', fontSize: '0.8rem' }}>
                                  <Trash2 size={16} />
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
            </>
          )}
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
                  <th style={thStyle} className="col-lote">LOTE / VENC.</th>
                  <th style={thStyle} className="col-isp">DOCUMENTO / ISP</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} className="col-cantidad">CANTIDAD</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={tdStyle}><strong>{item?.codigo}</strong></td>
                    <td style={tdStyle}>{item?.nombre}</td>
                    <td style={tdStyle}>
                      <div>{item?.lote}</div>
                      {item?.vencimiento && <div style={{ fontSize: '8pt', color: '#f59e0b' }}>Venc: {formatDate(item?.vencimiento)}</div>}
                    </td>
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
                  <p><strong>Fecha de Emisión:</strong> {formatDate(new Date())} {new Date().toLocaleTimeString()}</p>
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
