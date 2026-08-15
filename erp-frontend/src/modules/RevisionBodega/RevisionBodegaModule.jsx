import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Plus, Trash2, Save, Printer, AlertTriangle, ArrowLeft, History, Eye, FileText, X 
} from 'lucide-react';
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
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

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
    valor_sin_iva: '',
    nota: '',
    autor_nota: localStorage.getItem('firma_operador') || ''
  });

  // OCs y selección
  const [loadingOcs, setLoadingOcs] = useState(false);
  const [ocs, setOcs] = useState([]);
  const [ocSeleccionada, setOcSeleccionada] = useState(null);
  const [articulosOc, setArticulosOc] = useState([]);
  const [articulosCatalog, setArticulosCatalog] = useState({});
  const [ocFilter, setOcFilter] = useState('pendientes'); // 'pendientes', 'revisadas', 'todas'

  const nombreArticulo = useArsenalLookup(form.codigo);

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
      valor_sin_iva: '',
      nota: '',
      autor_nota: localStorage.getItem('firma_operador') || ''
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

      // Recuperar vencimientos y precios por lote
      const { data: variantes, error: varError } = await supabase
        .from('articulos_variantes')
        .select('codigo_articulo, lote, vencimiento, ultimo_valor_sin_iva');

      const variantesMap = {};
      if (!varError && variantes) {
        variantes.forEach(v => {
          const key = `${v.codigo_articulo?.trim()}_${v.lote?.trim().toUpperCase()}`;
          variantesMap[key] = {
            vencimiento: v.vencimiento,
            valor_sin_iva: v.ultimo_valor_sin_iva || 0
          };
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
        const varData = variantesMap[keyVenc] || {};
        const vencimiento = varData.vencimiento || 'S/V';
        const valorSinIva = varData.valor_sin_iva || 0;

        grupos[item.session_id].items.push({
          id: item.id,
          codigo: item.codigo_articulo,
          nombre: nombreArt,
          lote: item.lote,
          vencimiento: vencimiento,
          isp: item.isp,
          cantidad: item.cantidad,
          tipo_documento: item.tipo_documento || '',
          numero_documento: item.numero_documento || '',
          valor_sin_iva: valorSinIva
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

    if (form.autor_nota?.trim()) {
      localStorage.setItem('firma_operador', form.autor_nota.trim());
    }

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
      total_con_iva: cantidad * valorConIva,
      nota: form.nota?.trim() || '',
      autor_nota: form.autor_nota?.trim() || (form.nota?.trim() ? 'Revisión Bodega' : '')
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
      valor_sin_iva: '',
      nota: ''
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
        comentario: item.nota ? item.nota : `Ingreso desde Revisión Bodega (${item.tipo_documento} N° ${item.numero_documento})`,
        ultimo_valor_sin_iva: item.valor_sin_iva || 0,
        ultimo_valor_con_iva: item.valor_con_iva || 0,
        total_sin_iva: item.total_sin_iva || 0,
        total_con_iva: item.total_con_iva || 0,
        isp: item.isp || 'S/I',
        fecha_ingreso: new Date().toISOString().split('T')[0]
      }));

      const { data: createdVariantes, error: insertVarError } = await supabase
        .from('articulos_variantes')
        .insert(insertVariantes)
        .select('id, codigo_articulo, lote');

      if (insertVarError) throw insertVarError;

      // 3. Si hay notas/comentarios, insertar en articulos_variantes_comentarios para bitácora de Inventario
      if (createdVariantes && createdVariantes.length > 0) {
        const comentariosToInsert = [];
        createdVariantes.forEach((createdVar, idx) => {
          const itemOrig = items[idx];
          if (itemOrig?.nota) {
            comentariosToInsert.push({
              variante_id: createdVar.id,
              comentario: itemOrig.nota,
              usuario: itemOrig.autor_nota || 'Revisión Bodega'
            });
          }
        });

        if (comentariosToInsert.length > 0) {
          const { error: comErr } = await supabase
            .from('articulos_variantes_comentarios')
            .insert(comentariosToInsert);
          if (comErr) console.error('Error al registrar comentarios en bitácora:', comErr);
        }
      }

      // 4. Actualizar estado_revision en ordenes_compra si corresponde
      if (ocSeleccionada) {
        try {
          const artsRecepcionados = (ocSeleccionada.ordenes_compra_articulos || [])
            .filter(a => a.estado_recepcion === 'Recepcionado');

          const { data: revsPrevias } = await supabase
            .from('revisiones_bodega')
            .select('codigo_articulo')
            .eq('numero_oc', ocSeleccionada.numero_oc);

          const codigosRevisados = new Set([
            ...(revsPrevias || []).map(r => r.codigo_articulo?.trim()),
            ...items.map(i => i.codigo?.trim())
          ]);

          const todosRevisados = artsRecepcionados.length > 0 && 
            artsRecepcionados.every(a => codigosRevisados.has(a.codigo_articulo?.trim()));

          const nuevoEstadoRevision = todosRevisados ? 'Revisada' : 'Revision Parcial';

          await supabase
            .from('ordenes_compra')
            .update({ estado_revision: nuevoEstadoRevision })
            .eq('id', ocSeleccionada.id);

          setOcs(prev => prev.map(o => o.id === ocSeleccionada.id ? { ...o, estado_revision: nuevoEstadoRevision } : o));
        } catch (errRev) {
          console.error('Error al actualizar estado_revision en ordenes_compra:', errRev);
        }
      }

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

      // Recuperar vencimientos y precios por lote
      const { data: variantes, error: varError } = await supabase
        .from('articulos_variantes')
        .select('codigo_articulo, lote, vencimiento, ultimo_valor_sin_iva');

      const variantesMap = {};
      if (!varError && variantes) {
        variantes.forEach(v => {
          const key = `${v.codigo_articulo?.trim()}_${v.lote?.trim().toUpperCase()}`;
          variantesMap[key] = {
            vencimiento: v.vencimiento,
            valor_sin_iva: v.ultimo_valor_sin_iva || 0
          };
        });
      }
      
      const itemsCompletos = sesion.items.map(it => {
        const nombreArt = articulosMap[it.codigo] || it.nombre;
        const keyVenc = `${it.codigo?.trim()}_${it.lote?.trim().toUpperCase()}`;
        const varData = variantesMap[keyVenc] || {};
        const vencimiento = varData.vencimiento || it.vencimiento || 'S/V';
        const valorSinIva = it.valor_sin_iva !== undefined ? it.valor_sin_iva : (varData.valor_sin_iva || 0);
        return {
          ...it,
          nombre: nombreArt,
          vencimiento: vencimiento,
          valor_sin_iva: valorSinIva
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

              {/* Filtros de OCs */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setOcFilter('pendientes')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: ocFilter === 'pendientes' ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    background: ocFilter === 'pendientes' ? 'rgba(59, 130, 246, 0.15)' : 'var(--btn-secondary-bg)',
                    color: ocFilter === 'pendientes' ? '#60a5fa' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  Pendientes de Revisión ({ocs.filter(o => o.estado_revision !== 'Revisada').length})
                </button>
                <button
                  onClick={() => setOcFilter('revisadas')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: ocFilter === 'revisadas' ? '1px solid #10b981' : '1px solid var(--border-color)',
                    background: ocFilter === 'revisadas' ? 'rgba(168, 185, 129, 0.15)' : 'var(--btn-secondary-bg)',
                    color: ocFilter === 'revisadas' ? '#34d399' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  Ya Revisadas ({ocs.filter(o => o.estado_revision === 'Revisada').length})
                </button>
                <button
                  onClick={() => setOcFilter('todas')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: ocFilter === 'todas' ? '1px solid #a855f7' : '1px solid var(--border-color)',
                    background: ocFilter === 'todas' ? 'rgba(168, 85, 247, 0.15)' : 'var(--btn-secondary-bg)',
                    color: ocFilter === 'todas' ? '#c084fc' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  Todas ({ocs.length})
                </button>
              </div>

              {loadingOcs ? (
                <p style={{ color: '#94a3b8' }}>Cargando órdenes de compra...</p>
              ) : ocs.filter(oc => {
                if (ocFilter === 'pendientes') return oc.estado_revision !== 'Revisada';
                if (ocFilter === 'revisadas') return oc.estado_revision === 'Revisada';
                return true;
              }).length === 0 ? (
                <p style={{ color: '#64748b', fontStyle: 'italic', padding: '20px 0' }}>
                  {ocFilter === 'pendientes' 
                    ? '✓ ¡Excelente! No hay órdenes de compra pendientes de revisión en este momento.' 
                    : ocFilter === 'revisadas' 
                      ? 'No hay órdenes de compra con revisión completada en esta sección.' 
                      : 'No hay órdenes de compra disponibles.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                  {ocs.filter(oc => {
                    if (ocFilter === 'pendientes') return oc.estado_revision !== 'Revisada';
                    if (ocFilter === 'revisadas') return oc.estado_revision === 'Revisada';
                    return true;
                  }).map(oc => (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', color: '#3b82f6', fontSize: '1.05rem' }}>{oc.numero_oc}</span>
                          <span style={{ 
                            background: 'rgba(59, 130, 246, 0.12)', 
                            color: '#60a5fa', 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.75rem', 
                            fontWeight: '700' 
                          }}>
                            {oc.estado}
                          </span>
                          {oc.estado_revision === 'Revisada' ? (
                            <span style={{ 
                              background: 'rgba(16, 185, 129, 0.15)', 
                              color: '#10b981', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              fontSize: '0.75rem', 
                              fontWeight: '700' 
                            }}>
                              ✓ Ya Revisada
                            </span>
                          ) : oc.estado_revision === 'Revision Parcial' ? (
                            <span style={{ 
                              background: 'rgba(245, 158, 11, 0.15)', 
                              color: '#f59e0b', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              fontSize: '0.75rem', 
                              fontWeight: '700' 
                            }}>
                              ⏳ Revisión Parcial
                            </span>
                          ) : (
                            <span style={{ 
                              background: 'rgba(100, 116, 139, 0.15)', 
                              color: '#94a3b8', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              fontSize: '0.75rem', 
                              fontWeight: '700' 
                            }}>
                              Pendiente
                            </span>
                          )}
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

                {/* Fila 4: Precios, Carta de Canje y Botón de Nota */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end', marginBottom: '22px' }}>
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
                  <div>
                    <label style={labelStyle}>Bitácora / Anotación</label>
                    <button
                      type="button"
                      onClick={() => setIsNoteModalOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        height: '42px',
                        borderRadius: '8px',
                        border: form.nota?.trim() ? '1px solid #a855f7' : '1px dashed var(--border-color)',
                        background: form.nota?.trim() ? 'rgba(168, 85, 247, 0.15)' : 'var(--input-bg)',
                        color: form.nota?.trim() ? '#c084fc' : 'var(--text-secondary)',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <FileText size={16} />
                      {form.nota?.trim() ? '✓ Nota Agregada (1)' : '+ Agregar Nota'}
                    </button>
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
                  <th style={thStyle} className="col-lote">LOTE</th>
                  <th style={thStyle} className="col-vencimiento">VENCIMIENTO</th>
                  <th style={thStyle} className="col-isp">REGISTRO ISP</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} className="col-cantidad">CANTIDAD</th>
                  <th style={thStyle} className="col-doc">GD/FAC</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} className="col-precio">PRECIO UNITARIO</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={tdStyle} className="col-codigo"><strong>{item?.codigo}</strong></td>
                    <td style={tdStyle} className="col-descripcion">{item?.nombre}</td>
                    <td style={tdStyle} className="col-lote">{item?.lote}</td>
                    <td style={tdStyle} className="col-vencimiento">{item?.vencimiento && item.vencimiento !== 'S/V' ? formatDate(item.vencimiento) : (item?.vencimiento || '-')}</td>
                    <td style={tdStyle} className="col-isp">{item?.isp}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800' }} className="col-cantidad">{item?.cantidad}</td>
                    <td style={tdStyle} className="col-doc">{item?.tipo_documento} {item?.numero_documento}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="col-precio">${(item?.valor_sin_iva || 0).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="print-only" style={{ display: 'none', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #000', fontSize: '9pt', pageBreakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <p style={{ margin: 0, fontSize: '8pt' }}><strong>Fecha de Emisión:</strong> {formatDate(new Date())} {new Date().toLocaleTimeString()}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', textAlign: 'center' }}>
                <div>
                  <br />
                  <p style={{ margin: 0 }}><strong>____________________________</strong></p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '8pt', fontWeight: '600' }}>Firma y Timbre</p>
                </div>
                <div>
                  <br />
                  <p style={{ margin: 0 }}><strong>____________________________</strong></p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '8pt', fontWeight: '600' }}>Firma y Timbre</p>
                </div>
                <div>
                  <br />
                  <p style={{ margin: 0 }}><strong>____________________________</strong></p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '8pt', fontWeight: '600' }}>Firma y Timbre</p>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            @media print {
              @page { 
                size: portrait; 
                margin: 10mm 12mm 10mm 12mm; 
              }
              html, body { 
                background: white !important; 
                color: black !important; 
                padding: 0 !important; 
                margin: 0 !important; 
                height: auto !important; 
                min-height: 0 !important; 
                box-sizing: border-box !important; 
              }
              .app-container, .main-content, .informes-container, .print-container { 
                height: auto !important; 
                min-height: 0 !important; 
                max-width: 100% !important; 
                width: 100% !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                overflow: visible !important; 
              }
              .no-print, .sidebar, .sidebar-overlay, .mobile-header { 
                display: none !important; 
              }
              .print-only { 
                display: block !important; 
              }
              table { 
                width: 100% !important; 
                border-collapse: collapse !important; 
                border: 1px solid #000 !important; 
                table-layout: fixed !important; 
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              th, td { 
                border: 1px solid #000 !important; 
                color: black !important; 
                padding: 4px 6px !important; 
                font-size: 8pt !important; 
                line-height: 1.2 !important;
                word-wrap: break-word !important; 
                overflow-wrap: break-word !important; 
              }
              th { 
                background: #f1f5f9 !important; 
                font-weight: 700 !important; 
              }
              .col-codigo { width: 8% !important; text-align: center !important; }
              .col-descripcion { width: 28% !important; }
              .col-lote { width: 12% !important; text-align: center !important; }
              .col-vencimiento { width: 11% !important; text-align: center !important; }
              .col-isp { width: 11% !important; text-align: center !important; }
              .col-cantidad { width: 8% !important; text-align: right !important; }
              .col-doc { width: 11% !important; }
              .col-precio { width: 11% !important; text-align: right !important; }
              
              .no-break { 
                page-break-inside: avoid !important; 
              }
            }
          `}</style>
        </motion.div>
      )}

      {/* MODAL AGREGAR NOTA AL LOTE */}
      <AnimatePresence>
        {isNoteModalOpen && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
            onClick={() => setIsNoteModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                width: '100%',
                maxWidth: '520px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {/* Encabezado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    Bitácora de Lote
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {nombreArticulo || (form.codigo ? `Artículo ${form.codigo}` : 'Sin artículo seleccionado')}
                  </p>
                  {form.lote && (
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#a855f7', fontWeight: '700' }}>
                      Lote: {form.lote} {form.vencimiento ? `• Vencimiento: ${formatDate(form.vencimiento)}` : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsNoteModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Formulario */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Nombre</label>
                  <input
                    type="text"
                    placeholder=""
                    value={form.autor_nota}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, autor_nota: e.target.value }));
                      localStorage.setItem('firma_operador', e.target.value);
                    }}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Comentario / Nota</label>
                  <textarea
                    placeholder=""
                    value={form.nota}
                    onChange={(e) => setForm(prev => ({ ...prev, nota: e.target.value }))}
                    rows={4}
                    className="input-field"
                    style={{ width: '100%', resize: 'none', minHeight: '90px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setIsNoteModalOpen(false)}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNoteModalOpen(false)}
                    className="btn-primary"
                    style={{ padding: '8px 20px', fontSize: '0.85rem', background: '#a855f7' }}
                  >
                    Guardar Nota
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default RevisionBodegaModule;
