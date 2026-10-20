import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, Plus, Search, Trash2, Calendar, FileText, ArrowLeft, ArrowRight,
  RefreshCw, CheckCircle, Clock, AlertTriangle, XCircle, ShoppingBag, 
  Activity, ClipboardList, X, Filter, ChevronDown, ChevronUp, Mail, Send, ExternalLink, Copy, Check,
  Edit, Edit2, Edit3, Bell, AlertCircle, BarChart3, DollarSign, PackageOpen, Layers, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { labelStyle } from '../../styles/sharedStyles';
import { formatDate, formatDateTime } from '../../utils/dateFormatter';
import { fetchArticulosCatalogMap, resolveArticuloNombre } from '../../utils/catalogHelper';
import { evaluarYActualizarEstadoSolicitud } from '../../utils/solicitudHelper';
import { TIPOS_OC, evaluarPlazos, validarOrdenFechas, formatISOToDisplay } from '../../utils/plazosHelper';

// Helper to get today's date formatted as yyyy-MM-dd
const getTodayString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Helper to get today's date formatted as dd/mm/yyyy
const getTodayDisplayString = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};



// Check if DD/MM/YYYY is valid
const isValidDateStr = (str) => {
  if (!str || str.length !== 10) return false;
  const parts = str.split('/');
  if (parts.length !== 3) return false;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  return true;
};

// Parse DD/MM/YYYY to ISO
const parseDisplayDate = (str) => {
  if (!str) return new Date().toISOString();
  const parts = str.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed month
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day, 12, 0, 0); // Noon to prevent timezone shifts
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return new Date().toISOString();
};

// Calculate Business Days excluding Saturdays (6) and Sundays (0)
export const calcularDiasHabiles = (startDateInput, endDateInput = new Date()) => {
  if (!startDateInput) return 0;
  const start = new Date(startDateInput);
  const end = new Date(endDateInput);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return 0;

  let count = 0;
  let cur = new Date(start);
  cur.setDate(cur.getDate() + 1);

  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// Custom hook local to quickly check arsenal descriptions
const useArsenalAutoSuggest = (codigo) => {
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [exists, setExists] = useState(true);

  useEffect(() => {
    const trimmedCodigo = codigo ? String(codigo).trim() : '';

    if (!trimmedCodigo) {
      setNombre('');
      setExists(true);
      return;
    }

    let isCurrent = true;

    const lookup = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('articulos')
          .select('descripcion')
          .eq('codigo', trimmedCodigo)
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (isCurrent) {
          if (data) {
            setNombre(data.descripcion);
            setExists(true);
          } else {
            setNombre('');
            setExists(false);
          }
        }
      } catch (err) {
        if (isCurrent) {
          console.error(err);
          setNombre('');
          setExists(false);
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    const handler = setTimeout(() => {
      lookup();
    }, 400);

    return () => {
      isCurrent = false;
      clearTimeout(handler);
    };
  }, [codigo]);

  return { nombre, loading, exists };
};

const SeguimientoOCModule = () => {
  const [view, setView] = useState('selection'); // 'selection' | 'list' | 'create'
  const [activeDept, setActiveDept] = useState('drogueria'); // 'drogueria' | 'resolutividad'
  const [activeSubTab, setActiveSubTab] = useState('list'); // 'list' | 'alertas' | 'recepcion'
  const [filtroEstadoList, setFiltroEstadoList] = useState('TODOS');
  const [filtroEstadoAlertas, setFiltroEstadoAlertas] = useState('TODOS');
  const [alertasSubFilter, setAlertasSubFilter] = useState('TODAS'); // 'TODAS' | 'AMARILLAS' | 'ROSA' | 'NARANJAS' | 'EXCEPCIONES' | 'ROJAS'
  const [searchQueryAlertas, setSearchQueryAlertas] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ocs, setOcs] = useState([]);
  
  // Modal State
  const [selectedOcForModal, setSelectedOcForModal] = useState(null);
  const [expandedArticleId, setExpandedArticleId] = useState(null);
  const [modalTab, setModalTab] = useState('articulos'); // 'articulos' | 'bitacora'
  const [comentarios, setComentarios] = useState([]);
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [guardandoComentario, setGuardandoComentario] = useState(false);

  // Articles catalog mapping for instant code -> name translation
  const [articulosCatalog, setArticulosCatalog] = useState({});

  // Reception sub-tab state
  const [recepcionSearchQuery, setRecepcionSearchQuery] = useState('');
  const [selectedOcIdForRecepcion, setSelectedOcIdForRecepcion] = useState('');
  const [recepcionQuantities, setRecepcionQuantities] = useState({}); // { [articleId]: incomingQty }
  const [savingRecepcion, setSavingRecepcion] = useState(false);

  // Valorizados sub-tab state (Órdenes con recepciones parciales incompletas)
  const [searchValorizados, setSearchValorizados] = useState('');
  const [filtroTipoValorizados, setFiltroTipoValorizados] = useState('TODOS');
  const [expandedValorizadoOcId, setExpandedValorizadoOcId] = useState(null);
  const [sortByValorizados, setSortByValorizados] = useState('saldo_desc');
  
  // Form state
  const [formData, setFormData] = useState({
    numero_oc: '',
    solicitud_compra: '',
    proveedor: '',
    rut_proveedor: '',
    tipo_oc: 'AG', // 'AG', 'SE', 'CM', 'L1', 'PEDIDO ESPECIAL', 'OC ESPECIAL'
    fecha_tope_aceptacion: '',
    fecha_tope_entrega: '',
    fecha_tope_multa: '',
    fecha_insistencia: '',
    estado: 'Enviada', // 'Enviada', 'Aceptada', 'Recepción Conforme', 'Recepción Con Multa', 'Cancelado', 'Excepciones'
    fecha_envio_display: getTodayDisplayString(),
    fecha_aceptacion_display: ''
  });

  // States for supplier searchable dropdown
  const [proveedores, setProveedores] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [proveedorSearch, setProveedorSearch] = useState('');
  const [showProveedorSuggestions, setShowProveedorSuggestions] = useState(false);

  // States for solicitudes searchable dropdown
  const [solicitudesOptions, setSolicitudesOptions] = useState([]);
  const [showSolicitudSuggestions, setShowSolicitudSuggestions] = useState(false);

  // Option A state: Items already assigned in other OCs for the same request
  const [articulosYaAsignados, setArticulosYaAsignados] = useState([]);

  // States for Email Modal (Outlook Web)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedOcForEmail, setSelectedOcForEmail] = useState(null);
  const [plantillasCorreo, setPlantillasCorreo] = useState([]);
  const [selectedPlantillaId, setSelectedPlantillaId] = useState('');
  const [loadingEmailData, setLoadingEmailData] = useState(false);
  const [emailPara, setEmailPara] = useState('');
  const [proveedorCantidadCorreos, setProveedorCantidadCorreos] = useState(0);
  const [emailAsunto, setEmailAsunto] = useState('');
  const [emailCuerpo, setEmailCuerpo] = useState('');
  const [proveedorTieneEmail, setProveedorTieneEmail] = useState(false);
  const [emailDescriptorArticulo, setEmailDescriptorArticulo] = useState('');
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  // States for Edit OC Modal
  const [editingOc, setEditingOc] = useState(null);
  const [editFormData, setEditFormData] = useState({
    numero_oc: '',
    solicitud_compra: '',
    proveedor: '',
    rut_proveedor: '',
    tipo_oc: 'AG',
    estado: 'Enviada',
    fecha_envio: '',
    fecha_aceptacion: '',
    fecha_tope_aceptacion: '',
    fecha_tope_entrega: '',
    fecha_tope_multa: '',
    fecha_insistencia: ''
  });
  const [editArticulos, setEditArticulos] = useState([]);
  const [deletedArticleIds, setDeletedArticleIds] = useState([]);
  const [editProveedorSearch, setEditProveedorSearch] = useState('');
  const [showEditProveedorSuggestions, setShowEditProveedorSuggestions] = useState(false);
  const [editSolicitudSearch, setEditSolicitudSearch] = useState('');
  const [showEditSolicitudSuggestions, setShowEditSolicitudSuggestions] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [nuevoArticuloCodigo, setNuevoArticuloCodigo] = useState('');
  const [nuevoArticuloCantidad, setNuevoArticuloCantidad] = useState(1);
  const [nuevoArticuloPrecio, setNuevoArticuloPrecio] = useState('');

  const handleDateDisplayChange = (e) => {
    const val = e.target.value;
    // Keep only digits and slash
    let clean = val.replace(/[^0-9]/g, '');
    if (clean.length > 8) clean = clean.substring(0, 8);
    
    let formatted = '';
    if (clean.length > 0) {
      formatted += clean.substring(0, 2);
    }
    if (clean.length > 2) {
      formatted += '/' + clean.substring(2, 4);
    }
    if (clean.length > 4) {
      formatted += '/' + clean.substring(4, 8);
    }
    
    setFormData(prev => ({ ...prev, fecha_envio_display: formatted }));
  };

  // Dynamic articles rows state
  const [articulosForm, setArticulosForm] = useState([
    { key: Date.now(), codigo: '', nombre: '', cantidad: 1, isNew: false, tempName: '' }
  ]);

  // Load articles catalog
  const cargarArticulosCatalog = async () => {
    const mapping = await fetchArticulosCatalogMap();
    setArticulosCatalog(mapping);
  };

  // Load solicitudes options for auto-filling OC items
  const cargarSolicitudesOptions = async () => {
    try {
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
        const { data: simple } = await supabase
          .from('solicitudes_compra')
          .select('*')
          .order('created_at', { ascending: false });
        setSolicitudesOptions(simple || []);
      } else {
        setSolicitudesOptions(data || []);
      }
    } catch (err) {
      console.error('Error al cargar solicitudes options:', err);
    }
  };

  // Option A: Select Solicitud, check assigned items in non-cancelled OCs, mark previously assigned ones in red
  const handleSeleccionarSolicitud = async (s) => {
    setFormData(prev => ({
      ...prev,
      solicitud_compra: s.numero_solicitud,
      tipo_oc: s.tipo_oc || prev.tipo_oc,
      fecha_tope_aceptacion: (s.fecha_tope_aceptacion || '').slice(0, 10),
      fecha_tope_entrega: (s.fecha_tope_entrega || '').slice(0, 10),
      fecha_tope_multa: (s.fecha_tope_multa || '').slice(0, 10),
      fecha_insistencia: (s.fecha_insistencia || '').slice(0, 10)
    }));
    setShowSolicitudSuggestions(false);

    try {
      // Fetch OCs already created for this solicitud (EXCLUDING CANCELLED OCs)
      const formattedSol = s.numero_solicitud.trim().toUpperCase().startsWith('S-')
        ? s.numero_solicitud.trim().toUpperCase()
        : `S-${s.numero_solicitud.trim().toUpperCase()}`;

      const { data: ocsData } = await supabase
        .from('ordenes_compra')
        .select(`
          id,
          numero_oc,
          solicitud_compra,
          estado,
          ordenes_compra_articulos (
            codigo_articulo,
            estado_recepcion
          )
        `)
        .or(`solicitud_compra.eq.${s.numero_solicitud},solicitud_compra.eq.${formattedSol}`);

      // Filter out cancelled OCs in JS
      const activeOcs = (ocsData || []).filter(oc => oc.estado !== 'Cancelado' && oc.estado !== 'Cancelada');

      // Map assigned codes -> OC number (Excluye artículos cuyo estado_recepcion sea Rechazado)
      const assignedCodesMap = {};
      activeOcs.forEach(oc => {
        (oc.ordenes_compra_articulos || []).forEach(art => {
          if (art.codigo_articulo && art.estado_recepcion !== 'Rechazado') {
            assignedCodesMap[art.codigo_articulo.trim().toUpperCase()] = oc.numero_oc;
          }
        });
      });

      const childItems = s.solicitudes_compra_articulos || [];
      const allItems = childItems.length > 0 ? childItems : (s.codigo_articulo ? [{
        codigo_articulo: s.codigo_articulo,
        descripcion_articulo: s.descripcion_articulo || articulosCatalog[s.codigo_articulo] || '',
        cantidad: s.cantidad || 1,
        sub_centro_costo: s.sub_centro_costo || null
      }] : []);

      const formRows = allItems.map(item => {
        const codeUpper = (item.codigo_articulo || '').trim().toUpperCase();
        const ocPrevia = assignedCodesMap[codeUpper] || null;
        const subTag = item.sub_centro_costo ? ` [${item.sub_centro_costo}]` : '';

        return {
          key: Date.now() + Math.random(),
          codigo: item.codigo_articulo || '',
          nombre: ((item.descripcion_articulo || articulosCatalog[item.codigo_articulo] || '') + subTag).trim(),
          cantidad: item.cantidad || 1,
          precio_unitario: item.precio_unitario || '',
          subtotal_neto: (Number(item.cantidad) || 1) * (Number(item.precio_unitario) || 0),
          isNew: false,
          tempName: '',
          yaAsignadoEnOc: ocPrevia
        };
      });

      if (formRows.length > 0) {
        setArticulosForm(formRows);
      } else {
        setArticulosForm([{ key: Date.now(), codigo: '', nombre: '', cantidad: 1, precio_unitario: '', subtotal_neto: 0, isNew: false, tempName: '', yaAsignadoEnOc: null }]);
      }

    } catch (err) {
      console.error('Error al verificar artículos asignados de la solicitud:', err);
    }
  };

  // Helper function to calculate request status: 'Sin OC asignada', 'OC asignada parcial', 'OC asignada completa'
  // excludeOcIds: array of OC IDs to treat as cancelled (handles race condition with Supabase)
  // Se utiliza la función centralizada evaluarYActualizarEstadoSolicitud importada desde ../../utils/solicitudHelper

  // Load active OCs from Supabase
  const cargarOcs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra')
        .select(`
          *,
          ordenes_compra_articulos (*)
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

  // Load comments for a specific OC
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

  // Add new comment to Supabase
  const handleAddComentario = async (e) => {
    if (e) e.preventDefault();
    if (!nuevoComentario.trim() || !selectedOcForModal) return;

    setGuardandoComentario(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra_comentarios')
        .insert([
          {
            oc_id: selectedOcForModal.id,
            comentario: nuevoComentario.trim()
          }
        ])
        .select();

      if (error) throw error;
      
      // Update local comments list
      setComentarios(prev => [...prev, ...(data || [])]);
      setNuevoComentario('');
    } catch (err) {
      console.error('Error al guardar comentario:', err);
      alert('Error al guardar comentario: ' + err.message);
    } finally {
      setGuardandoComentario(false);
    }
  };

  // Recargar datos frescos de la OC al abrir el modal y fetch comentarios
  useEffect(() => {
    if (selectedOcForModal) {
      setModalTab('articulos');
      setExpandedArticleId(null);
      fetchComentarios(selectedOcForModal.id);
      // Recargar artículos frescos desde Supabase para reflejar cambios de estado
      const refrescarArticulos = async () => {
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
                estado_recepcion,
                historial_cambios
              )
            `)
            .eq('id', selectedOcForModal.id)
            .maybeSingle();
          if (!error && data) {
            setSelectedOcForModal(data);
          }
        } catch (err) {
          console.error('Error al refrescar OC para modal:', err);
        }
      };
      refrescarArticulos();
    } else {
      setComentarios([]);
      setModalTab('articulos');
      setExpandedArticleId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOcForModal?.id]);

  const cargarProveedores = async () => {
    setLoadingProveedores(true);
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('id, rut, nombre_proveedor')
        .order('nombre_proveedor', { ascending: true });
      if (error) throw error;
      setProveedores(data || []);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    } finally {
      setLoadingProveedores(false);
    }
  };

  // Open Create View
  const handleStartCreate = () => {
    setFormData({
      numero_oc: '',
      solicitud_compra: '',
      proveedor: '',
      rut_proveedor: '',
      tipo_oc: 'AG',
      fecha_tope_aceptacion: '',
      fecha_tope_entrega: '',
      fecha_tope_multa: '',
      fecha_insistencia: '',
      estado: 'Enviada',
      fecha_envio_display: getTodayDisplayString(),
      fecha_aceptacion_display: ''
    });
    setProveedorSearch('');
    setShowProveedorSuggestions(false);
    setShowSolicitudSuggestions(false);
    setArticulosYaAsignados([]);
    setArticulosForm([{ key: Date.now(), codigo: '', nombre: '', cantidad: 1, precio_unitario: '', subtotal_neto: 0, isNew: false, tempName: '' }]);
    setView('create');
  };

  useEffect(() => {
    cargarOcs();
    cargarArticulosCatalog();
    cargarProveedores();
    cargarSolicitudesOptions();
  }, []);

  // Helper para sustituir variables dinámicas en asunto y cuerpo
  const aplicarVariablesCorreo = (texto, oc, descriptorArt = '') => {
    if (!texto) return '';
    return texto
      .replace(/{numero_oc}/gi, oc?.numero_oc || '')
      .replace(/{proveedor}/gi, oc?.proveedor || '')
      .replace(/{solicitud_compra}/gi, oc?.solicitud_compra || '')
      .replace(/{tipo_oc}/gi, oc?.tipo_oc || '')
      .replace(/{articulo}/gi, descriptorArt || '')
      .replace(/{articulos}/gi, descriptorArt || '')
      .replace(/{fecha_tope_aceptacion}/gi, formatISOToDisplay(oc?.fecha_tope_aceptacion) || '-')
      .replace(/{fecha_tope_entrega}/gi, formatISOToDisplay(oc?.fecha_tope_entrega) || '-')
      .replace(/{fecha_tope_multa}/gi, formatISOToDisplay(oc?.fecha_tope_multa) || '-');
  };

  // Helper para obtener el descriptor del artículo asociado a la OC o solicitud
  const resolverDescriptorArticuloOc = async (oc) => {
    if (!oc) return '';
    let nombres = [];

    // Asegurar catálogo de artículos cargado
    let cat = articulosCatalog;
    if (!cat || Object.keys(cat).length === 0) {
      try {
        cat = await fetchArticulosCatalogMap();
        setArticulosCatalog(cat);
      } catch (e) {
        console.warn('No se pudo recargar catálogo:', e);
      }
    }

    // 1. Artículos asociados directamente a la OC
    let artsOc = oc.ordenes_compra_articulos || [];
    if (artsOc.length === 0 && oc.id) {
      try {
        const { data: directArts } = await supabase
          .from('ordenes_compra_articulos')
          .select('codigo_articulo')
          .eq('oc_id', oc.id);
        if (directArts && directArts.length > 0) {
          artsOc = directArts;
        }
      } catch (err) {
        console.warn('Error al buscar artículos de OC por ID:', err);
      }
    }

    artsOc.forEach(a => {
      const desc = resolveArticuloNombre(cat, a.codigo_articulo, a.descripcion_articulo || '');
      if (desc && !desc.startsWith('Artículo [') && desc !== 'Sin código') {
        nombres.push(desc.trim());
      } else if (a.codigo_articulo) {
        nombres.push(`Cód. ${a.codigo_articulo}`);
      }
    });

    // 2. Si no tenía artículos o nombres en catálogo, buscar en solicitudes_compra
    if (nombres.length === 0 && oc.solicitud_compra) {
      const cleanSol = oc.solicitud_compra.trim();
      const solNum = cleanSol.startsWith('S-') ? cleanSol : `S-${cleanSol}`;
      try {
        const { data: solData } = await supabase
          .from('solicitudes_compra')
          .select(`
            descripcion_articulo,
            codigo_articulo,
            solicitudes_compra_articulos (
              descripcion_articulo,
              codigo_articulo
            )
          `)
          .or(`numero_solicitud.eq.${cleanSol},numero_solicitud.eq.${solNum}`)
          .maybeSingle();

        if (solData) {
          if (solData.solicitudes_compra_articulos && solData.solicitudes_compra_articulos.length > 0) {
            nombres = solData.solicitudes_compra_articulos
              .map(s => {
                const desc = s.descripcion_articulo || resolveArticuloNombre(cat, s.codigo_articulo, '');
                return (desc && !desc.startsWith('Artículo [')) ? desc : s.codigo_articulo;
              })
              .filter(Boolean);
          } else if (solData.descripcion_articulo) {
            nombres = [solData.descripcion_articulo.trim()];
          } else if (solData.codigo_articulo) {
            const desc = resolveArticuloNombre(cat, solData.codigo_articulo, '');
            if (desc && !desc.startsWith('Artículo [')) nombres = [desc];
          }
        }
      } catch (err) {
        console.warn('Error al buscar descriptor en solicitud:', err);
      }
    }

    if (nombres.length === 0) return '';
    if (nombres.length === 1) return nombres[0];
    if (nombres.length === 2) return `${nombres[0]}, ${nombres[1]}`;
    return `${nombres[0]} (+ ${nombres.length - 1} más)`;
  };

  // Abrir ventana modal para preparar correo a proveedor
  const handleAbrirModalCorreo = async (oc) => {
    setSelectedOcForEmail(oc);
    setIsEmailModalOpen(true);
    setLoadingEmailData(true);
    setCopiadoFeedback(false);

    try {
      // 1. Resolver descriptor de artículo(s)
      const descArt = await resolverDescriptorArticuloOc(oc);
      setEmailDescriptorArticulo(descArt);

      // 2. Buscar email(s) del proveedor en tabla 'proveedores'
      let provEmail = '';
      let cantCorreos = 0;

      const procesarCorreos = (rawCorreo) => {
        if (!rawCorreo) return '';
        const list = rawCorreo
          .split(/[,;]+/)
          .map(e => e.trim())
          .filter(Boolean);
        cantCorreos = list.length;
        return list.join(', ');
      };

      if (oc.rut_proveedor) {
        const { data: provData } = await supabase
          .from('proveedores')
          .select('correo, nombre_proveedor')
          .eq('rut', oc.rut_proveedor.trim())
          .maybeSingle();

        if (provData && provData.correo) {
          provEmail = procesarCorreos(provData.correo);
        }
      }

      if (!provEmail && oc.proveedor) {
        const { data: provByName } = await supabase
          .from('proveedores')
          .select('correo')
          .ilike('nombre_proveedor', `%${oc.proveedor.trim()}%`)
          .maybeSingle();

        if (provByName && provByName.correo) {
          provEmail = procesarCorreos(provByName.correo);
        }
      }

      setEmailPara(provEmail);
      setProveedorTieneEmail(cantCorreos > 0);
      setProveedorCantidadCorreos(cantCorreos);

      // 3. Cargar plantillas de correo desde 'plantillas_correo'
      const { data: templates } = await supabase
        .from('plantillas_correo')
        .select('*')
        .order('id', { ascending: true });

      const tList = templates || [];
      setPlantillasCorreo(tList);

      if (tList.length > 0) {
        const first = tList[0];
        setSelectedPlantillaId(String(first.id));
        setEmailAsunto(aplicarVariablesCorreo(first.asunto, oc, descArt));
        setEmailCuerpo(aplicarVariablesCorreo(first.cuerpo, oc, descArt));
      } else {
        setSelectedPlantillaId('');
        setEmailAsunto(`ORDEN DE COMPRA ${oc.numero_oc} - DROGUERÍA MUNICIPAL`);
        setEmailCuerpo(`Estimados ${oc.proveedor},\n\nJunto con saludar, nos comunicamos respecto a la Orden de Compra N° ${oc.numero_oc}.\n\nSaludos cordiales,\nDroguería`);
      }

    } catch (err) {
      console.error('Error al preparar modal de correo:', err);
    } finally {
      setLoadingEmailData(false);
    }
  };

  // Cambiar plantilla seleccionada en el modal
  const handleCambiarPlantilla = (plantillaId) => {
    setSelectedPlantillaId(plantillaId);
    const plantilla = plantillasCorreo.find(p => String(p.id) === String(plantillaId));
    if (plantilla && selectedOcForEmail) {
      setEmailAsunto(aplicarVariablesCorreo(plantilla.asunto, selectedOcForEmail, emailDescriptorArticulo));
      setEmailCuerpo(aplicarVariablesCorreo(plantilla.cuerpo, selectedOcForEmail, emailDescriptorArticulo));
    }
  };

  // Abrir deeplink oficial de Outlook Web en nueva pestaña
  const handleAbrirOutlookWeb = () => {
    if (!emailPara.trim()) {
      if (!window.confirm('No has ingresado correo de destinatario en la casilla "Para". ¿Deseas abrir Outlook Web de todas formas?')) {
        return;
      }
    }

    // Normalizar múltiples correos separados por comas sin espacios para el parámetro 'to'
    const destinatarios = emailPara
      .split(/[,;]+/)
      .map(e => e.trim())
      .filter(Boolean)
      .join(',');

    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(destinatarios)}&subject=${encodeURIComponent(emailAsunto)}&body=${encodeURIComponent(emailCuerpo)}`;
    window.open(outlookUrl, '_blank');
  };

  // Copiar asunto y cuerpo al portapapeles
  const handleCopiarContenido = () => {
    const fullText = `PARA: ${emailPara}\nASUNTO: ${emailAsunto}\n\n${emailCuerpo}`;
    navigator.clipboard.writeText(fullText);
    setCopiadoFeedback(true);
    setTimeout(() => setCopiadoFeedback(false), 2500);
  };

  // Update status directly from table
  const handleUpdateEstado = async (ocId, nuevoEstado) => {
    try {
      const ocObj = ocs.find(o => String(o.id) === String(ocId));
      const targetSol = ocObj?.solicitud_compra;

      if (nuevoEstado === 'Cancelado' || nuevoEstado === 'Cancelada') {
        const confirmCancel = window.confirm(
          `⚠️ ¿Está seguro de cambiar el estado de la Orden de Compra "${ocObj?.numero_oc || ''}" a CANCELADO?\n\nEsta acción liberará los artículos asociados para que puedan ser asignados a otra OC.`
        );
        if (!confirmCancel) {
          cargarOcs(); // Restaura el valor previo en el selector
          return;
        }
      }

      const updates = { estado: nuevoEstado };
      if (nuevoEstado === 'Aceptada' && !ocObj?.fecha_aceptacion) {
        updates.fecha_aceptacion = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('ordenes_compra')
        .update(updates)
        .eq('id', ocId);

      if (error) throw error;

      // Re-evaluate and update linked Solicitud status immediately (frees up articles if Cancelado)
      if (targetSol) {
        const isCancelling = (nuevoEstado === 'Cancelado' || nuevoEstado === 'Cancelada');
        await evaluarYActualizarEstadoSolicitud(targetSol, isCancelling ? [ocId] : []);
      }

      alert('Estado de la OC actualizado correctamente.');
      
      // Sync local modal state if currently open
      if (selectedOcForModal && selectedOcForModal.id === ocId) {
        setSelectedOcForModal(prev => ({
          ...prev,
          estado: nuevoEstado,
          fecha_aceptacion: nuevoEstado === 'Aceptada' ? (prev.fecha_aceptacion || new Date().toISOString()) : prev.fecha_aceptacion
        }));
      }

      cargarOcs();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert('Error al actualizar: ' + err.message);
    }
  };

  // Delete OC function
  const handleDeleteOC = async (id, numeroOc) => {
    if (window.confirm(`¿Está seguro de eliminar la Orden de Compra "${numeroOc}"? Se eliminarán también todos sus artículos asociados de forma permanente.`)) {
      setLoading(true);
      try {
        const ocToDelete = ocs.find(o => String(o.id) === String(id));
        const targetSol = ocToDelete?.solicitud_compra;

        // 1. Delete associated articles
        const { error: errItems } = await supabase
          .from('ordenes_compra_articulos')
          .delete()
          .eq('oc_id', id);

        if (errItems) throw errItems;

        // 2. Delete parent OC
        const { error: errOc } = await supabase
          .from('ordenes_compra')
          .delete()
          .eq('id', id);

        if (errOc) throw errOc;

        // 3. Re-evaluate and update status of the associated Solicitud
        if (targetSol) {
          await evaluarYActualizarEstadoSolicitud(targetSol);
        }

        alert('Orden de Compra eliminada correctamente.');
        await cargarOcs();
        await cargarSolicitudesOptions();
      } catch (err) {
        console.error('Error al eliminar OC:', err);
        alert('Error al eliminar: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Open Edit OC Modal
  const handleAbrirModalEditar = (oc) => {
    setEditingOc(oc);

    const toDateInputString = (val) => {
      if (!val) return '';
      if (typeof val === 'string' && val.length >= 10 && val.includes('-')) {
        return val.slice(0, 10);
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    setEditFormData({
      numero_oc: oc.numero_oc || '',
      solicitud_compra: oc.solicitud_compra || '',
      proveedor: oc.proveedor || '',
      rut_proveedor: oc.rut_proveedor || '',
      tipo_oc: oc.tipo_oc || 'AG',
      estado: oc.estado || 'Enviada',
      fecha_envio: toDateInputString(oc.fecha_envio),
      fecha_aceptacion: toDateInputString(oc.fecha_aceptacion),
      fecha_tope_aceptacion: toDateInputString(oc.fecha_tope_aceptacion),
      fecha_tope_entrega: toDateInputString(oc.fecha_tope_entrega),
      fecha_tope_multa: toDateInputString(oc.fecha_tope_multa),
      fecha_insistencia: toDateInputString(oc.fecha_insistencia)
    });

    setEditProveedorSearch(oc.proveedor || '');
    setShowEditProveedorSuggestions(false);
    setEditSolicitudSearch(oc.solicitud_compra || '');
    setShowEditSolicitudSuggestions(false);

    // Map existing articles
    const arts = (oc.ordenes_compra_articulos || []).map(a => ({
      id: a.id,
      codigo_articulo: a.codigo_articulo,
      descripcion: articulosCatalog[a.codigo_articulo] || a.codigo_articulo,
      cantidad: a.cantidad || 1,
      precio_unitario: a.precio_unitario !== undefined && a.precio_unitario !== null ? a.precio_unitario : '',
      subtotal_neto: a.subtotal_neto || ((a.cantidad || 1) * (a.precio_unitario || 0)),
      cantidad_recepcionada: a.cantidad_recepcionada || 0,
      estado_recepcion: a.estado_recepcion || 'Pendiente'
    }));
    setEditArticulos(arts);
    setDeletedArticleIds([]);
    setNuevoArticuloCodigo('');
    setNuevoArticuloCantidad(1);
    setNuevoArticuloPrecio('');
  };

  const handleEditArticuloCantidad = (index, newQty) => {
    const val = parseInt(newQty, 10);
    setEditArticulos(prev => prev.map((art, idx) => {
      if (idx !== index) return art;
      const minQty = art.cantidad_recepcionada || 1;
      const c = isNaN(val) ? '' : Math.max(minQty, val);
      return { 
        ...art, 
        cantidad: c,
        subtotal_neto: (Number(c) || 0) * (Number(art.precio_unitario) || 0)
      };
    }));
  };

  const handleEditArticuloPrecio = (index, newPrice) => {
    const val = parseFloat(newPrice);
    setEditArticulos(prev => prev.map((art, idx) => {
      if (idx !== index) return art;
      const precio = isNaN(val) ? 0 : Math.max(0, val);
      return { 
        ...art, 
        precio_unitario: newPrice === '' ? '' : precio,
        subtotal_neto: (Number(art.cantidad) || 0) * precio
      };
    }));
  };

  const handleEliminarArticuloEdit = (index) => {
    const art = editArticulos[index];
    if (art.cantidad_recepcionada > 0) {
      alert(`No se puede eliminar el artículo "${art.codigo_articulo}" porque ya tiene ${art.cantidad_recepcionada} unidad(es) recepcionada(s).`);
      return;
    }
    if (art.id) {
      setDeletedArticleIds(prev => [...prev, art.id]);
    }
    setEditArticulos(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAgregarArticuloEdit = () => {
    const codigoLimpio = nuevoArticuloCodigo.trim();
    if (!codigoLimpio) {
      alert('Debe ingresar el código del artículo.');
      return;
    }
    const yaExiste = editArticulos.some(a => (a.codigo_articulo || '').toLowerCase() === codigoLimpio.toLowerCase());
    if (yaExiste) {
      alert(`El artículo "${codigoLimpio}" ya está en la lista de esta Orden de Compra.`);
      return;
    }

    const desc = articulosCatalog[codigoLimpio] || `Artículo ${codigoLimpio}`;
    const pUnit = parseFloat(nuevoArticuloPrecio) || 0;
    const cCant = parseInt(nuevoArticuloCantidad, 10) || 1;
    setEditArticulos(prev => [
      ...prev,
      {
        id: null,
        codigo_articulo: codigoLimpio,
        descripcion: desc,
        cantidad: cCant,
        precio_unitario: pUnit,
        subtotal_neto: cCant * pUnit,
        cantidad_recepcionada: 0,
        estado_recepcion: 'Pendiente'
      }
    ]);
    setNuevoArticuloCodigo('');
    setNuevoArticuloCantidad(1);
    setNuevoArticuloPrecio('');
  };

  const handleGuardarEdicion = async () => {
    if (!editingOc) return;
    const nuevoNumeroOc = editFormData.numero_oc.trim();
    if (!nuevoNumeroOc) {
      alert('El Número de OC / AG es obligatorio.');
      return;
    }

    if (editArticulos.length === 0) {
      alert('La Orden de Compra debe tener al menos un artículo.');
      return;
    }

    // Validar orden de fechas tope
    const isSE = editFormData.tipo_oc === 'SE';
    const fechasTope = {
      fecha_tope_aceptacion: editFormData.fecha_tope_aceptacion || null,
      fecha_tope_entrega: editFormData.fecha_tope_entrega || null,
      fecha_tope_multa: editFormData.fecha_tope_multa || null,
      fecha_insistencia: isSE ? (editFormData.fecha_insistencia || null) : null
    };
    const errorFechas = validarOrdenFechas(fechasTope);
    if (errorFechas) {
      alert(errorFechas);
      return;
    }

    // Check if new numero_oc clashes with another OC
    const { data: ocExistente, error: checkErr } = await supabase
      .from('ordenes_compra')
      .select('id')
      .eq('numero_oc', nuevoNumeroOc)
      .neq('id', editingOc.id)
      .maybeSingle();

    if (checkErr) {
      console.warn('Error checking unique OC:', checkErr);
    }
    if (ocExistente) {
      alert(`Ya existe otra Orden de Compra con el número "${nuevoNumeroOc}". Ingrese un número distinto.`);
      return;
    }

    // Confirm cancel if state changed to Cancelado
    const nuevoEstado = editFormData.estado;
    if ((nuevoEstado === 'Cancelado' || nuevoEstado === 'Cancelada') && editingOc.estado !== 'Cancelado' && editingOc.estado !== 'Cancelada') {
      const confirmCancel = window.confirm(
        `⚠️ ¿Está seguro de cambiar el estado de la Orden de Compra "${editingOc.numero_oc}" a CANCELADO?\n\nEsta acción liberará los artículos asociados para que puedan ser asignados a otra OC.`
      );
      if (!confirmCancel) return;
    }

    setSavingEdit(true);
    try {
      // 1. Format dates
      const parseInputDateToISO = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          const dt = new Date(y, m, d, 12, 0, 0);
          return isNaN(dt.getTime()) ? null : dt.toISOString();
        }
        return null;
      };

      let fechaEnvioISO = parseInputDateToISO(editFormData.fecha_envio) || editingOc.fecha_envio;
      let fechaAceptacionISO = parseInputDateToISO(editFormData.fecha_aceptacion);
      if (!fechaAceptacionISO && nuevoEstado === 'Aceptada') {
        fechaAceptacionISO = editingOc.fecha_aceptacion || new Date().toISOString();
      }

      const formattedSol = editFormData.solicitud_compra && editFormData.solicitud_compra.trim() ? (
        editFormData.solicitud_compra.trim().toUpperCase().startsWith('S-')
          ? editFormData.solicitud_compra.trim().toUpperCase()
          : `S-${editFormData.solicitud_compra.trim().toUpperCase()}`
      ) : null;

      // Calculate financial totals
      let totalNeto = 0;
      let totalRecepcionadoValor = 0;
      for (const art of editArticulos) {
        const qty = parseInt(art.cantidad, 10) || 1;
        const pUnit = parseFloat(art.precio_unitario) || 0;
        const sub = qty * pUnit;
        totalNeto += sub;
        totalRecepcionadoValor += (parseInt(art.cantidad_recepcionada, 10) || 0) * pUnit;
      }
      const totalConIva = Math.round(totalNeto * 1.19);
      const saldoOc = Math.max(0, totalNeto - totalRecepcionadoValor);

      // 2. Update ordenes_compra
      const updates = {
        numero_oc: nuevoNumeroOc,
        solicitud_compra: formattedSol,
        proveedor: editFormData.proveedor.trim(),
        rut_proveedor: editFormData.rut_proveedor.trim(),
        tipo_oc: editFormData.tipo_oc,
        estado: nuevoEstado,
        fecha_envio: fechaEnvioISO,
        fecha_aceptacion: fechaAceptacionISO,
        total_neto: totalNeto,
        total_con_iva: totalConIva,
        saldo_oc: saldoOc,
        ...fechasTope
      };

      try {
        const { error: updateErr } = await supabase
          .from('ordenes_compra')
          .update(updates)
          .eq('id', editingOc.id);

        if (updateErr) throw updateErr;
      } catch (err) {
        if (err.code === '42703' || err.code === 'PGRST204' || (err.message && err.message.includes('schema cache'))) {
          const { total_neto, total_con_iva, saldo_oc, ...legacyUpdates } = updates;
          const { error: legacyErr } = await supabase
            .from('ordenes_compra')
            .update(legacyUpdates)
            .eq('id', editingOc.id);
          if (legacyErr) throw legacyErr;
          alert('⚠️ Atención: La OC fue actualizada pero las columnas financieras aún no existen en Supabase. Recuerde ejecutar el script SQL provisto en el SQL Editor.');
        } else {
          throw err;
        }
      }

      // 3. Update revisiones_bodega if numero_oc changed
      const oldNum = editingOc.numero_oc ? editingOc.numero_oc.trim() : '';
      if (oldNum && nuevoNumeroOc && oldNum !== nuevoNumeroOc) {
        await supabase
          .from('revisiones_bodega')
          .update({ numero_oc: nuevoNumeroOc })
          .eq('numero_oc', oldNum);
      }

      // 4. Delete removed articles
      if (deletedArticleIds.length > 0) {
        const { error: delErr } = await supabase
          .from('ordenes_compra_articulos')
          .delete()
          .in('id', deletedArticleIds);
        if (delErr) throw delErr;
      }

      // 5. Update and insert articles
      for (const art of editArticulos) {
        const qty = parseInt(art.cantidad, 10) || 1;
        const pUnit = parseFloat(art.precio_unitario) || 0;
        const sub = qty * pUnit;
        if (art.id) {
          const { error: artUpdErr } = await supabase
            .from('ordenes_compra_articulos')
            .update({ cantidad: qty, precio_unitario: pUnit, subtotal_neto: sub })
            .eq('id', art.id);
          if (artUpdErr && (artUpdErr.code === '42703' || artUpdErr.code === 'PGRST204' || (artUpdErr.message && artUpdErr.message.includes('schema cache')))) {
            await supabase
              .from('ordenes_compra_articulos')
              .update({ cantidad: qty })
              .eq('id', art.id);
          }
        } else if (art.codigo_articulo && art.codigo_articulo.trim()) {
          const { error: artInsErr } = await supabase
            .from('ordenes_compra_articulos')
            .insert([{
              oc_id: editingOc.id,
              codigo_articulo: art.codigo_articulo.trim(),
              cantidad: qty,
              cantidad_recepcionada: 0,
              precio_unitario: pUnit,
              subtotal_neto: sub,
              estado_recepcion: 'Pendiente'
            }]);
          if (artInsErr && (artInsErr.code === '42703' || artInsErr.code === 'PGRST204' || (artInsErr.message && artInsErr.message.includes('schema cache')))) {
            await supabase
              .from('ordenes_compra_articulos')
              .insert([{
                oc_id: editingOc.id,
                codigo_articulo: art.codigo_articulo.trim(),
                cantidad: qty,
                cantidad_recepcionada: 0,
                estado_recepcion: 'Pendiente'
              }]);
          }
        }
      }

      // 6. Re-evaluate solicitudes if solicitud_compra changed or estado changed
      const oldSol = editingOc.solicitud_compra ? editingOc.solicitud_compra.trim() : null;
      if (oldSol && oldSol !== formattedSol) {
        await evaluarYActualizarEstadoSolicitud(oldSol);
      }
      if (formattedSol) {
        const isCancelling = (nuevoEstado === 'Cancelado' || nuevoEstado === 'Cancelada');
        await evaluarYActualizarEstadoSolicitud(formattedSol, isCancelling ? [editingOc.id] : []);
      }

      alert('Orden de Compra / AG actualizada correctamente.');
      setEditingOc(null);
      await cargarOcs();
      await cargarSolicitudesOptions();

      // If details modal was open with this OC, refresh it
      if (selectedOcForModal && selectedOcForModal.id === editingOc.id) {
        const { data: refreshedOc } = await supabase
          .from('ordenes_compra')
          .select(`
            *,
            ordenes_compra_articulos (*)
          `)
          .eq('id', editingOc.id)
          .maybeSingle();
        if (refreshedOc) setSelectedOcForModal(refreshedOc);
      }

    } catch (err) {
      console.error('Error al actualizar OC:', err);
      alert('Error al guardar cambios: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Add a new row to article sub-form
  const handleAddRow = () => {
    setArticulosForm(prev => [
      ...prev,
      { key: Date.now() + Math.random(), codigo: '', nombre: '', cantidad: 1, precio_unitario: '', subtotal_neto: 0, isNew: false, tempName: '' }
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
        const updated = { ...row, [field]: value };
        if (field === 'cantidad' || field === 'precio_unitario') {
          const qty = Number(field === 'cantidad' ? value : row.cantidad) || 0;
          const price = Number(field === 'precio_unitario' ? value : row.precio_unitario) || 0;
          updated.subtotal_neto = qty * price;
        }
        return updated;
      }
      return row;
    }));
  };

  // Save the OC and create new items if necessary
  const handleSaveOC = async () => {
    if (!formData.numero_oc.trim() || !formData.proveedor.trim() || !formData.fecha_envio_display) {
      alert('Por favor complete el Número de OC, Proveedor y Fecha de Envío.');
      return;
    }

    if (!isValidDateStr(formData.fecha_envio_display)) {
      alert('Por favor ingrese una fecha válida en formato Día/Mes/Año (DD/MM/YYYY). Ejemplo: 19/05/2026');
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
                descripcion: art.tempName.trim()
              }]);
            if (insertArtErr) throw insertArtErr;
          }
        }
      }

      // 2. Insert parent OC (with manual date selection support)
      const formattedSol = formData.solicitud_compra.trim() ? (
        formData.solicitud_compra.trim().toUpperCase().startsWith('S-') 
          ? formData.solicitud_compra.trim().toUpperCase() 
          : `S-${formData.solicitud_compra.trim().toUpperCase()}`
      ) : null;

      const isSE = formData.tipo_oc === 'SE';
      const fechasTope = {
        fecha_tope_aceptacion: formData.fecha_tope_aceptacion || null,
        fecha_tope_entrega: formData.fecha_tope_entrega || null,
        fecha_tope_multa: formData.fecha_tope_multa || null,
        fecha_insistencia: isSE ? (formData.fecha_insistencia || null) : null
      };
      const errorFechas = validarOrdenFechas(fechasTope);
      if (errorFechas) {
        alert(errorFechas);
        return;
      }

      // Calculate financial totals
      let totalNeto = 0;
      const childItems = validArticles.map(art => {
        const cant = parseInt(art.cantidad, 10) || 1;
        const precioUnit = parseFloat(art.precio_unitario) || 0;
        const subtotal = cant * precioUnit;
        totalNeto += subtotal;
        return {
          codigo_articulo: art.codigo.trim(),
          cantidad: cant,
          cantidad_recepcionada: 0,
          precio_unitario: precioUnit,
          subtotal_neto: subtotal
        };
      });

      const totalConIva = Math.round(totalNeto * 1.19);
      const saldoOc = totalNeto;

      const baseOcInsert = {
        numero_oc: formData.numero_oc.trim(),
        solicitud_compra: formattedSol,
        proveedor: formData.proveedor.trim(),
        rut_proveedor: formData.rut_proveedor.trim(),
        tipo_oc: formData.tipo_oc,
        estado: formData.estado,
        fecha_envio: parseDisplayDate(formData.fecha_envio_display),
        fecha_aceptacion: formData.fecha_aceptacion_display ? parseDisplayDate(formData.fecha_aceptacion_display) : (formData.estado === 'Aceptada' ? new Date().toISOString() : null),
        total_neto: totalNeto,
        total_con_iva: totalConIva,
        saldo_oc: saldoOc,
        ...fechasTope
      };

      let newOCId;
      const { data: insertedOC, error: insertOcErr } = await supabase
        .from('ordenes_compra')
        .insert([baseOcInsert])
        .select();

      if (insertOcErr) {
        if (insertOcErr.code === '42703' || insertOcErr.code === 'PGRST204' || (insertOcErr.message && insertOcErr.message.includes('schema cache'))) {
          const { total_neto, total_con_iva, saldo_oc, ...legacyInsert } = baseOcInsert;
          const { data: legacyData, error: legacyErr } = await supabase
            .from('ordenes_compra')
            .insert([legacyInsert])
            .select();
          if (legacyErr) throw legacyErr;
          newOCId = legacyData[0].id;
          const legacyItems = childItems.map(({ precio_unitario, subtotal_neto, ...rest }) => ({ ...rest, oc_id: newOCId }));
          const { error: legItemsErr } = await supabase.from('ordenes_compra_articulos').insert(legacyItems);
          if (legItemsErr) throw legItemsErr;
          alert('⚠️ Atención: La OC fue creada pero las columnas financieras aún no existen en Supabase. Recuerde ejecutar el script SQL provisto en el SQL Editor.');
        } else {
          throw insertOcErr;
        }
      } else {
        newOCId = insertedOC[0].id;
        const itemsToInsert = childItems.map(c => ({ ...c, oc_id: newOCId }));
        let { error: insertItemsErr } = await supabase
          .from('ordenes_compra_articulos')
          .insert(itemsToInsert);

        if (insertItemsErr && (insertItemsErr.code === '42703' || insertItemsErr.code === 'PGRST204' || (insertItemsErr.message && insertItemsErr.message.includes('schema cache')))) {
          const legacyItems = itemsToInsert.map(({ precio_unitario, subtotal_neto, ...rest }) => rest);
          const { error: legErr } = await supabase.from('ordenes_compra_articulos').insert(legacyItems);
          if (legErr) throw legErr;
        } else if (insertItemsErr) {
          throw insertItemsErr;
        }
      }

      // Update matched solicitud_compra status automatically
      if (formattedSol) {
        await evaluarYActualizarEstadoSolicitud(formattedSol);
      }

      alert('Orden de Compra creada exitosamente y catálogo base actualizado.');
      
      // Reset form
      setFormData({
        numero_oc: '',
        solicitud_compra: '',
        proveedor: '',
        rut_proveedor: '',
        tipo_oc: 'AG',
        fecha_tope_aceptacion: '',
        fecha_tope_entrega: '',
        fecha_tope_multa: '',
        fecha_insistencia: '',
        estado: 'Enviada',
        fecha_envio_display: getTodayDisplayString(),
        fecha_aceptacion_display: ''
      });
      setProveedorSearch('');
      setShowProveedorSuggestions(false);
      setArticulosForm([{ key: Date.now(), codigo: '', nombre: '', cantidad: 1, precio_unitario: '', subtotal_neto: 0, isNew: false, tempName: '' }]);
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

  // Helper to calculate state dates, business days and visual alerts
  const checkPlazos = (oc) => {
    if (oc.estado === 'Cancelado' || oc.estado === 'Cancelada') {
      return { statusType: 'cancelado', badgeBg: 'rgba(239, 68, 68, 0.2)', badgeColor: '#ef4444', isExpired: true, isYellow: false, isOrange: false, isRosa: false, isPurpura: false, alertMessage: 'Orden Cancelada (Artículos liberados)' };
    }
    if (oc.estado === 'Recepción Conforme') {
      return { statusType: 'conforme', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeColor: '#10b981', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false, alertMessage: 'Recepción Conforme en Bodega' };
    }
    if (oc.estado === 'Recepción Con Multa') {
      return { statusType: 'multa', badgeBg: 'rgba(249, 115, 22, 0.2)', badgeColor: '#f97316', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false, alertMessage: 'Recepción Con Multa (entregado después de la fecha tope de entrega)' };
    }
    if (oc.estado === 'Recepción de excepción') {
      return { statusType: 'recepcion_excepcion', badgeBg: 'rgba(192, 128, 192, 0.2)', badgeColor: '#c080c0', isExpired: false, isYellow: false, isOrange: false, isRosa: false, isPurpura: false, alertMessage: 'Recepción de Excepción en Bodega (entregado bajo régimen de excepción)' };
    }
    if (oc.estado === 'Excepciones') {
      return {
        statusType: 'excepciones',
        nivel: 'purpura',
        badgeBg: 'rgba(192, 128, 192, 0.15)',
        badgeColor: '#c080c0',
        isExpired: false,
        isYellow: false,
        isOrange: false,
        isRosa: false,
        isPurpura: true,
        alertMessage: '🟣 Régimen de Excepción: Aceptada para recepción fuera de plazo'
      };
    }

    // Semáforo por fechas tope (incluye rosa para AG, naranja para multas, etc.)
    const ev = evaluarPlazos(oc);
    return {
      nivel: ev.nivel,
      isExpired: ev.isExpired,
      isYellow: ev.isYellow,
      isOrange: ev.isOrange,
      isRosa: ev.isRosa,
      isPurpura: ev.isPurpura,
      alertMessage: ev.glosa,
      badgeBg: ev.bg,
      badgeColor: ev.color
    };
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
          ordenes_compra_articulos (*)
        `)
        .eq('id', selectedOcIdForRecepcion);

      if (refreshErr) throw refreshErr;
      
      const updatedOc = refreshedOcs?.[0];
      if (updatedOc) {
        // Calculate and update new saldo_oc
        const arts = updatedOc.ordenes_compra_articulos || [];
        const totalNeto = arts.reduce((acc, a) => acc + (Number(a.subtotal_neto) || ((Number(a.cantidad) || 0) * (Number(a.precio_unitario) || 0))), 0);
        const totalRecepcionadoValor = arts.reduce((acc, a) => acc + ((Number(a.cantidad_recepcionada) || 0) * (Number(a.precio_unitario) || 0)), 0);
        const nuevoSaldo = Math.max(0, totalNeto - totalRecepcionadoValor);

        try {
          await supabase
            .from('ordenes_compra')
            .update({ saldo_oc: nuevoSaldo })
            .eq('id', selectedOcIdForRecepcion);
        } catch (saldoErr) {
          console.warn('No se pudo actualizar saldo_oc en Supabase:', saldoErr);
        }

        const totalRequested = arts.reduce((acc, a) => acc + (a.cantidad || 0), 0);
        const totalReceivedNow = arts.reduce((acc, a) => acc + (a.cantidad_recepcionada || 0), 0);

        const isFullyReceived = totalReceivedNow >= totalRequested;

        // El estado de la OC SIEMPRE se cambia manualmente por el usuario.
        if (isFullyReceived) {
          if (updatedOc.estado === 'Excepciones') {
            alert('Todas las cantidades fueron recepcionadas. Como esta orden estaba autorizada bajo régimen de excepción, recuerde cambiar su estado a "Recepción de excepción".');
          } else {
            alert('Todas las cantidades fueron recepcionadas. Recuerde cambiar manualmente el estado de la OC a "Recepción Conforme", "Recepción Con Multa" o "Recepción de excepción".');
          }
        } else {
          alert('Recepción parcial registrada correctamente. Saldo de la OC actualizado.');
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

  // Filtered OCs for Tracking Table (Seguimiento y Registro)
  const filteredOcs = ocs.filter(oc => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      oc.numero_oc.toLowerCase().includes(q) ||
      oc.proveedor.toLowerCase().includes(q) ||
      (oc.solicitud_compra || '').toLowerCase().includes(q)
    );

    let matchesStatus = true;
    if (filtroEstadoList !== 'TODOS') {
      if (filtroEstadoList === 'Cancelado') {
        matchesStatus = oc.estado === 'Cancelado' || oc.estado === 'Cancelada';
      } else {
        matchesStatus = oc.estado === filtroEstadoList;
      }
    }

    return matchesSearch && matchesStatus;
  });

  // Filtered OCs for Alertas Tab
  const filteredAlertasOcs = ocs.filter(oc => {
    const plazos = checkPlazos(oc);

    let matchesSubTab = false;
    if (alertasSubFilter === 'TODAS') {
      matchesSubTab = plazos.isYellow || plazos.isOrange || plazos.isRosa || plazos.isPurpura || (plazos.isExpired && oc.estado !== 'Cancelado' && oc.estado !== 'Cancelada' && oc.estado !== 'Recepción Conforme' && oc.estado !== 'Recepción Con Multa' && oc.estado !== 'Recepción de excepción');
    } else if (alertasSubFilter === 'AMARILLAS') {
      matchesSubTab = plazos.isYellow;
    } else if (alertasSubFilter === 'ROSA') {
      matchesSubTab = plazos.isRosa;
    } else if (alertasSubFilter === 'NARANJAS') {
      matchesSubTab = plazos.isOrange;
    } else if (alertasSubFilter === 'EXCEPCIONES' || alertasSubFilter === 'PURPURAS') {
      matchesSubTab = plazos.isPurpura || oc.estado === 'Excepciones';
    } else if (alertasSubFilter === 'ROJAS') {
      matchesSubTab = plazos.isExpired && oc.estado !== 'Cancelado' && oc.estado !== 'Cancelada' && oc.estado !== 'Recepción Conforme' && oc.estado !== 'Recepción Con Multa' && oc.estado !== 'Recepción de excepción';
    }

    if (!matchesSubTab) return false;

    const q = searchQueryAlertas.toLowerCase().trim();
    const matchesSearch = !q || (
      oc.numero_oc.toLowerCase().includes(q) ||
      oc.proveedor.toLowerCase().includes(q) ||
      (oc.solicitud_compra || '').toLowerCase().includes(q)
    );

    let matchesStatus = true;
    if (filtroEstadoAlertas !== 'TODOS') {
      if (filtroEstadoAlertas === 'Cancelado') {
        matchesStatus = oc.estado === 'Cancelado' || oc.estado === 'Cancelada';
      } else {
        matchesStatus = oc.estado === filtroEstadoAlertas;
      }
    }

    return matchesSearch && matchesStatus;
  });

  const yellowOcsCount = ocs.filter(oc => checkPlazos(oc).isYellow).length;
  const orangeOcsCount = ocs.filter(oc => checkPlazos(oc).isOrange).length;
  const rosaOcsCount = ocs.filter(oc => checkPlazos(oc).isRosa).length;
  const purpuraOcsCount = ocs.filter(oc => checkPlazos(oc).isPurpura || oc.estado === 'Excepciones').length;
  const redOcsCount = ocs.filter(oc => {
    const p = checkPlazos(oc);
    return p.isExpired && oc.estado !== 'Cancelado' && oc.estado !== 'Cancelada' && oc.estado !== 'Recepción Conforme' && oc.estado !== 'Recepción Con Multa' && oc.estado !== 'Recepción de excepción';
  }).length;
  const totalAlertasCount = yellowOcsCount + orangeOcsCount + rosaOcsCount + purpuraOcsCount + redOcsCount;

  // Helper function to render table for OCs
  const renderOcTable = (ocList, emptyText = "No se encontraron Órdenes de Compra registradas.") => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
          Cargando Órdenes de Compra...
        </div>
      );
    }

    if (ocList.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
          <ShoppingBag size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
          {emptyText}
        </div>
      );
    }

    return (
      <div className="table-container">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>N° OC</th>
              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>PROVEEDOR / RUT</th>
              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>FECHAS CLAVE</th>
              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>ESTADO OC</th>
              <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', width: '150px', textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {ocList.map(oc => {
              const plazos = checkPlazos(oc);
              const rowStyle = (plazos.isPurpura || oc.estado === 'Excepciones') ? {
                background: 'rgba(192, 128, 192, 0.08)',
                borderLeft: '4px solid #c080c0',
                transition: 'all 0.3s ease'
              } : plazos.isRosa ? {
                background: 'rgba(244, 194, 194, 0.08)',
                borderLeft: '4px solid #f4c2c2',
                transition: 'all 0.3s ease'
              } : plazos.isExpired ? {
                background: 'rgba(239, 68, 68, 0.04)',
                borderLeft: '4px solid #ef4444',
                transition: 'all 0.3s ease'
              } : plazos.isYellow ? {
                background: 'rgba(234, 179, 8, 0.04)',
                borderLeft: '4px solid #eab308',
                transition: 'all 0.3s ease'
              } : plazos.isOrange ? {
                background: 'rgba(251, 146, 60, 0.05)',
                borderLeft: `4px solid ${plazos.badgeColor}`,
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
                  <td style={{ padding: '16px' }}>
                    <button 
                      onClick={() => setSelectedOcForModal(oc)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#3b82f6',
                        fontWeight: '700',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                        textAlign: 'left',
                        transition: 'color 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.color = '#60a5fa'}
                      onMouseOut={(e) => e.target.style.color = '#3b82f6'}
                    >
                      {oc.numero_oc}
                    </button>
                    {oc.solicitud_compra && (
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                        Solicitud: <strong style={{ color: '#3b82f6' }}>{oc.solicitud_compra}</strong>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: '600', color: '#f8fafc' }}>{oc.proveedor}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>RUT: {oc.rut_proveedor || 'No registrado'}</div>
                  </td>
                  <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                    <div>Envío: {formatDate(oc.fecha_envio)}</div>
                    {oc.fecha_aceptacion && (
                      <div style={{ color: '#10b981', marginTop: '2px' }}>
                        Acept.: {formatDate(oc.fecha_aceptacion)}
                      </div>
                    )}
                    {(oc.fecha_tope_aceptacion || oc.fecha_tope_entrega || oc.fecha_tope_multa) && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', lineHeight: 1.5 }}>
                        Tope acept.: {formatISOToDisplay(oc.fecha_tope_aceptacion)} · Entrega: {formatISOToDisplay(oc.fecha_tope_entrega)} · Multa: {formatISOToDisplay(oc.fecha_tope_multa)}
                        {oc.tipo_oc === 'SE' && oc.fecha_insistencia && (
                          <span style={{ color: '#f4c2c2', marginLeft: '6px', fontWeight: '600' }}>
                            · Insistencia: {formatISOToDisplay(oc.fecha_insistencia)}
                          </span>
                        )}
                      </div>
                    )}
                    {(plazos.isYellow || plazos.isExpired || plazos.isOrange || plazos.isRosa || plazos.isPurpura || oc.estado === 'Excepciones' || plazos.nivel === 'sin_fecha') && (
                      <div style={{ 
                        color: plazos.badgeColor, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        marginTop: '4px', 
                        fontWeight: '600',
                        fontSize: '0.78rem' 
                      }}>
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
                        fontWeight: '700',
                        width: 'auto',
                        cursor: 'pointer',
                        background: plazos.badgeBg,
                        color: plazos.badgeColor,
                        border: `1px solid ${(plazos.isYellow || plazos.isExpired || plazos.isOrange || plazos.isRosa || plazos.isPurpura || oc.estado === 'Excepciones' || oc.estado === 'Recepción de excepción') ? plazos.badgeColor : 'rgba(255,255,255,0.15)'}`
                      }}
                    >
                      <option value="Enviada" style={{ background: '#0f172a', color: '#f8fafc' }}>Enviada</option>
                      <option value="Aceptada" style={{ background: '#0f172a', color: '#f8fafc' }}>Aceptada</option>
                      <option value="Recepción Conforme" style={{ background: '#0f172a', color: '#f8fafc' }}>Recepción Conforme</option>
                      <option value="Recepción Con Multa" style={{ background: '#0f172a', color: '#f8fafc' }}>Recepción Con Multa</option>
                      <option value="Excepciones" style={{ background: '#0f172a', color: '#f8fafc' }}>Excepciones</option>
                      <option value="Recepción de excepción" style={{ background: '#0f172a', color: '#c080c0' }}>Recepción de excepción</option>
                      <option value="Cancelado" style={{ background: '#0f172a', color: '#f8fafc' }}>Cancelado</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <button 
                        onClick={() => handleAbrirModalEditar(oc)}
                        style={{ 
                          color: '#f59e0b', 
                          background: 'rgba(245, 158, 11, 0.12)', 
                          border: '1px solid rgba(245, 158, 11, 0.3)', 
                          cursor: 'pointer', 
                          padding: '6px 10px', 
                          borderRadius: '6px',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.78rem',
                          fontWeight: '700'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.22)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'}
                        title="Editar AG y datos de la Orden de Compra"
                      >
                        <Edit size={14} /> Editar
                      </button>
                      <button 
                        onClick={() => handleAbrirModalCorreo(oc)}
                        style={{ 
                          color: '#38bdf8', 
                          background: 'rgba(56, 189, 248, 0.12)', 
                          border: '1px solid rgba(56, 189, 248, 0.3)', 
                          cursor: 'pointer', 
                          padding: '6px 10px', 
                          borderRadius: '6px',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.78rem',
                          fontWeight: '700'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.22)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)'}
                        title="Enviar correo a proveedor vía Outlook Web"
                      >
                        <Mail size={14} /> Correo
                      </button>
                      <button 
                        onClick={() => handleDeleteOC(oc.id, oc.numero_oc)}
                        style={{ 
                          color: '#ef4444', 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer', 
                          padding: '6px', 
                          borderRadius: '6px',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        title="Eliminar Orden de Compra"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Filtered Active OCs for Recepcion Search Input (Only 'Enviada' or 'Aceptada')
  const filteredActiveOcsForRecepcion = ocs.filter(oc => {
    const esValidaParaRecepcion = oc.estado === 'Enviada' || oc.estado === 'Aceptada';
    if (!esValidaParaRecepcion) return false;

    const q = recepcionSearchQuery.toLowerCase().trim();
    if (!q) return true; // Show all active OCs if query is empty

    const matchesOc = oc.numero_oc.toLowerCase().includes(q);
    const matchesProv = oc.proveedor.toLowerCase().includes(q);
    const matchesArt = (oc.ordenes_compra_articulos || []).some(art => {
      const artCode = (art.codigo_articulo || '').toLowerCase();
      const artName = (articulosCatalog[art.codigo_articulo] || '').toLowerCase();
      return artCode.includes(q) || artName.includes(q);
    });

    return matchesOc || matchesProv || matchesArt;
  });

  // =========================================================================
  // SUB-TAB 4: CÁLCULOS Y FILTROS DE ÓRDENES VALORIZADAS (RECEPCIÓN PARCIAL)
  // Regla usuario: "la información de momento de cuántas unidades se recibieron sea 
  // la ingresada en el módulo gestión de OC pestaña recepción de productos"
  // (es decir, campo ordenes_compra_articulos.cantidad_recepcionada)
  // =========================================================================
  const ocsValorizados = useMemo(() => {
    return ocs
      .filter(oc => {
        if (oc.estado === 'Cancelado' || oc.estado === 'Cancelada') return false;
        const arts = oc.ordenes_compra_articulos || [];
        if (arts.length === 0) return false;
        const totalSol = arts.reduce((sum, a) => sum + (Number(a.cantidad) || 0), 0);
        const totalRec = arts.reduce((sum, a) => sum + (Number(a.cantidad_recepcionada) || 0), 0);
        // Tienen recepciones registradas pero no están completas
        return totalRec > 0 && totalRec < totalSol;
      })
      .map(oc => {
        const arts = oc.ordenes_compra_articulos || [];
        const totalSol = arts.reduce((sum, a) => sum + (Number(a.cantidad) || 0), 0);
        const totalRec = arts.reduce((sum, a) => sum + (Number(a.cantidad_recepcionada) || 0), 0);
        const totalNeto = arts.reduce((sum, a) => sum + ((Number(a.cantidad) || 0) * (Number(a.precio_unitario) || 0)), 0);
        const recepcionadoNeto = arts.reduce((sum, a) => sum + ((Number(a.cantidad_recepcionada) || 0) * (Number(a.precio_unitario) || 0)), 0);
        const saldoFaltanteNeto = Math.max(0, totalNeto - recepcionadoNeto);
        const saldoFaltanteIva = Math.round(saldoFaltanteNeto * 1.19);
        const totalConIva = Math.round(totalNeto * 1.19);
        const porcentajeAvance = totalSol > 0 ? Math.round((totalRec / totalSol) * 100) : 0;
        const porcentajeFinanciero = totalNeto > 0 ? Math.round((recepcionadoNeto / totalNeto) * 100) : porcentajeAvance;

        const articulosIncompletos = arts.filter(a => (Number(a.cantidad_recepcionada) || 0) < (Number(a.cantidad) || 0));

        return {
          ...oc,
          totalSol,
          totalRec,
          totalNeto,
          totalConIva,
          recepcionadoNeto,
          saldoFaltanteNeto,
          saldoFaltanteIva,
          porcentajeAvance,
          porcentajeFinanciero,
          articulosIncompletos,
          totalArtsIncompletos: articulosIncompletos.length
        };
      });
  }, [ocs]);

  const valorizadosStats = useMemo(() => {
    const totalOcs = ocsValorizados.length;
    const totalComprometidoNeto = ocsValorizados.reduce((acc, o) => acc + o.totalNeto, 0);
    const totalComprometidoIva = Math.round(totalComprometidoNeto * 1.19);
    const totalRecepcionadoNeto = ocsValorizados.reduce((acc, o) => acc + o.recepcionadoNeto, 0);
    const totalSaldoFaltanteNeto = ocsValorizados.reduce((acc, o) => acc + o.saldoFaltanteNeto, 0);
    const totalSaldoFaltanteIva = ocsValorizados.reduce((acc, o) => acc + o.saldoFaltanteIva, 0);

    const codigosIncompletosSet = new Set();
    let totalUnidadesFaltantes = 0;
    ocsValorizados.forEach(oc => {
      oc.articulosIncompletos.forEach(a => {
        if (a.codigo_articulo) codigosIncompletosSet.add(a.codigo_articulo.trim());
        totalUnidadesFaltantes += Math.max(0, (Number(a.cantidad) || 0) - (Number(a.cantidad_recepcionada) || 0));
      });
    });

    const porcentajeGlobalFinanciero = totalComprometidoNeto > 0
      ? Math.round((totalRecepcionadoNeto / totalComprometidoNeto) * 100)
      : 0;

    return {
      totalOcs,
      totalComprometidoNeto,
      totalComprometidoIva,
      totalRecepcionadoNeto,
      totalSaldoFaltanteNeto,
      totalSaldoFaltanteIva,
      totalArticulosUnicosIncompletos: codigosIncompletosSet.size,
      totalUnidadesFaltantes,
      porcentajeGlobalFinanciero
    };
  }, [ocsValorizados]);

  const filteredValorizadosOcs = useMemo(() => {
    const q = (searchValorizados || '').toLowerCase().trim();
    let result = ocsValorizados.filter(oc => {
      if (filtroTipoValorizados !== 'TODOS' && oc.tipo_oc !== filtroTipoValorizados) return false;
      if (!q) return true;
      const numMatch = (oc.numero_oc || '').toLowerCase().includes(q);
      const provMatch = (oc.proveedor || '').toLowerCase().includes(q);
      const rutMatch = (oc.rut_proveedor || '').toLowerCase().includes(q);
      const solMatch = (oc.solicitud_compra || '').toLowerCase().includes(q);
      const artMatch = (oc.ordenes_compra_articulos || []).some(a => 
        (a.codigo_articulo || '').toLowerCase().includes(q) ||
        (articulosCatalog[a.codigo_articulo] || '').toLowerCase().includes(q)
      );
      return numMatch || provMatch || rutMatch || solMatch || artMatch;
    });

    if (sortByValorizados === 'saldo_desc') {
      result.sort((a, b) => b.saldoFaltanteNeto - a.saldoFaltanteNeto);
    } else if (sortByValorizados === 'saldo_asc') {
      result.sort((a, b) => a.saldoFaltanteNeto - b.saldoFaltanteNeto);
    } else if (sortByValorizados === 'avance_asc') {
      result.sort((a, b) => a.porcentajeAvance - b.porcentajeAvance);
    } else if (sortByValorizados === 'numero_oc') {
      result.sort((a, b) => (a.numero_oc || '').localeCompare(b.numero_oc || ''));
    }

    return result;
  }, [ocsValorizados, searchValorizados, filtroTipoValorizados, sortByValorizados, articulosCatalog]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px' }}>
      <AnimatePresence mode="wait">
        {view === 'selection' && (
          /* ==========================================
             VISTA PRINCIPAL: SELECCIÓN DE MÓDULOS OC
             ========================================== */
          <motion.div
            key="selection-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            style={{ 
              maxWidth: '1000px', 
              margin: '30px auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}
          >
            {/* Header del Módulo OC */}
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#f8fafc', margin: 0 }}>
                Gestión y Seguimiento de Órdenes de Compra
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '8px' }}>
                Selecciona la sección o herramienta que deseas gestionar.
              </p>
            </div>

            {/* Grid de Secciones / Botones */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px'
            }}>
              {/* Botón 1: Asignación y seguimiento de oc */}
              <motion.div 
                whileHover={{ 
                  scale: 1.02, 
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  borderColor: 'rgba(59, 130, 246, 0.4)',
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView('list')}
                className="glass-card"
                style={{ 
                  padding: '36px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '20px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '16px',
                  background: 'rgba(59, 130, 246, 0.03)'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%' }}>
                  <Truck size={48} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px', color: '#f8fafc' }}>
                    Asignación y seguimiento de oc
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
                    Registro, asignación a solicitudes, monitoreo de plazos, alertas y recepción de productos.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: '600', fontSize: '0.95rem' }}>
                  Abrir Seguimiento <ArrowRight size={18} />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {view === 'list' && (
          <motion.div
            key="list-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-card"
            style={{ padding: '30px' }}
          >
            {/* Botón Volver al Menú Principal OC */}
            <button 
              onClick={() => setView('selection')} 
              className="btn-secondary" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '20px', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                fontSize: '0.88rem',
                fontWeight: '600'
              }}
            >
              <ArrowLeft size={16} /> Volver al Menú OC
            </button>

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
                  alignContent: 'center',
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
                  alignContent: 'center',
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
                  width: 'fit-content',
                  flexWrap: 'wrap'
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
                    onClick={() => setActiveSubTab('alertas')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: activeSubTab === 'alertas' ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
                      color: activeSubTab === 'alertas' ? '#eab308' : '#94a3b8',
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
                    <AlertTriangle size={14} color={activeSubTab === 'alertas' ? '#eab308' : '#94a3b8'} /> Alertas
                    {totalAlertasCount > 0 && (
                      <span style={{
                        background: '#eab308',
                        color: '#0f172a',
                        borderRadius: '10px',
                        padding: '1px 7px',
                        fontSize: '0.75rem',
                        fontWeight: '800'
                      }}>
                        {totalAlertasCount}
                      </span>
                    )}
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

                  <button
                    onClick={() => setActiveSubTab('valorizados')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: activeSubTab === 'valorizados' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                      color: activeSubTab === 'valorizados' ? '#38bdf8' : '#94a3b8',
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
                    <BarChart3 size={14} /> Valorizados
                    {ocsValorizados.length > 0 && (
                      <span style={{
                        background: '#38bdf8',
                        color: '#0f172a',
                        borderRadius: '10px',
                        padding: '1px 7px',
                        fontSize: '0.75rem',
                        fontWeight: '800'
                      }}>
                        {ocsValorizados.length}
                      </span>
                    )}
                  </button>
                </div>

                {activeSubTab === 'list' && (
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
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                      gap: '12px', 
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
                      <div style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: '500' }}>ALERTAS AMARILLAS</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0', color: '#eab308' }}>
                          {yellowOcsCount}
                        </h3>
                      </div>
                      <div style={{ background: 'rgba(244, 194, 194, 0.06)', border: '1px solid rgba(244, 194, 194, 0.3)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#f4c2c2', fontWeight: '500' }}>INSISTENCIA SE (ROSA)</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0', color: '#f4c2c2' }}>
                          {rosaOcsCount}
                        </h3>
                      </div>
                      <div style={{ background: 'rgba(251, 146, 60, 0.05)', border: '1px solid rgba(251, 146, 60, 0.25)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#fb923c', fontWeight: '500' }}>ATRASADAS CON MULTA</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0', color: '#fb923c' }}>
                          {orangeOcsCount}
                        </h3>
                      </div>
                      <div style={{ background: 'rgba(192, 128, 192, 0.06)', border: '1px solid rgba(192, 128, 192, 0.3)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#c080c0', fontWeight: '500' }}>EXCEPCIONES (PÚRPURA)</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0', color: '#c080c0' }}>
                          {purpuraOcsCount}
                        </h3>
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '15px 20px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: '500' }}>PLAZO VENCIDO (ROJA)</span>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', margin: '4px 0 0 0', color: '#ef4444' }}>
                          {redOcsCount}
                        </h3>
                      </div>
                    </div>

                    {/* Search and Filter Bar */}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '25px', width: '100%', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                        <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Buscar por número de OC, proveedor o solicitud..."
                          className="input-field"
                          style={{ paddingLeft: '48px', width: '100%' }}
                        />
                      </div>

                      {/* Dropdown status filter for Seguimiento y Registro */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={16} color="#94a3b8" />
                        <select
                          value={filtroEstadoList}
                          onChange={(e) => setFiltroEstadoList(e.target.value)}
                          className="input-field"
                          style={{
                            height: '46px',
                            fontSize: '0.88rem',
                            fontWeight: '600',
                            minWidth: '180px',
                            background: 'rgba(15, 23, 42, 0.6)',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#f8fafc',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="TODOS" style={{ background: '#0f172a', color: '#f8fafc' }}>Todos los Estados</option>
                          <option value="Enviada" style={{ background: '#0f172a', color: '#f8fafc' }}>Enviada</option>
                          <option value="Aceptada" style={{ background: '#0f172a', color: '#f8fafc' }}>Aceptada</option>
                          <option value="Recepción Conforme" style={{ background: '#0f172a', color: '#f8fafc' }}>Recepción Conforme</option>
                          <option value="Recepción Con Multa" style={{ background: '#0f172a', color: '#f8fafc' }}>Recepción Con Multa</option>
                          <option value="Excepciones" style={{ background: '#0f172a', color: '#f8fafc' }}>Excepciones</option>
                          <option value="Recepción de excepción" style={{ background: '#0f172a', color: '#c080c0' }}>Recepción de excepción</option>
                          <option value="Cancelado" style={{ background: '#0f172a', color: '#f8fafc' }}>Cancelado</option>
                        </select>
                      </div>
                      
                      <button 
                        onClick={handleStartCreate} 
                        className="btn-primary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', height: '46px', flexShrink: 0 }}
                      >
                        <Plus size={20} /> Asignar OC
                      </button>
                    </div>

                    {/* Table */}
                    {renderOcTable(filteredOcs, "No se encontraron Órdenes de Compra registradas.")}
                  </motion.div>
                )}

                {activeSubTab === 'alertas' && (
                  /* SUB-TAB 2: ALERTAS */
                  <motion.div
                    key="subtab-alertas"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Alertas Sub-Tabs Selector */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '20px',
                      flexWrap: 'wrap',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '8px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)'
                    }}>
                      {[
                        { id: 'TODAS', label: 'Todas las Alertas', count: totalAlertasCount, color: '#f8fafc', bg: 'rgba(255,255,255,0.08)' },
                        { id: 'AMARILLAS', label: '🟡 Amarillas', count: yellowOcsCount, color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)' },
                        { id: 'ROSA', label: '🌸 Rosa (Insistencia SE)', count: rosaOcsCount, color: '#f4c2c2', bg: 'rgba(244, 194, 194, 0.12)' },
                        { id: 'NARANJAS', label: '🟠 Naranjas (Multas)', count: orangeOcsCount, color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)' },
                        { id: 'EXCEPCIONES', label: '🟣 Excepciones', count: purpuraOcsCount, color: '#c080c0', bg: 'rgba(192, 128, 192, 0.12)' },
                        { id: 'ROJAS', label: '🔴 Rojas (Vencidas)', count: redOcsCount, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' }
                      ].map(sub => {
                        const isSelected = alertasSubFilter === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => setAlertasSubFilter(sub.id)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              background: isSelected ? sub.bg : 'transparent',
                              border: isSelected ? `1px solid ${sub.color}` : '1px solid transparent',
                              color: isSelected ? sub.color : '#94a3b8',
                              fontWeight: isSelected ? '700' : '500',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <span>{sub.label}</span>
                            <span style={{
                              background: isSelected ? sub.color : 'rgba(255,255,255,0.08)',
                              color: isSelected ? '#0f172a' : '#cbd5e1',
                              borderRadius: '10px',
                              padding: '1px 7px',
                              fontSize: '0.72rem',
                              fontWeight: '800'
                            }}>
                              {sub.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Alertas Header Banner Dinámico */}
                    {(() => {
                      const bannerConfig = {
                        TODAS: {
                          bg: 'rgba(59, 130, 246, 0.08)',
                          border: 'rgba(59, 130, 246, 0.25)',
                          color: '#60a5fa',
                          title: `Panel Consolidado de Alertas (${totalAlertasCount})`,
                          desc: 'Visualización global de todas las órdenes con alerta amarilla, insistencia SE, multa, excepciones y vencimiento.',
                          icon: <Bell size={24} color="#60a5fa" style={{ flexShrink: 0 }} />
                        },
                        AMARILLAS: {
                          bg: 'rgba(234, 179, 8, 0.08)',
                          border: 'rgba(234, 179, 8, 0.25)',
                          color: '#fef08a',
                          title: `Órdenes en Alerta Amarilla (${yellowOcsCount})`,
                          desc: 'A 1 día hábil o menos de vencer el plazo de aceptación o el plazo de entrega sin multa.',
                          icon: <AlertTriangle size={24} color="#eab308" style={{ flexShrink: 0 }} />
                        },
                        ROSA: {
                          bg: 'rgba(244, 194, 194, 0.08)',
                          border: 'rgba(244, 194, 194, 0.3)',
                          color: '#f4c2c2',
                          title: `Órdenes SE para Insistencia de Despacho (${rosaOcsCount})`,
                          desc: 'Órdenes de tipo SE en o tras la fecha de insistencia. Debe requerirse por correo el despacho parcializado.',
                          icon: <Mail size={24} color="#f4c2c2" style={{ flexShrink: 0 }} />
                        },
                        NARANJAS: {
                          bg: 'rgba(251, 146, 60, 0.08)',
                          border: 'rgba(251, 146, 60, 0.3)',
                          color: '#fdba74',
                          title: `Órdenes en Período de Multa (${orangeOcsCount})`,
                          desc: 'Órdenes atrasadas que superaron la fecha de entrega pero aún están dentro del plazo máximo con multa.',
                          icon: <AlertTriangle size={24} color="#fb923c" style={{ flexShrink: 0 }} />
                        },
                        EXCEPCIONES: {
                          bg: 'rgba(192, 128, 192, 0.08)',
                          border: 'rgba(192, 128, 192, 0.3)',
                          color: '#e9d5ff',
                          title: `Órdenes en Régimen de Excepción (${purpuraOcsCount})`,
                          desc: 'Órdenes que superaron el plazo máximo de multa y fueron autorizadas formalmente para recepción fuera de plazo.',
                          icon: <CheckCircle size={24} color="#c080c0" style={{ flexShrink: 0 }} />
                        },
                        ROJAS: {
                          bg: 'rgba(239, 68, 68, 0.08)',
                          border: 'rgba(239, 68, 68, 0.3)',
                          color: '#fca5a5',
                          title: `Órdenes con Plazo Vencido (${redOcsCount})`,
                          desc: 'Órdenes que han sobrepasado la fecha tope máxima de multa sin recepción conforme ni autorización de excepción.',
                          icon: <XCircle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
                        }
                      };
                      const curr = bannerConfig[alertasSubFilter] || bannerConfig.TODAS;
                      return (
                        <div style={{
                          background: curr.bg,
                          border: `1px solid ${curr.border}`,
                          borderRadius: '12px',
                          padding: '16px 20px',
                          marginBottom: '25px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px'
                        }}>
                          {curr.icon}
                          <div>
                            <h4 style={{ margin: 0, color: curr.color, fontSize: '1rem', fontWeight: '700' }}>
                              {curr.title}
                            </h4>
                            <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', fontSize: '0.85rem' }}>
                              {curr.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Controls: Search + Status Filter */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '15px', 
                      marginBottom: '20px', 
                      alignItems: 'center', 
                      flexWrap: 'wrap' 
                    }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                        <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
                        <input 
                          type="text"
                          value={searchQueryAlertas}
                          onChange={e => setSearchQueryAlertas(e.target.value)}
                          placeholder="Buscar por número de OC, proveedor o solicitud..."
                          className="input-field"
                          style={{ paddingLeft: '48px', width: '100%' }}
                        />
                      </div>

                      {/* Dropdown status filter for Alertas */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={16} color="#94a3b8" />
                        <select
                          value={filtroEstadoAlertas}
                          onChange={(e) => setFiltroEstadoAlertas(e.target.value)}
                          className="input-field"
                          style={{
                            height: '46px',
                            fontSize: '0.88rem',
                            fontWeight: '600',
                            minWidth: '180px',
                            background: 'rgba(15, 23, 42, 0.6)',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#f8fafc',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="TODOS" style={{ background: '#0f172a', color: '#f8fafc' }}>Todos los Estados</option>
                          <option value="Enviada" style={{ background: '#0f172a', color: '#f8fafc' }}>Enviada</option>
                          <option value="Aceptada" style={{ background: '#0f172a', color: '#f8fafc' }}>Aceptada</option>
                          <option value="Excepciones" style={{ background: '#0f172a', color: '#f8fafc' }}>Excepciones</option>
                        </select>
                      </div>
                    </div>

                    {/* Table */}
                    {renderOcTable(
                      filteredAlertasOcs, 
                      alertasSubFilter === 'TODAS'
                        ? "No hay alertas activas en ninguna categoría actualmente."
                        : alertasSubFilter === 'AMARILLAS'
                        ? "No hay Órdenes de Compra en alerta amarilla actualmente."
                        : alertasSubFilter === 'ROSA'
                        ? "No hay Órdenes SE pendientes de insistencia de despacho."
                        : alertasSubFilter === 'NARANJAS'
                        ? "No hay Órdenes de Compra en período de multa actualmente."
                        : alertasSubFilter === 'EXCEPCIONES'
                        ? "No hay Órdenes de Compra bajo régimen de excepciones."
                        : "No hay Órdenes de Compra con plazo vencido actualmente."
                    )}
                  </motion.div>
                )}

                {activeSubTab === 'recepcion' && (
                  /* SUB-TAB 3: RECEPCIÓN Y ENTREGAS PARCIALES */
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
                        Busque la Orden de Compra por su número, por el nombre/RUT de su proveedor o por el código/descripción de cualquiera de sus artículos.
                      </p>

                      {/* Search Bar */}
                      <div style={{ marginBottom: '25px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.85rem', color: '#f8fafc' }}>Buscar Orden de Compra Activa</label>
                        <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
                          <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={18} />
                          <input
                            type="text"
                            value={recepcionSearchQuery}
                            onChange={(e) => setRecepcionSearchQuery(e.target.value)}
                            placeholder="Buscar por N° de OC, proveedor, RUT, código o nombre de artículo..."
                            className="input-field"
                            style={{ paddingLeft: '44px', width: '100%' }}
                          />
                        </div>

                        {/* Search Results */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                          gap: '12px', 
                          marginTop: '15px', 
                          maxHeight: '220px', 
                          overflowY: 'auto', 
                          padding: '6px',
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.03)',
                          borderRadius: '10px'
                        }}>
                          {filteredActiveOcsForRecepcion.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', color: '#64748b', fontSize: '0.85rem', padding: '20px', textAlign: 'center' }}>
                              No se encontraron Órdenes de Compra activas coincidentes.
                            </div>
                          ) : (
                            filteredActiveOcsForRecepcion.map(oc => {
                              const isSelected = selectedOcIdForRecepcion === oc.id;
                              return (
                                <button
                                  key={oc.id}
                                  onClick={() => {
                                    setSelectedOcIdForRecepcion(oc.id);
                                    setRecepcionQuantities({});
                                  }}
                                  style={{
                                    background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                    border: isSelected ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    color: '#f8fafc',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                  }}
                                >
                                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: isSelected ? '#10b981' : '#3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <span>{oc.numero_oc}</span>
                                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>{oc.estado}</span>
                                  </div>
                                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '500' }}>{oc.proveedor}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Artículos: {oc.ordenes_compra_articulos?.length || 0}</div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Detail Panel of Selected OC */}
                      {(() => {
                        const selOc = ocs.find(o => o.id === selectedOcIdForRecepcion);
                        if (!selOc) {
                          return (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px dashed var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.005)' }}>
                              <Truck size={36} style={{ marginBottom: '10px', opacity: 0.3 }} />
                              Seleccione una Orden de Compra de los resultados de búsqueda para desplegar los artículos y registrar ingresos.
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
                                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Estado de OC</span>
                                <span style={{ 
                                  padding: '2px 8px', 
                                  borderRadius: '6px', 
                                  fontSize: '0.8rem', 
                                  fontWeight: '700',
                                  background: selOc.estado === 'Enviada' ? 'rgba(59, 130, 246, 0.15)' : 
                                              selOc.estado === 'Aceptada' ? 'rgba(16, 185, 129, 0.15)' : 
                                              selOc.estado === 'Recepcionado' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.15)',
                                  color: selOc.estado === 'Enviada' ? '#3b82f6' : 
                                         selOc.estado === 'Aceptada' ? '#10b981' : 
                                         selOc.estado === 'Recepcionado' ? '#10b981' : '#f59e0b',
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
                                    <th style={{ padding: '12px', color: '#94a3b8' }}>ARTÍCULO</th>
                                    <th style={{ padding: '12px', color: '#94a3b8', width: '150px' }}>SOLICITADO</th>
                                    <th style={{ padding: '12px', color: '#94a3b8', width: '220px' }}>RECIBIDO ACUMULADO</th>
                                    <th style={{ padding: '12px', color: '#94a3b8', width: '160px' }}>NUEVA RECEPCIÓN</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(selOc.ordenes_compra_articulos || []).map(art => {
                                    const nombreArt = articulosCatalog[art.codigo_articulo] || `Cód ${art.codigo_articulo}`;
                                    const cantSolicitada = art.cantidad || 1;
                                    const cantRecibida = art.cantidad_recepcionada || 0;
                                    const isComplete = cantRecibida >= cantSolicitada;

                                    return (
                                      <tr key={art.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                                        <td style={{ padding: '12px' }}>
                                          <div style={{ fontWeight: '600', color: '#f8fafc' }}>{nombreArt}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Código: {art.codigo_articulo}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: '600', color: '#cbd5e1' }}>
                                          {cantSolicitada} uds.
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <span style={{ 
                                            fontWeight: '700', 
                                            color: isComplete ? '#10b981' : '#f59e0b',
                                            background: isComplete ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            border: isComplete ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(245,158,11,0.15)',
                                            display: 'inline-block'
                                          }}>
                                            {cantRecibida} / {cantSolicitada}
                                          </span>
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
                                            disabled={isComplete}
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

                {activeSubTab === 'valorizados' && (
                  /* SUB-TAB 4: VALORIZADOS (ÓRDENES CON RECEPCIONES PARCIALES) */
                  <motion.div
                    key="subtab-valorizados"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Header Banner */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: '14px',
                      padding: '24px 28px',
                      marginBottom: '26px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <div style={{
                              padding: '8px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              borderRadius: '10px',
                              color: '#38bdf8'
                            }}>
                              <BarChart3 size={22} />
                            </div>
                            <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: '#f8fafc' }}>
                              Órdenes de Compra Valorizadas
                            </h3>
                            <span style={{
                              background: 'rgba(56, 189, 248, 0.18)',
                              color: '#38bdf8',
                              padding: '2px 10px',
                              borderRadius: '20px',
                              fontSize: '0.78rem',
                              fontWeight: '700',
                              border: '1px solid rgba(56, 189, 248, 0.3)'
                            }}>
                              {valorizadosStats.totalOcs} con entregas parciales
                            </span>
                          </div>
                          <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, maxWidth: '750px', lineHeight: 1.5 }}>
                            Control financiero consolidado de órdenes que registran entregas físicas en bodega pero aún no completan el 100% de sus artículos solicitados.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* TOP 4 KPI CARDS */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '16px',
                      marginBottom: '24px'
                    }}>
                      {/* Card 1: Órdenes y Artículos Incompletos */}
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Órdenes Incompletas
                          </span>
                          <div style={{ padding: '6px', background: 'rgba(56, 189, 248, 0.12)', borderRadius: '8px', color: '#38bdf8' }}>
                            <Layers size={18} />
                          </div>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#38bdf8', marginBottom: '6px' }}>
                          {valorizadosStats.totalOcs} <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#94a3b8' }}>OC</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          <strong style={{ color: '#f8fafc' }}>{valorizadosStats.totalArticulosUnicosIncompletos}</strong> tipos de artículos pendientes ({valorizadosStats.totalUnidadesFaltantes.toLocaleString('es-CL')} un.)
                        </div>
                      </div>

                      {/* Card 2: Monto Recepcionado (Neto) */}
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Recepcionado Neto
                          </span>
                          <div style={{ padding: '6px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: '8px', color: '#10b981' }}>
                            <CheckCircle size={18} />
                          </div>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10b981', marginBottom: '6px' }}>
                          ${valorizadosStats.totalRecepcionadoNeto.toLocaleString('es-CL')}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          <strong style={{ color: '#10b981' }}>{valorizadosStats.porcentajeGlobalFinanciero}%</strong> del total comprometido ya ingresado
                        </div>
                      </div>

                      {/* Card 3: Saldo Faltante por Recibir (Neto) */}
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Saldo Faltante Neto
                          </span>
                          <div style={{ padding: '6px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '8px', color: '#f59e0b' }}>
                            <Clock size={18} />
                          </div>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#f59e0b', marginBottom: '6px' }}>
                          ${valorizadosStats.totalSaldoFaltanteNeto.toLocaleString('es-CL')}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          Comprometido total: <strong style={{ color: '#f8fafc' }}>${valorizadosStats.totalComprometidoNeto.toLocaleString('es-CL')}</strong>
                        </div>
                      </div>

                      {/* Card 4: Saldo Faltante con IVA (19%) */}
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(192, 128, 192, 0.3)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Saldo Faltante c/IVA
                          </span>
                          <div style={{ padding: '6px', background: 'rgba(192, 128, 192, 0.15)', borderRadius: '8px', color: '#c080c0' }}>
                            <DollarSign size={18} />
                          </div>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#c080c0', marginBottom: '6px' }}>
                          ${valorizadosStats.totalSaldoFaltanteIva.toLocaleString('es-CL')}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          IVA (19%) pendiente: <strong style={{ color: '#c080c0' }}>${(valorizadosStats.totalSaldoFaltanteIva - valorizadosStats.totalSaldoFaltanteNeto).toLocaleString('es-CL')}</strong>
                        </div>
                      </div>
                    </div>

                    {/* VISUAL CHART / BARRA DE PROGRESO GLOBAL */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '20px 24px',
                      marginBottom: '26px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <BarChart3 size={18} color="#38bdf8" />
                          <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>
                            Distribución de Cumplimiento Financiero Global
                          </strong>
                        </div>
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          padding: '3px 12px',
                          borderRadius: '14px',
                          fontWeight: '700',
                          fontSize: '0.82rem',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          {valorizadosStats.porcentajeGlobalFinanciero}% Recepcionado
                        </span>
                      </div>

                      {/* Multi-segment Progress Bar */}
                      <div style={{
                        height: '24px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        position: 'relative',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}>
                        <div 
                          style={{
                            width: `${Math.min(100, valorizadosStats.porcentajeGlobalFinanciero)}%`,
                            background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                            transition: 'width 0.5s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            color: '#ffffff'
                          }}
                          title={`Recepcionado: $${valorizadosStats.totalRecepcionadoNeto.toLocaleString('es-CL')}`}
                        >
                          {valorizadosStats.porcentajeGlobalFinanciero >= 12 && `${valorizadosStats.porcentajeGlobalFinanciero}%`}
                        </div>
                        <div 
                          style={{
                            width: `${Math.max(0, 100 - valorizadosStats.porcentajeGlobalFinanciero)}%`,
                            background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                            transition: 'width 0.5s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            color: '#ffffff'
                          }}
                          title={`Saldo pendiente: $${valorizadosStats.totalSaldoFaltanteNeto.toLocaleString('es-CL')}`}
                        >
                          {(100 - valorizadosStats.porcentajeGlobalFinanciero) >= 12 && `${100 - valorizadosStats.porcentajeGlobalFinanciero}%`}
                        </div>
                      </div>

                      {/* Legend Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        marginTop: '16px',
                        fontSize: '0.82rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
                          <span style={{ color: '#94a3b8' }}>Recepcionado:</span>
                          <strong style={{ color: '#10b981' }}>${valorizadosStats.totalRecepcionadoNeto.toLocaleString('es-CL')}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                          <span style={{ color: '#94a3b8' }}>Saldo Pendiente Neto:</span>
                          <strong style={{ color: '#f59e0b' }}>${valorizadosStats.totalSaldoFaltanteNeto.toLocaleString('es-CL')}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#c080c0' }}></span>
                          <span style={{ color: '#94a3b8' }}>Saldo Pendiente c/IVA:</span>
                          <strong style={{ color: '#c080c0' }}>${valorizadosStats.totalSaldoFaltanteIva.toLocaleString('es-CL')}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PackageOpen size={14} color="#38bdf8" />
                          <span style={{ color: '#94a3b8' }}>Unidades por recibir:</span>
                          <strong style={{ color: '#38bdf8' }}>{valorizadosStats.totalUnidadesFaltantes.toLocaleString('es-CL')} un.</strong>
                        </div>
                      </div>
                    </div>

                    {/* SEARCH & FILTER CONTROLS */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
                        <div style={{ position: 'relative', width: '100%', maxWidth: '450px' }}>
                          <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={16} />
                          <input
                            type="text"
                            value={searchValorizados}
                            onChange={e => setSearchValorizados(e.target.value)}
                            placeholder="Buscar por N° OC, proveedor, RUT, código o artículo..."
                            className="input-field"
                            style={{ paddingLeft: '42px', height: '42px', fontSize: '0.85rem' }}
                          />
                        </div>

                        <select
                          value={filtroTipoValorizados}
                          onChange={e => setFiltroTipoValorizados(e.target.value)}
                          className="input-field"
                          style={{ width: '150px', height: '42px', fontSize: '0.85rem' }}
                        >
                          <option value="TODOS">Todos los tipos</option>
                          {TIPOS_OC.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowUpDown size={15} color="#94a3b8" />
                        <select
                          value={sortByValorizados}
                          onChange={e => setSortByValorizados(e.target.value)}
                          className="input-field"
                          style={{ width: '220px', height: '42px', fontSize: '0.85rem' }}
                        >
                          <option value="saldo_desc">Mayor saldo faltante primero</option>
                          <option value="saldo_asc">Menor saldo faltante primero</option>
                          <option value="avance_asc">Menor avance primero</option>
                          <option value="numero_oc">Por N° de OC</option>
                        </select>
                      </div>
                    </div>

                    {/* DATA TABLE */}
                    {filteredValorizadosOcs.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        background: 'rgba(15, 23, 42, 0.4)',
                        borderRadius: '12px',
                        border: '1px dashed var(--border-color)',
                        color: '#94a3b8'
                      }}>
                        <Layers size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                        <h4 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: '1.05rem' }}>
                          {ocsValorizados.length === 0
                            ? 'No hay Órdenes de Compra con entregas parciales actualmente'
                            : 'No se encontraron Órdenes que coincidan con la búsqueda'}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                          {ocsValorizados.length === 0
                            ? 'Cuando se registren recepciones parciales en la pestaña "Recepción de Productos", aparecerán valorizadas aquí automáticamente.'
                            : 'Pruebe ajustando los términos de búsqueda o los filtros seleccionados.'}
                        </p>
                      </div>
                    ) : (
                      <div className="table-container" style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(15, 23, 42, 0.85)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                              <th style={{ padding: '12px 14px' }}>N° OC / TIPO</th>
                              <th style={{ padding: '12px 14px' }}>PROVEEDOR</th>
                              <th style={{ padding: '12px 14px', width: '170px' }}>AVANCE FÍSICO</th>
                              <th style={{ padding: '12px 14px', textAlign: 'right' }}>TOTAL NETO</th>
                              <th style={{ padding: '12px 14px', textAlign: 'right' }}>RECEPCIONADO NETO</th>
                              <th style={{ padding: '12px 14px', textAlign: 'right' }}>SALDO FALTANTE NETO</th>
                              <th style={{ padding: '12px 14px', textAlign: 'right' }}>SALDO C/IVA (19%)</th>
                              <th style={{ padding: '12px 14px', textAlign: 'center', width: '110px' }}>FALTANTES</th>
                              <th style={{ padding: '12px 14px', textAlign: 'center', width: '90px' }}>DETALLE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredValorizadosOcs.map(oc => {
                              const isExpanded = expandedValorizadoOcId === oc.id;
                              return (
                                <React.Fragment key={oc.id}>
                                  <tr 
                                    onClick={() => setExpandedValorizadoOcId(isExpanded ? null : oc.id)}
                                    style={{
                                      borderBottom: isExpanded ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                                      cursor: 'pointer',
                                      background: isExpanded ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                                      transition: 'background 0.2s ease'
                                    }}
                                    onMouseEnter={e => {
                                      if (!isExpanded) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                    }}
                                    onMouseLeave={e => {
                                      if (!isExpanded) e.currentTarget.style.background = 'transparent';
                                    }}
                                  >
                                    {/* N° OC & Tipo */}
                                    <td style={{ padding: '14px' }}>
                                      <div style={{ fontWeight: '700', color: '#38bdf8', fontSize: '0.92rem' }}>
                                        {oc.numero_oc}
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                                        <span style={{
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.72rem',
                                          fontWeight: '700',
                                          background: 'rgba(56, 189, 248, 0.15)',
                                          color: '#38bdf8'
                                        }}>
                                          {oc.tipo_oc || 'AG'}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                          {oc.estado}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Proveedor & RUT */}
                                    <td style={{ padding: '14px' }}>
                                      <div style={{ fontWeight: '600', color: '#f8fafc', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {oc.proveedor}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                        RUT: {oc.rut_proveedor || 'S/R'}
                                      </div>
                                    </td>

                                    {/* Avance Físico */}
                                    <td style={{ padding: '14px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                        <strong style={{ color: '#10b981' }}>{oc.porcentajeAvance}%</strong>
                                        <span style={{ color: '#94a3b8' }}>{oc.totalRec} de {oc.totalSol} un.</span>
                                      </div>
                                      <div style={{ height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                          width: `${Math.min(100, oc.porcentajeAvance)}%`,
                                          height: '100%',
                                          background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                                          borderRadius: '4px'
                                        }}></div>
                                      </div>
                                    </td>

                                    {/* Total Neto */}
                                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: '600', color: '#cbd5e1' }}>
                                      ${oc.totalNeto.toLocaleString('es-CL')}
                                    </td>

                                    {/* Recepcionado Neto */}
                                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                                      ${oc.recepcionadoNeto.toLocaleString('es-CL')}
                                    </td>

                                    {/* Saldo Faltante Neto */}
                                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: '800', color: '#f59e0b' }}>
                                      ${oc.saldoFaltanteNeto.toLocaleString('es-CL')}
                                    </td>

                                    {/* Saldo Faltante con IVA */}
                                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: '800', color: '#c080c0' }}>
                                      ${oc.saldoFaltanteIva.toLocaleString('es-CL')}
                                    </td>

                                    {/* Faltantes Badge */}
                                    <td style={{ padding: '14px', textAlign: 'center' }}>
                                      <span style={{
                                        padding: '3px 8px',
                                        borderRadius: '12px',
                                        fontSize: '0.74rem',
                                        fontWeight: '700',
                                        background: 'rgba(245, 158, 11, 0.15)',
                                        color: '#f59e0b',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        display: 'inline-block'
                                      }}>
                                        {oc.totalArtsIncompletos} ítem(s)
                                      </span>
                                    </td>

                                    {/* Botón Detalle */}
                                    <td style={{ padding: '14px', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          setExpandedValorizadoOcId(isExpanded ? null : oc.id);
                                        }}
                                        style={{
                                          background: isExpanded ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                          border: isExpanded ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                          color: isExpanded ? '#38bdf8' : '#94a3b8',
                                          borderRadius: '6px',
                                          padding: '6px 10px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          transition: 'all 0.2s ease'
                                        }}
                                      >
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        {isExpanded ? 'Ocultar' : 'Ver'}
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Sub-tabla Desplegable con detalle por artículo */}
                                  {isExpanded && (
                                    <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                      <td colSpan={9} style={{ padding: '16px 20px' }}>
                                        <div style={{
                                          background: 'rgba(0, 0, 0, 0.3)',
                                          border: '1px solid rgba(255, 255, 255, 0.08)',
                                          borderRadius: '10px',
                                          padding: '16px'
                                        }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <PackageOpen size={16} color="#38bdf8" />
                                              <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>
                                                Desglose de Artículos de la Orden {oc.numero_oc}
                                              </strong>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                              {oc.articulosIncompletos.length} artículo(s) con saldo pendiente
                                            </span>
                                          </div>

                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                            <thead>
                                              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', textAlign: 'left' }}>
                                                <th style={{ padding: '8px' }}>CÓDIGO</th>
                                                <th style={{ padding: '8px' }}>DESCRIPCIÓN</th>
                                                <th style={{ padding: '8px', textAlign: 'center', width: '90px' }}>SOLICITADO</th>
                                                <th style={{ padding: '8px', textAlign: 'center', width: '90px' }}>RECIBIDO</th>
                                                <th style={{ padding: '8px', textAlign: 'center', width: '90px' }}>FALTANTE</th>
                                                <th style={{ padding: '8px', textAlign: 'right', width: '120px' }}>PRECIO UNIT.</th>
                                                <th style={{ padding: '8px', textAlign: 'right', width: '140px' }}>SALDO FALTANTE NETO</th>
                                                <th style={{ padding: '8px', textAlign: 'right', width: '140px' }}>SALDO C/IVA</th>
                                                <th style={{ padding: '8px', textAlign: 'center', width: '120px' }}>ESTADO</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(oc.ordenes_compra_articulos || []).map((art, aIdx) => {
                                                const cantSol = Number(art.cantidad) || 0;
                                                const cantRec = Number(art.cantidad_recepcionada) || 0;
                                                const cantFalt = Math.max(0, cantSol - cantRec);
                                                const pUnit = Number(art.precio_unitario) || 0;
                                                const saldoNetoArt = cantFalt * pUnit;
                                                const saldoIvaArt = Math.round(saldoNetoArt * 1.19);
                                                const isArtComplete = cantRec >= cantSol;
                                                const nombreArt = articulosCatalog[art.codigo_articulo] || art.descripcion || `Artículo ${art.codigo_articulo}`;

                                                return (
                                                  <tr 
                                                    key={art.id || aIdx}
                                                    style={{
                                                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                                      background: !isArtComplete ? 'rgba(245, 158, 11, 0.03)' : 'transparent'
                                                    }}
                                                  >
                                                    <td style={{ padding: '10px 8px' }}>
                                                      <span style={{ fontWeight: '700', color: '#38bdf8' }}>
                                                        {art.codigo_articulo}
                                                      </span>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', color: '#e2e8f0' }}>
                                                      {nombreArt}
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#cbd5e1', fontWeight: '600' }}>
                                                      {cantSol} un.
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#10b981', fontWeight: '700' }}>
                                                      {cantRec} un.
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', color: cantFalt > 0 ? '#f59e0b' : '#64748b', fontWeight: '700' }}>
                                                      {cantFalt} un.
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#cbd5e1' }}>
                                                      ${pUnit.toLocaleString('es-CL')}
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: cantFalt > 0 ? '#f59e0b' : '#64748b' }}>
                                                      ${saldoNetoArt.toLocaleString('es-CL')}
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: cantFalt > 0 ? '#c080c0' : '#64748b' }}>
                                                      ${saldoIvaArt.toLocaleString('es-CL')}
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                      <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: '700',
                                                        background: isArtComplete ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                        color: isArtComplete ? '#10b981' : '#f59e0b',
                                                        border: `1px solid ${isArtComplete ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                                      }}>
                                                        {isArtComplete ? 'Completo' : 'Parcial'}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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
        )}

        {view === 'create' && (
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
                <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Asignar Orden de Compra (OC)</h2>
              </div>
              <button onClick={() => setView('list')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeft size={16} /> Volver
              </button>
            </div>

            {/* Form layout grid */}
            <div className="responsive-grid-2" style={{ marginBottom: '30px' }}>
              {/* Lado Izquierdo - Datos Generales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* PASO 1: BÚSQUEDA Y ASIGNACIÓN DE SOLICITUD DE COMPRA */}
                <div style={{
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  position: 'relative'
                }}>
                  <label style={{ ...labelStyle, color: '#3b82f6', fontWeight: '700', marginBottom: '8px' }}>
                    <FileText size={16} /> Paso 1: Buscar y Seleccionar Solicitud QF *
                  </label>
                  <input
                    type="text"
                    value={formData.solicitud_compra}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, solicitud_compra: val }));
                      setShowSolicitudSuggestions(true);
                    }}
                    onFocus={() => setShowSolicitudSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSolicitudSuggestions(false), 200);
                    }}
                    placeholder="Buscar por N° Solicitud (ej: 1234 -> S-1234) o Centro de Costo..."
                    className="input-field"
                    style={{ borderColor: formData.solicitud_compra ? '#3b82f6' : 'rgba(255,255,255,0.1)' }}
                  />
                  <small style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '6px', display: 'block' }}>
                    Al seleccionar la solicitud, sus artículos se cargarán automáticamente en la OC.
                  </small>

                  {/* Dropdown suggestions for Solicitudes */}
                  {showSolicitudSuggestions && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#0f172a',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 100,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                      marginTop: '4px'
                    }}>
                      {solicitudesOptions.filter(s => 
                        (s.numero_solicitud || '').toLowerCase().includes((formData.solicitud_compra || '').toLowerCase()) ||
                        (s.centro_costo_nombre || '').toLowerCase().includes((formData.solicitud_compra || '').toLowerCase())
                      ).length === 0 ? (
                        <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
                          No se encontraron solicitudes registradas
                        </div>
                      ) : (
                        solicitudesOptions.filter(s => 
                          (s.numero_solicitud || '').toLowerCase().includes((formData.solicitud_compra || '').toLowerCase()) ||
                          (s.centro_costo_nombre || '').toLowerCase().includes((formData.solicitud_compra || '').toLowerCase())
                        ).map(s => {
                          const childItems = s.solicitudes_compra_articulos || [];
                          return (
                            <div
                              key={s.id}
                              onMouseDown={() => handleSeleccionarSolicitud(s)}
                              style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: '#cbd5e1',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                                e.currentTarget.style.color = '#3b82f6';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#cbd5e1';
                              }}
                            >
                              <div>
                                <strong style={{ color: '#3b82f6' }}>{s.numero_solicitud}</strong>
                                <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                                  ({s.centro_costo_nombre || 'Sin CC'})
                                </span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>
                                {childItems.length || 1} prod.
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}><FileText size={16} /> Número de OC *</label>
                  <input
                    type="text"
                    value={formData.numero_oc}
                    onChange={e => setFormData(prev => ({ ...prev, numero_oc: e.target.value }))}
                    placeholder="Ej: 10452-87-SE26"
                    className="input-field"
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>Proveedor</label>
                  <input
                    type="text"
                    value={proveedorSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setProveedorSearch(val);
                      const filtered = proveedores.filter(p => 
                        (p.nombre_proveedor || '').toLowerCase().includes(val.toLowerCase()) ||
                        (p.rut || '').toLowerCase().includes(val.toLowerCase())
                      );
                      setFormData(prev => ({ 
                        ...prev, 
                        proveedor: val,
                        rut_proveedor: proveedores.find(p => (p.nombre_proveedor || '').toLowerCase() === val.toLowerCase())?.rut || ''
                      }));
                      setShowProveedorSuggestions(true);
                    }}
                    onFocus={() => setShowProveedorSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowProveedorSuggestions(false), 200);
                    }}
                    placeholder="Seleccionar o buscar proveedor..."
                    className="input-field"
                  />
                  {showProveedorSuggestions && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 100,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      marginTop: '4px'
                    }}>
                      {proveedores.filter(p => 
                        (p.nombre_proveedor || '').toLowerCase().includes(proveedorSearch.toLowerCase()) ||
                        (p.rut || '').toLowerCase().includes(proveedorSearch.toLowerCase())
                      ).length === 0 ? (
                        <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic' }}>
                          No se encontraron proveedores
                        </div>
                      ) : (
                        proveedores.filter(p => 
                          (p.nombre_proveedor || '').toLowerCase().includes(proveedorSearch.toLowerCase()) ||
                          (p.rut || '').toLowerCase().includes(proveedorSearch.toLowerCase())
                        ).map(p => (
                          <div
                            key={p.id}
                            onMouseDown={() => {
                              setProveedorSearch(p.nombre_proveedor);
                              setFormData(prev => ({
                                ...prev,
                                proveedor: p.nombre_proveedor,
                                rut_proveedor: p.rut
                              }));
                              setShowProveedorSuggestions(false);
                            }}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              color: '#cbd5e1',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => {
                              e.target.style.background = 'rgba(59, 130, 246, 0.15)';
                              e.target.style.color = '#3b82f6';
                            }}
                            onMouseLeave={e => {
                              e.target.style.background = 'transparent';
                              e.target.style.color = '#cbd5e1';
                            }}
                          >
                            <span style={{ fontWeight: '600' }}>{p.nombre_proveedor}</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>({p.rut})</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {/* Manual date selector: Fecha de Envío */}
                <div>
                  <label style={labelStyle}><Calendar size={16} /> Fecha de Envío *</label>
                  <input
                    type="text"
                    value={formData.fecha_envio_display}
                    onChange={handleDateDisplayChange}
                    placeholder="DD/MM/YYYY"
                    className="input-field"
                    style={{ letterSpacing: '0.05em' }}
                  />
                  <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Formato: Día/Mes/Año (ej: 19/05/2026)
                  </small>
                </div>

                {/* Manual date selector: Fecha de Aceptación */}
                <div>
                  <label style={labelStyle}><Calendar size={16} /> Fecha de Aceptación (Manual / Opcional)</label>
                  <input
                    type="text"
                    value={formData.fecha_aceptacion_display || ''}
                    onChange={e => setFormData(prev => ({ ...prev, fecha_aceptacion_display: e.target.value }))}
                    placeholder="DD/MM/YYYY"
                    className="input-field"
                    style={{ letterSpacing: '0.05em' }}
                  />
                  <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Requerido si la OC ya fue aceptada por el proveedor.
                  </small>
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
                    {TIPOS_OC.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Fechas Tope */}
                <div style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  padding: '16px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <strong style={{ color: '#3b82f6', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={15} /> Fechas Clave y Plazos
                  </strong>
                  {formData.solicitud_compra && (formData.fecha_tope_aceptacion || formData.fecha_tope_entrega || formData.fecha_tope_multa || formData.fecha_insistencia) && (
                    <small style={{ color: '#10b981', fontSize: '0.75rem' }}>
                      Heredado de la solicitud {formData.solicitud_compra} (puede editarse).
                    </small>
                  )}

                  {formData.tipo_oc === 'SE' ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Tope aceptación</label>
                          <input
                            type="date"
                            className="input-field"
                            style={{ fontSize: '0.85rem' }}
                            value={formData.fecha_tope_aceptacion}
                            onChange={e => setFormData(prev => ({ ...prev, fecha_tope_aceptacion: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Tope entrega (sin multa)</label>
                          <input
                            type="date"
                            className="input-field"
                            style={{ fontSize: '0.85rem' }}
                            value={formData.fecha_tope_entrega}
                            onChange={e => setFormData(prev => ({ ...prev, fecha_tope_entrega: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#fb923c', display: 'block', marginBottom: '4px' }}>Tope máximo con multa</label>
                          <input
                            type="date"
                            className="input-field"
                            style={{ fontSize: '0.85rem', borderColor: 'rgba(251, 146, 60, 0.5)' }}
                            value={formData.fecha_tope_multa}
                            onChange={e => setFormData(prev => ({ ...prev, fecha_tope_multa: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '0.75rem', color: '#f4c2c2', display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                          Fecha de Insistencia (SE: Despacho Parcial)
                        </label>
                        <input
                          type="date"
                          className="input-field"
                          style={{ fontSize: '0.85rem', borderColor: 'rgba(244, 194, 194, 0.6)' }}
                          value={formData.fecha_insistencia}
                          onChange={e => setFormData(prev => ({ ...prev, fecha_insistencia: e.target.value }))}
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Tope aceptación</label>
                        <input
                          type="date"
                          className="input-field"
                          style={{ fontSize: '0.85rem' }}
                          value={formData.fecha_tope_aceptacion}
                          onChange={e => setFormData(prev => ({ ...prev, fecha_tope_aceptacion: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Tope entrega (sin multa)</label>
                        <input
                          type="date"
                          className="input-field"
                          style={{ fontSize: '0.85rem' }}
                          value={formData.fecha_tope_entrega}
                          onChange={e => setFormData(prev => ({ ...prev, fecha_tope_entrega: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#fb923c', display: 'block', marginBottom: '4px' }}>Tope máximo con multa</label>
                        <input
                          type="date"
                          className="input-field"
                          style={{ fontSize: '0.85rem', borderColor: 'rgba(251, 146, 60, 0.5)' }}
                          value={formData.fecha_tope_multa}
                          onChange={e => setFormData(prev => ({ ...prev, fecha_tope_multa: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  <small style={{ color: '#94a3b8', fontSize: '0.75rem', lineHeight: 1.5 }}>
                    {formData.tipo_oc === 'SE'
                      ? 'Para órdenes SE: además de los plazos habituales, activa alerta rosa bebé 1 día antes de la fecha de insistencia para solicitar despacho parcial por correo.'
                      : 'Semáforo: amarillo 1 día antes de cada tope · naranja atrasado con multa · rojo vencido.'}
                  </small>
                </div>

                <div>
                  <label style={labelStyle}>Estado Inicial</label>
                  <select
                    value={formData.estado}
                    onChange={e => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                    className="input-field"
                  >
                    <option value="Enviada">Enviada</option>
                    <option value="Aceptada">Aceptada</option>
                    <option value="Excepciones">Excepciones (Aceptada fuera de plazo)</option>
                    <option value="Recepción de excepción">Recepción de excepción (Recibida bajo excepción)</option>
                    <option value="Cancelado">Cancelado (Liberar artículos)</option>
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

              {/* Resumen Financiero Crear OC */}
              {(() => {
                const formTotalNeto = articulosForm.reduce((sum, r) => sum + ((Number(r.cantidad) || 0) * (Number(r.precio_unitario) || 0)), 0);
                const formTotalIva = Math.round(formTotalNeto * 1.19);
                const formSaldoOc = formTotalNeto;
                return (
                  <div style={{
                    marginTop: '20px',
                    padding: '16px 20px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '14px',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Total Neto</span>
                      <strong style={{ fontSize: '1.15rem', color: '#f8fafc' }}>${formTotalNeto.toLocaleString('es-CL')}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>IVA (19%)</span>
                      <strong style={{ fontSize: '1.15rem', color: '#cbd5e1' }}>${(formTotalIva - formTotalNeto).toLocaleString('es-CL')}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Total con IVA</span>
                      <strong style={{ fontSize: '1.15rem', color: '#38bdf8' }}>${formTotalIva.toLocaleString('es-CL')}</strong>
                    </div>
                    <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '14px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#10b981', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Saldo Inicial OC</span>
                      <strong style={{ fontSize: '1.15rem', color: '#10b981' }}>${formSaldoOc.toLocaleString('es-CL')}</strong>
                    </div>
                  </div>
                );
              })()}
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

      {/* POPUP DETAIL MODAL */}
      <AnimatePresence>
        {selectedOcForModal && (
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
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedOcForModal(null)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'var(--btn-secondary-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  padding: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <X size={18} />
              </button>

              {/* Title & Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
                  <Truck size={24} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    Orden de Compra: {selectedOcForModal.numero_oc}
                  </h3>
                </div>
              </div>

              {/* Details Info Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                gap: '15px', 
                background: 'var(--btn-secondary-bg)',
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
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Estado de OC</span>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '6px', 
                    fontSize: '0.8rem', 
                    fontWeight: '700',
                    background: selectedOcForModal.estado === 'Enviada' ? 'rgba(59, 130, 246, 0.15)' : 
                                selectedOcForModal.estado === 'Aceptada' ? 'rgba(16, 185, 129, 0.15)' : 
                                (selectedOcForModal.estado === 'Excepciones' || selectedOcForModal.estado === 'Recepción de excepción') ? 'rgba(192, 128, 192, 0.25)' :
                                (selectedOcForModal.estado === 'Recepción Conforme' || selectedOcForModal.estado === 'Recepcionado') ? 'rgba(16, 185, 129, 0.25)' :
                                selectedOcForModal.estado === 'Recepción Con Multa' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                    color: selectedOcForModal.estado === 'Enviada' ? '#3b82f6' : 
                           selectedOcForModal.estado === 'Aceptada' ? '#10b981' : 
                           (selectedOcForModal.estado === 'Excepciones' || selectedOcForModal.estado === 'Recepción de excepción') ? '#c080c0' :
                           (selectedOcForModal.estado === 'Recepción Conforme' || selectedOcForModal.estado === 'Recepcionado') ? '#10b981' :
                           selectedOcForModal.estado === 'Recepción Con Multa' ? '#fb923c' : '#f59e0b',
                    display: 'inline-block',
                    marginTop: '4px'
                  }}>
                    {selectedOcForModal.estado}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Fecha de Envío</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatDate(selectedOcForModal.fecha_envio)}</strong>
                  {selectedOcForModal.fecha_aceptacion && (
                    <span style={{ display: 'block', color: '#10b981', fontSize: '0.8rem', marginTop: '2px' }}>
                      Aceptada: {formatDate(selectedOcForModal.fecha_aceptacion)}
                    </span>
                  )}
                  {selectedOcForModal.tipo_oc === 'SE' && selectedOcForModal.fecha_insistencia && (
                    <span style={{ display: 'block', color: '#f4c2c2', fontSize: '0.8rem', marginTop: '2px', fontWeight: '600' }}>
                      Insistencia: {formatISOToDisplay(selectedOcForModal.fecha_insistencia)}
                    </span>
                  )}
                </div>
              </div>

              {/* Alert Message inside Modal */}
              {(() => {
                const plazos = checkPlazos(selectedOcForModal);
                if (!(plazos.isExpired || plazos.isYellow || plazos.isOrange || plazos.isRosa || plazos.isPurpura)) return null;
                return (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    background: plazos.badgeBg, 
                    border: `1px solid ${plazos.badgeColor}`, 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    color: plazos.badgeColor, 
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    marginBottom: '25px'
                  }}>
                    <AlertTriangle size={18} />
                    {plazos.alertMessage}
                  </div>
                );
              })()}

              {/* Tabs navigation */}
              <div style={{ 
                display: 'flex', 
                borderBottom: '1px solid var(--border-color)', 
                marginBottom: '20px',
                gap: '10px'
              }}>
                <button 
                  onClick={() => setModalTab('articulos')}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: modalTab === 'articulos' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: modalTab === 'articulos' ? '#3b82f6' : 'var(--text-secondary)',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '-1px'
                  }}
                >
                  Artículos ({(selectedOcForModal.ordenes_compra_articulos || []).length})
                </button>
                <button 
                  onClick={() => setModalTab('bitacora')}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: modalTab === 'bitacora' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: modalTab === 'bitacora' ? '#3b82f6' : 'var(--text-secondary)',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '-1px'
                  }}
                >
                  Bitácora ({comentarios.length})
                </button>
              </div>

              {/* Conditional content */}
              {modalTab === 'articulos' ? (
                <>
                  {/* Modal Articles Table */}
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>Detalle de Artículos</h4>
                  <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                          <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>ARTÍCULO / DETALLE</th>
                          <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', width: '160px', textAlign: 'right' }}>ESTADO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOcForModal.ordenes_compra_articulos || []).map((art, idx) => {
                          const descripcionArt = articulosCatalog[art.codigo_articulo] || '';
                          const tituloCompleto = art.codigo_articulo 
                            ? `(${art.codigo_articulo}) ${descripcionArt || 'Artículo ' + art.codigo_articulo}`
                            : (descripcionArt || 'Artículo');
                          const cantSol = art.cantidad || 0;
                          const estadoArt = art.estado_recepcion || 'Pendiente';
                          const historialList = Array.isArray(art.historial_cambios) ? art.historial_cambios : [];
                          const isExpanded = expandedArticleId === (art.id || idx);

                          // Colores del Sistema 2
                          const estadoConfig = {
                            'Pendiente':    { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
                            'Recepcionado': { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
                            'Rechazado':    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
                            'Revisado':     { color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
                          };
                          const cfg = estadoConfig[estadoArt] || estadoConfig['Pendiente'];

                          return (
                            <React.Fragment key={art.id || idx}>
                              <tr 
                                onClick={() => setExpandedArticleId(isExpanded ? null : (art.id || idx))}
                                style={{ 
                                  borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', 
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                  background: isExpanded ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isExpanded) e.currentTarget.style.background = 'var(--btn-secondary-bg)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isExpanded) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                                    {tituloCompleto}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    <span>Solicitado: <strong style={{ color: 'var(--text-primary)' }}>{cantSol} uds.</strong></span>
                                    {art.precio_unitario != null && Number(art.precio_unitario) > 0 && (
                                      <>
                                        <span style={{ color: 'var(--border-color)' }}>•</span>
                                        <span>P. Unit.: <strong style={{ color: '#38bdf8' }}>${Number(art.precio_unitario).toLocaleString('es-CL')}</strong></span>
                                        <span style={{ color: 'var(--border-color)' }}>•</span>
                                        <span>Subtotal: <strong style={{ color: '#10b981' }}>${((Number(art.subtotal_neto) || (cantSol * Number(art.precio_unitario)))).toLocaleString('es-CL')}</strong></span>
                                      </>
                                    )}
                                    <span style={{ color: 'var(--border-color)' }}>•</span>
                                    <span style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      color: isExpanded ? '#3b82f6' : 'var(--text-secondary)',
                                      fontWeight: '600',
                                      fontSize: '0.74rem',
                                      background: isExpanded ? 'rgba(59, 130, 246, 0.15)' : 'var(--btn-secondary-bg)',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      border: isExpanded ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)'
                                    }}>
                                      <Clock size={12} />
                                      {historialList.length > 0 ? `${historialList.length} cambio(s)` : 'Ver historial'}
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 12px', verticalAlign: 'top', textAlign: 'right' }}>
                                  <span style={{ 
                                    padding: '4px 8px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: '700',
                                    background: cfg.bg,
                                    color: cfg.color,
                                    display: 'inline-block'
                                  }}>
                                    {estadoArt}
                                  </span>
                                </td>
                              </tr>
                              {/* Fila expandible minimalista con el Historial */}
                              {isExpanded && (
                                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--btn-secondary-bg)' }}>
                                  <td colSpan={2} style={{ padding: '0 12px 10px 12px' }}>
                                    <div style={{
                                      padding: '8px 12px',
                                      background: 'var(--input-bg)',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px'
                                    }}>
                                      {historialList.length === 0 ? (
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                          Sin cambios registrados
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          {historialList.map((h, hIdx) => {
                                            const deCfg = estadoConfig[h.de] || estadoConfig['Pendiente'];
                                            const aCfg = estadoConfig[h.a] || estadoConfig['Pendiente'];
                                            return (
                                              <div 
                                                key={hIdx} 
                                                style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  justifyContent: 'space-between', 
                                                  flexWrap: 'wrap', 
                                                  gap: '8px', 
                                                  fontSize: '0.78rem', 
                                                  padding: '4px 6px',
                                                  borderRadius: '4px'
                                                }}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: aCfg.color }}></span>
                                                  <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', background: deCfg.bg, color: deCfg.color }}>
                                                    {h.de}
                                                  </span>
                                                  <span style={{ color: 'var(--text-secondary)', fontWeight: '700', fontSize: '0.75rem' }}>➔</span>
                                                  <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', background: aCfg.bg, color: aCfg.color }}>
                                                    {h.a}
                                                  </span>
                                                </div>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.73rem' }}>
                                                  {h.fecha ? formatDateTime(h.fecha) : 'Fecha no registrada'}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Resumen Financiero OC en Detalle */}
                  {(() => {
                    const detNeto = selectedOcForModal.total_neto != null 
                      ? Number(selectedOcForModal.total_neto) 
                      : modalArticulos.reduce((s, a) => s + (Number(a.subtotal_neto) || ((Number(a.cantidad_solicitada) || Number(a.cantidad) || 0) * (Number(a.precio_unitario) || 0))), 0);
                    const detIva = selectedOcForModal.total_con_iva != null
                      ? Number(selectedOcForModal.total_con_iva)
                      : Math.round(detNeto * 1.19);
                    const detSaldo = selectedOcForModal.saldo_oc != null
                      ? Number(selectedOcForModal.saldo_oc)
                      : (detNeto - modalArticulos.reduce((s, a) => s + ((Number(a.cantidad_recepcionada) || 0) * (Number(a.precio_unitario) || 0)), 0));

                    if (detNeto <= 0) return null;

                    return (
                      <div style={{
                        marginTop: '16px',
                        padding: '14px 18px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '12px',
                        alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Total Neto</span>
                          <strong style={{ fontSize: '1.05rem', color: '#f8fafc' }}>${detNeto.toLocaleString('es-CL')}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>IVA (19%)</span>
                          <strong style={{ fontSize: '1.05rem', color: '#cbd5e1' }}>${(detIva - detNeto).toLocaleString('es-CL')}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Total con IVA</span>
                          <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>${detIva.toLocaleString('es-CL')}</strong>
                        </div>
                        <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '14px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#10b981', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Saldo Pendiente OC</span>
                          <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>${detSaldo.toLocaleString('es-CL')}</strong>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Listado de Anotaciones */}
                  <div style={{ 
                    maxHeight: '230px', 
                    overflowY: 'auto', 
                    background: 'var(--input-bg)', 
                    borderRadius: '10px', 
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
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
                          background: 'var(--btn-secondary-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '12px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: '700', color: '#3b82f6' }}>Anotación #{index + 1}</span>
                            <span>{formatDateTime(com.created_at)}</span>
                          </div>
                          <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                            {com.comentario}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Formulario de Nueva Anotación */}
                  <form onSubmit={handleAddComentario} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                      placeholder="Escribe una observación o comentario sobre el estado de esta OC..."
                      value={nuevoComentario}
                      onChange={(e) => setNuevoComentario(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        resize: 'none',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

              {/* Close Bottom Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '25px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button 
                  onClick={() => setSelectedOcForModal(null)} 
                  className="btn-secondary" 
                  style={{ padding: '8px 20px', fontSize: '0.85rem' }}
                >
                  Cerrar Ventana
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ENVIAR CORREO A PROVEEDOR (OUTLOOK WEB) */}
      <AnimatePresence>
        {isEmailModalOpen && selectedOcForEmail && (
          <div 
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
            onClick={() => setIsEmailModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#0f172a',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '720px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '26px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
              }}
            >
              {/* Header Modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Mail size={22} color="#38bdf8" />
                    Enviar Correo a Proveedor (OC: {selectedOcForEmail.numero_oc})
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    {selectedOcForEmail.proveedor} {selectedOcForEmail.rut_proveedor ? `(RUT: ${selectedOcForEmail.rut_proveedor})` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              {loadingEmailData ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
                  Cargando datos del proveedor y plantillas...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Selector de Tipo de Correo */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
                      Tipo de Correo (Plantilla Configurada en Ajustes)
                    </label>
                    <select
                      value={selectedPlantillaId}
                      onChange={(e) => handleCambiarPlantilla(e.target.value)}
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem', fontWeight: '600' }}
                    >
                      {plantillasCorreo.length === 0 ? (
                        <option value="">(No hay plantillas creadas en Ajustes - Redacción libre)</option>
                      ) : (
                        plantillasCorreo.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.titulo}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Campo Para (Destinatarios del Proveedor) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600' }}>
                        Para (Destinatario{proveedorCantidadCorreos > 1 ? 's' : ''}) *
                      </label>
                      {proveedorTieneEmail ? (
                        <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={12} /> {proveedorCantidadCorreos > 1 ? `${proveedorCantidadCorreos} correos obtenidos de ficha de proveedores` : 'Obtenido de ficha de proveedores'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#eab308' }}>
                          ⚠️ Sin correo registrado en ficha (sepáralos con coma si son varios)
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      value={emailPara}
                      onChange={(e) => setEmailPara(e.target.value)}
                      placeholder="ventas@proveedor.cl, contacto@proveedor.cl"
                    />
                  </div>

                  {/* Campo Asunto */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                      Asunto
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem', fontWeight: '600' }}
                      value={emailAsunto}
                      onChange={(e) => setEmailAsunto(e.target.value)}
                    />
                  </div>

                  {/* Campo Cuerpo del Mensaje */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                      Cuerpo del Mensaje (Pre-rellenado con datos de la OC)
                    </label>
                    <textarea
                      rows={8}
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem', lineHeight: 1.5, resize: 'vertical' }}
                      value={emailCuerpo}
                      onChange={(e) => setEmailCuerpo(e.target.value)}
                    />
                  </div>

                  {/* Botonera de Envío */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleCopiarContenido}
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                    >
                      {copiadoFeedback ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      {copiadoFeedback ? '¡Copiado al portapapeles!' : 'Copiar Asunto y Mensaje'}
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setIsEmailModalOpen(false)}
                        className="btn-secondary"
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={handleAbrirOutlookWeb}
                        className="btn-primary"
                        style={{
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 18px',
                          fontWeight: '700'
                        }}
                      >
                        <ExternalLink size={16} /> Abrir en Outlook Web
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITAR ORDEN DE COMPRA / AG */}
      <AnimatePresence>
        {editingOc && (
          <div 
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
            onClick={() => !savingEdit && setEditingOc(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-card, #0f172a)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '820px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
                position: 'relative'
              }}
            >
              {/* Close Button */}
              <button 
                onClick={() => !savingEdit && setEditingOc(null)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'var(--btn-secondary-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  padding: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <X size={18} />
              </button>

              {/* Title & Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '22px' }}>
                <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '12px' }}>
                  <Edit3 size={24} color="#f59e0b" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    Editar Orden de Compra / AG
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '3px' }}>
                    Actualice el número de AG, proveedor, solicitud asignada, plazos y artículos.
                  </div>
                </div>
              </div>

              {/* 2-Column Form Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', marginBottom: '22px' }}>
                {/* Col 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}><FileText size={15} /> Número de OC / AG *</label>
                    <input 
                      type="text"
                      className="input-field"
                      value={editFormData.numero_oc}
                      onChange={e => setEditFormData(prev => ({ ...prev, numero_oc: e.target.value }))}
                      placeholder="Ej: 2332-1259-AG26"
                      style={{ fontWeight: '700', color: '#38bdf8' }}
                    />
                  </div>

                  <div style={{ position: 'relative' }}>
                    <label style={labelStyle}><ShoppingBag size={15} /> Solicitud de Compra Vinculada</label>
                    <input 
                      type="text"
                      className="input-field"
                      value={editSolicitudSearch}
                      onChange={e => {
                        const val = e.target.value;
                        setEditSolicitudSearch(val);
                        setEditFormData(prev => ({ ...prev, solicitud_compra: val }));
                        setShowEditSolicitudSuggestions(true);
                      }}
                      onFocus={() => setShowEditSolicitudSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowEditSolicitudSuggestions(false), 200)}
                      placeholder="Ej: S-8018 o buscar solicitud..."
                    />
                    {showEditSolicitudSuggestions && solicitudesOptions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        zIndex: 100,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        marginTop: '4px'
                      }}>
                        {solicitudesOptions
                          .filter(s => (s.numero_solicitud || '').toLowerCase().includes(editSolicitudSearch.toLowerCase()))
                          .slice(0, 8)
                          .map(s => (
                            <div
                              key={s.id}
                              onMouseDown={() => {
                                setEditSolicitudSearch(s.numero_solicitud);
                                setEditFormData(prev => ({ 
                                  ...prev, 
                                  solicitud_compra: s.numero_solicitud,
                                  fecha_tope_aceptacion: s.fecha_tope_aceptacion ? s.fecha_tope_aceptacion.slice(0, 10) : prev.fecha_tope_aceptacion,
                                  fecha_tope_entrega: s.fecha_tope_entrega ? s.fecha_tope_entrega.slice(0, 10) : prev.fecha_tope_entrega,
                                  fecha_tope_multa: s.fecha_tope_multa ? s.fecha_tope_multa.slice(0, 10) : prev.fecha_tope_multa
                                }));
                                setShowEditSolicitudSuggestions(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: '#cbd5e1',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                justifyContent: 'space-between'
                              }}
                            >
                              <strong style={{ color: '#3b82f6' }}>{s.numero_solicitud}</strong>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.centro_costo_nombre || ''}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>Tipo de OC</label>
                    <select
                      value={editFormData.tipo_oc}
                      onChange={e => setEditFormData(prev => ({ ...prev, tipo_oc: e.target.value }))}
                      className="input-field"
                    >
                      {TIPOS_OC.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Estado de la OC</label>
                    <select
                      value={editFormData.estado}
                      onChange={e => setEditFormData(prev => ({ ...prev, estado: e.target.value }))}
                      className="input-field"
                      style={{ fontWeight: '700' }}
                    >
                      <option value="Enviada">Enviada</option>
                      <option value="Aceptada">Aceptada</option>
                      <option value="Recepción Conforme">Recepción Conforme</option>
                      <option value="Recepción Con Multa">Recepción Con Multa</option>
                      <option value="Excepciones">Excepciones (Aceptada fuera de plazo)</option>
                      <option value="Recepción de excepción">Recepción de excepción (Recibida bajo excepción)</option>
                      <option value="Cancelado">Cancelado (Liberar artículos)</option>
                    </select>
                  </div>
                </div>

                {/* Col 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ position: 'relative' }}>
                    <label style={labelStyle}>Proveedor</label>
                    <input 
                      type="text"
                      className="input-field"
                      value={editProveedorSearch}
                      onChange={e => {
                        const val = e.target.value;
                        setEditProveedorSearch(val);
                        setEditFormData(prev => ({
                          ...prev,
                          proveedor: val,
                          rut_proveedor: proveedores.find(p => (p.nombre_proveedor || '').toLowerCase() === val.toLowerCase())?.rut || prev.rut_proveedor
                        }));
                        setShowEditProveedorSuggestions(true);
                      }}
                      onFocus={() => setShowEditProveedorSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowEditProveedorSuggestions(false), 200)}
                      placeholder="Nombre del proveedor..."
                    />
                    {showEditProveedorSuggestions && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        zIndex: 100,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        marginTop: '4px'
                      }}>
                        {proveedores
                          .filter(p => (p.nombre_proveedor || '').toLowerCase().includes(editProveedorSearch.toLowerCase()) || (p.rut || '').toLowerCase().includes(editProveedorSearch.toLowerCase()))
                          .slice(0, 8)
                          .map(p => (
                            <div
                              key={p.id}
                              onMouseDown={() => {
                                setEditProveedorSearch(p.nombre_proveedor);
                                setEditFormData(prev => ({
                                  ...prev,
                                  proveedor: p.nombre_proveedor,
                                  rut_proveedor: p.rut
                                }));
                                setShowEditProveedorSuggestions(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: '#cbd5e1',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                              }}
                            >
                              <span style={{ fontWeight: '600' }}>{p.nombre_proveedor}</span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>({p.rut})</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>RUT Proveedor</label>
                    <input 
                      type="text"
                      className="input-field"
                      value={editFormData.rut_proveedor}
                      onChange={e => setEditFormData(prev => ({ ...prev, rut_proveedor: e.target.value }))}
                      placeholder="Ej: 78027120-5"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}><Calendar size={14} /> Fecha Envío</label>
                      <input 
                        type="date"
                        className="input-field"
                        value={editFormData.fecha_envio}
                        onChange={e => setEditFormData(prev => ({ ...prev, fecha_envio: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}><Calendar size={14} /> Fecha Aceptación</label>
                      <input 
                        type="date"
                        className="input-field"
                        value={editFormData.fecha_aceptacion}
                        onChange={e => setEditFormData(prev => ({ ...prev, fecha_aceptacion: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Fechas Tope Box */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '22px'
              }}>
                <div style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Clock size={16} /> Fechas Tope y Plazos de Entrega (Semáforo)
                </div>

                {editFormData.tipo_oc === 'SE' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Tope Aceptación</label>
                        <input 
                          type="date"
                          className="input-field"
                          style={{ fontSize: '0.85rem' }}
                          value={editFormData.fecha_tope_aceptacion}
                          onChange={e => setEditFormData(prev => ({ ...prev, fecha_tope_aceptacion: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Tope Entrega (sin multa)</label>
                        <input 
                          type="date"
                          className="input-field"
                          style={{ fontSize: '0.85rem' }}
                          value={editFormData.fecha_tope_entrega}
                          onChange={e => setEditFormData(prev => ({ ...prev, fecha_tope_entrega: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#fb923c', display: 'block', marginBottom: '4px' }}>Tope Máximo con multa</label>
                        <input 
                          type="date"
                          className="input-field"
                          style={{ fontSize: '0.85rem', borderColor: 'rgba(251, 146, 60, 0.5)' }}
                          value={editFormData.fecha_tope_multa}
                          onChange={e => setEditFormData(prev => ({ ...prev, fecha_tope_multa: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ fontSize: '0.75rem', color: '#f4c2c2', display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                        Fecha de Insistencia (SE: Despacho Parcial)
                      </label>
                      <input 
                        type="date"
                        className="input-field"
                        style={{ fontSize: '0.85rem', borderColor: 'rgba(244, 194, 194, 0.6)' }}
                        value={editFormData.fecha_insistencia}
                        onChange={e => setEditFormData(prev => ({ ...prev, fecha_insistencia: e.target.value }))}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Tope Aceptación</label>
                      <input 
                        type="date"
                        className="input-field"
                        style={{ fontSize: '0.85rem' }}
                        value={editFormData.fecha_tope_aceptacion}
                        onChange={e => setEditFormData(prev => ({ ...prev, fecha_tope_aceptacion: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Tope Entrega (sin multa)</label>
                      <input 
                        type="date"
                        className="input-field"
                        style={{ fontSize: '0.85rem' }}
                        value={editFormData.fecha_tope_entrega}
                        onChange={e => setEditFormData(prev => ({ ...prev, fecha_tope_entrega: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#fb923c', display: 'block', marginBottom: '4px' }}>Tope Máximo con multa</label>
                      <input 
                        type="date"
                        className="input-field"
                        style={{ fontSize: '0.85rem', borderColor: 'rgba(251, 146, 60, 0.5)' }}
                        value={editFormData.fecha_tope_multa}
                        onChange={e => setEditFormData(prev => ({ ...prev, fecha_tope_multa: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Articulos de la OC Section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '700' }}>
                    Artículos Asociados ({editArticulos.length})
                  </h4>
                </div>

                {/* Table of articles */}
                <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Código</th>
                        <th style={{ padding: '8px 10px' }}>Descripción</th>
                        <th style={{ padding: '8px 10px', width: '100px' }}>Cant. Sol.</th>
                        <th style={{ padding: '8px 10px', width: '120px' }}>Precio Unit. ($)</th>
                        <th style={{ padding: '8px 10px', width: '120px' }}>Subtotal Neto</th>
                        <th style={{ padding: '8px 10px', width: '100px' }}>Recepcionado</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editArticulos.map((art, idx) => (
                        <tr key={art.id || `temp-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontWeight: '700', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                              {art.codigo_articulo}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#e2e8f0' }}>
                            {art.descripcion || articulosCatalog[art.codigo_articulo] || art.codigo_articulo}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input 
                              type="number"
                              min={art.cantidad_recepcionada || 1}
                              value={art.cantidad}
                              onChange={e => handleEditArticuloCantidad(idx, e.target.value)}
                              className="input-field"
                              style={{ width: '80px', padding: '4px 8px', fontSize: '0.85rem' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input 
                              type="number"
                              min="0"
                              step="any"
                              value={art.precio_unitario !== undefined && art.precio_unitario !== null ? art.precio_unitario : ''}
                              onChange={e => handleEditArticuloPrecio(idx, e.target.value)}
                              placeholder="0"
                              className="input-field"
                              style={{ width: '105px', padding: '4px 8px', fontSize: '0.85rem' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: '600', color: '#10b981' }}>
                            ${((Number(art.subtotal_neto) || ((Number(art.cantidad) || 0) * (Number(art.precio_unitario) || 0)))).toLocaleString('es-CL')}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '0.78rem',
                              fontWeight: '600',
                              background: art.cantidad_recepcionada > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                              color: art.cantidad_recepcionada > 0 ? '#10b981' : '#94a3b8'
                            }}>
                              {art.cantidad_recepcionada || 0} un.
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleEliminarArticuloEdit(idx)}
                              disabled={art.cantidad_recepcionada > 0}
                              title={art.cantidad_recepcionada > 0 ? 'No se puede eliminar porque ya tiene recepciones' : 'Quitar artículo de esta OC'}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: art.cantidad_recepcionada > 0 ? '#475569' : '#ef4444',
                                cursor: art.cantidad_recepcionada > 0 ? 'not-allowed' : 'pointer',
                                padding: '4px',
                                borderRadius: '4px'
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bar to add a new article to this OC */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed var(--border-color)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 2, minWidth: '150px' }}>
                    <input 
                      type="text"
                      className="input-field"
                      placeholder="Código del artículo (ej: 10452)..."
                      value={nuevoArticuloCodigo}
                      onChange={e => setNuevoArticuloCodigo(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                    />
                  </div>
                  <div style={{ width: '85px' }}>
                    <input 
                      type="number"
                      min="1"
                      className="input-field"
                      placeholder="Cant."
                      value={nuevoArticuloCantidad}
                      onChange={e => setNuevoArticuloCantidad(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                    />
                  </div>
                  <div style={{ width: '115px' }}>
                    <input 
                      type="number"
                      min="0"
                      step="any"
                      className="input-field"
                      placeholder="Precio Unit. ($)"
                      value={nuevoArticuloPrecio}
                      onChange={e => setNuevoArticuloPrecio(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAgregarArticuloEdit}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.85rem', fontWeight: '600' }}
                  >
                    <Plus size={14} /> Añadir
                  </button>
                </div>

                {/* Resumen Financiero Edit Modal */}
                {(() => {
                  const editTotalNeto = editArticulos.reduce((sum, a) => sum + ((Number(a.cantidad) || 0) * (Number(a.precio_unitario) || 0)), 0);
                  const editTotalIva = Math.round(editTotalNeto * 1.19);
                  const editSaldoOc = editTotalNeto - editArticulos.reduce((sum, a) => sum + ((Number(a.cantidad_recepcionada) || 0) * (Number(a.precio_unitario) || 0)), 0);
                  return (
                    <div style={{
                      marginTop: '16px',
                      padding: '14px 18px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '12px',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Total Neto</span>
                        <strong style={{ fontSize: '1.05rem', color: '#f8fafc' }}>${editTotalNeto.toLocaleString('es-CL')}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>IVA (19%)</span>
                        <strong style={{ fontSize: '1.05rem', color: '#cbd5e1' }}>${(editTotalIva - editTotalNeto).toLocaleString('es-CL')}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Total con IVA</span>
                        <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>${editTotalIva.toLocaleString('es-CL')}</strong>
                      </div>
                      <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '14px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#10b981', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Saldo OC Pendiente</span>
                        <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>${editSaldoOc.toLocaleString('es-CL')}</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => !savingEdit && setEditingOc(null)}
                  disabled={savingEdit}
                  className="btn-secondary"
                  style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarEdicion}
                  disabled={savingEdit}
                  className="btn-primary"
                  style={{ 
                    padding: '10px 24px', 
                    fontSize: '0.85rem', 
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw size={15} className="spin-animation" /> Guardando Cambios...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Isolated Sub-component to manage single article row state lookup
const ArticleRow = ({ rowKey, row, onChange, onRemove, showRemove }) => {
  const { nombre, loading, exists } = useArsenalAutoSuggest(row.codigo);
  const isAssignedRed = !!row.yaAsignadoEnOc;

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

  const cant = Number(row.cantidad) || 0;
  const precioUnit = Number(row.precio_unitario) || 0;
  const subtotal = cant * precioUnit;

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '130px 1fr 90px 125px 125px auto', 
      gap: '12px', 
      alignItems: 'start',
      background: isAssignedRed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.01)',
      border: isAssignedRed ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-color)',
      padding: '14px',
      borderRadius: '8px',
      transition: 'all 0.2s ease'
    }}>
      <div>
        <label style={{ fontSize: '0.78rem', color: isAssignedRed ? '#f87171' : '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '600' }}>
          CÓDIGO {isAssignedRed && '⚠️'}
        </label>
        <input
          type="text"
          value={row.codigo}
          onChange={e => onChange(rowKey, 'codigo', e.target.value)}
          placeholder="Ej: 1227"
          className="input-field"
          style={{ borderColor: isAssignedRed ? 'rgba(239, 68, 68, 0.5)' : undefined }}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.78rem', color: isAssignedRed ? '#f87171' : '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '600' }}>NOMBRE / DESCRIPCIÓN</label>
        {row.codigo.trim() === '' ? (
          <div style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: '#64748b', fontSize: '0.85rem' }}>
            Ingrese código para buscar o registrar...
          </div>
        ) : loading ? (
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '9px 0' }}>Buscando en catálogo base...</div>
        ) : exists && nombre ? (
          <div style={{ padding: '9px 14px', background: isAssignedRed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: isAssignedRed ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.2)', color: isAssignedRed ? '#ef4444' : '#10b981', fontWeight: '600', fontSize: '0.88rem' }}>
            {nombre} {isAssignedRed ? '(Ya asignado previamente)' : '(Registrado)'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={13} /> El artículo no existe. Escriba el nombre para crearlo:
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

        {/* ALERTA EN ROJO CON EL NÚMERO DE OC ASIGNADA Y ROL DE ELIMINACIÓN */}
        {isAssignedRed && (
          <div style={{
            marginTop: '8px',
            padding: '5px 10px',
            background: 'rgba(239, 68, 68, 0.18)',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            fontSize: '0.78rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AlertTriangle size={13} color="#ef4444" /> Ya fue asignado previamente en la {row.yaAsignadoEnOc}
          </div>
        )}
      </div>

      <div>
        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '600' }}>CANTIDAD</label>
        <input
          type="number"
          value={row.cantidad}
          onChange={e => onChange(rowKey, 'cantidad', e.target.value)}
          placeholder="Ej: 100"
          className="input-field"
          min="1"
        />
      </div>

      <div>
        <label style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'block', marginBottom: '6px', fontWeight: '600' }}>PRECIO UNIT. ($)</label>
        <input
          type="number"
          value={row.precio_unitario !== undefined ? row.precio_unitario : ''}
          onChange={e => onChange(rowKey, 'precio_unitario', e.target.value)}
          placeholder="Ej: 1500"
          className="input-field"
          min="0"
          step="any"
        />
      </div>

      <div>
        <label style={{ fontSize: '0.78rem', color: '#60a5fa', display: 'block', marginBottom: '6px', fontWeight: '600' }}>SUBTOTAL NETO</label>
        <div style={{
          padding: '9px 12px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
          color: '#93c5fd',
          fontWeight: '700',
          fontSize: '0.85rem',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          ${subtotal.toLocaleString('es-CL')}
        </div>
      </div>

      {showRemove && (
        <button 
          onClick={() => onRemove(rowKey)} 
          className="btn-secondary" 
          style={{ 
            marginTop: '24px', 
            padding: '9px', 
            borderColor: 'rgba(239,68,68,0.2)', 
            color: '#ef4444',
            background: 'rgba(239,68,68,0.05)'
          }}
          title="Eliminar fila"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};

export default SeguimientoOCModule;
