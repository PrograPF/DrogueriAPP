import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
  Sparkles,
  RefreshCw,
  Settings,
  Sun,
  Moon,
  Check,
  FileText,
  User,
  ExternalLink
} from 'lucide-react';
import { qfService } from '../services/qfService';

const SEMANAS_CONFIG = [
  { id: 1, label: 'Semana 1', subtitulo: 'RECEPCIÓN CENABAST / CRÍTICOS Y PE LISTOS' },
  { id: 2, label: 'Semana 2', subtitulo: 'GESTIÓN SANITARIA: CONTROLADOS, VENCIMIENTOS Y FARMACOVIGILANCIA' },
  { id: 3, label: 'Semana 3', subtitulo: 'CALIDAD, INVENTARIO Y PLANIFICACIÓN DE RECEPCIÓN' },
  { id: 4, label: 'Semana 4', subtitulo: 'RECEPCIÓN DE CENABAST' }
];

const DIAS_LABORALES = [
  { id: 1, nombre: 'Lunes' },
  { id: 2, nombre: 'Martes' },
  { id: 3, nombre: 'Miércoles' },
  { id: 4, nombre: 'Jueves' },
  { id: 5, nombre: 'Viernes' }
];

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function QFCalendarioTareas() {
  // Estado de fecha actual: por defecto Noviembre 2026 (o el mes en curso)
  const [anio, setAnio] = useState(2026);
  const [mes, setMes] = useState(11); // 1-12
  const [semanaActiva, setSemanaActiva] = useState(1); // 1, 2, 3, 4 o 'PERIODICAS'

  // Datos de base de datos
  const [categorias, setCategorias] = useState([]);
  const [tareasMes, setTareasMes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Nombre de QF guardado en localStorage
  const [qfNombre, setQfNombre] = useState(localStorage.getItem('qf_usuario_activo') || 'QF Droguería');

  // Modal para Completar / Editar Registro de Tarea Mensual
  const [modalTarea, setModalTarea] = useState(null); // Tarea seleccionada para completar
  const [formEstado, setFormEstado] = useState('REALIZADA');
  const [formQf, setFormQf] = useState('');
  const [formComentario, setFormComentario] = useState('');
  const [guardandoTarea, setGuardandoTarea] = useState(false);

  // Modal de Gestión de Plantilla Maestra (CRUD de tareas)
  const [modalGestion, setModalGestion] = useState(false);
  const [plantillas, setPlantillas] = useState([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [editandoPlantilla, setEditandoPlantilla] = useState(null); // null para nuevo, objeto para editar
  const [formPlantilla, setFormPlantilla] = useState({
    semana: 1,
    dia_semana: 1,
    bloque: 'AM',
    categoria_codigo: 'REC',
    titulo: '',
    descripcion: '',
    registro_evidencia: '',
    normativa_ref: ''
  });

  // Modal para agregar tarea directa al mes activo
  const [modalNuevaTareaMes, setModalNuevaTareaMes] = useState(false);
  const [formNuevaMes, setFormNuevaMes] = useState({
    semana_mes: 1,
    dia_semana: 1,
    bloque: 'AM',
    categoria_codigo: 'REC',
    titulo: '',
    descripcion: ''
  });

  // Cargar categorías al inicio
  useEffect(() => {
    cargarCategorias();
  }, []);

  // Cargar tareas al cambiar de mes o año
  useEffect(() => {
    cargarTareasMes();
  }, [anio, mes]);

  const cargarCategorias = async () => {
    try {
      const cats = await qfService.getCategorias();
      setCategorias(cats);
    } catch (e) {
      console.error('Error al cargar categorías:', e);
    }
  };

  const cargarTareasMes = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await qfService.getTareasMes(anio, mes);
      setTareasMes(data);
    } catch (e) {
      console.error('Error al cargar tareas del mes:', e);
      setErrorMsg('No se pudieron cargar las tareas del mes.');
    } finally {
      setLoading(false);
    }
  };

  // Mapear colores de categorías
  const categoriaMap = useMemo(() => {
    const map = {};
    categorias.forEach(c => {
      map[c.codigo] = c;
    });
    return map;
  }, [categorias]);

  // Manejo de navegación de meses (Restricción: mínimo Octubre 2026)
  const puedeRetroceder = !(anio === 2026 && mes === 10);

  const retrocederMes = () => {
    if (!puedeRetroceder) return;
    if (mes === 1) {
      setAnio(anio - 1);
      setMes(12);
    } else {
      setMes(mes - 1);
    }
  };

  const avanzarMes = () => {
    if (mes === 12) {
      setAnio(anio + 1);
      setMes(1);
    } else {
      setMes(mes + 1);
    }
  };

  // Métricas y Avance
  const metricas = useMemo(() => {
    const total = tareasMes.length;
    const realizadas = tareasMes.filter(t => t.estado === 'REALIZADA').length;
    const pendientes = tareasMes.filter(t => t.estado === 'PENDIENTE').length;
    const noAplica = tareasMes.filter(t => t.estado === 'NO_APLICA').length;
    
    // El porcentaje considera solo las aplicables (total - noAplica)
    const aplicables = total - noAplica;
    const porcentaje = aplicables > 0 ? Math.round((realizadas / aplicables) * 100) : 0;

    return { total, realizadas, pendientes, noAplica, porcentaje };
  }, [tareasMes]);

  // Avance por cada semana
  const metricasPorSemana = useMemo(() => {
    const map = {};
    [1, 2, 3, 4].forEach(s => {
      const tareasSem = tareasMes.filter(t => !t.es_periodica && t.semana_mes === s);
      const total = tareasSem.length;
      const realizadas = tareasSem.filter(t => t.estado === 'REALIZADA').length;
      const noAplica = tareasSem.filter(t => t.estado === 'NO_APLICA').length;
      const aplicables = total - noAplica;
      const pct = aplicables > 0 ? Math.round((realizadas / aplicables) * 100) : 0;
      map[s] = { total, realizadas, pct };
    });
    return map;
  }, [tareasMes]);

  // Tareas filtradas para la vista activa
  const tareasDeLaSemana = useMemo(() => {
    if (semanaActiva === 'PERIODICAS') {
      return tareasMes.filter(t => t.es_periodica);
    }
    return tareasMes.filter(t => !t.es_periodica && t.semana_mes === semanaActiva);
  }, [tareasMes, semanaActiva]);

  // Tareas diarias de la semana activa ("Todos los días")
  const tareasDiarias = useMemo(() => {
    if (semanaActiva === 'PERIODICAS') return [];
    return tareasDeLaSemana.filter(t => t.bloque === 'DIARIO');
  }, [tareasDeLaSemana, semanaActiva]);

  // Abrir modal para marcar/editar tarea
  const abrirModalCompletar = (tarea) => {
    setModalTarea(tarea);
    setFormEstado(tarea.estado || 'REALIZADA');
    setFormQf(tarea.realizado_por || qfNombre);
    setFormComentario(tarea.comentario || '');
  };

  const guardarCambiosTarea = async () => {
    if (!modalTarea) return;
    setGuardandoTarea(true);
    try {
      const updates = {
        estado: formEstado,
        realizado_por: formEstado === 'REALIZADA' ? (formQf || qfNombre) : null,
        fecha_realizacion: formEstado === 'REALIZADA' ? new Date().toISOString() : null,
        comentario: formComentario
      };

      const actualizada = await qfService.updateTareaRegistro(modalTarea.id, updates);

      // Actualizar en el estado local
      setTareasMes(prev => prev.map(t => (t.id === actualizada.id ? actualizada : t)));

      // Guardar nombre preferido
      if (formQf) {
        setQfNombre(formQf);
        localStorage.setItem('qf_usuario_activo', formQf);
      }

      setModalTarea(null);
    } catch (e) {
      console.error('Error al guardar estado de la tarea:', e);
      alert('Error al guardar los cambios de la tarea.');
    } finally {
      setGuardandoTarea(false);
    }
  };

  // Gestión de Plantilla Maestra
  const abrirModalGestion = async () => {
    setModalGestion(true);
    setLoadingPlantillas(true);
    try {
      const data = await qfService.getPlantillaTareas();
      setPlantillas(data);
    } catch (e) {
      console.error('Error al cargar plantilla:', e);
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const guardarTareaPlantilla = async (e) => {
    e.preventDefault();
    try {
      if (editandoPlantilla) {
        const updated = await qfService.updateTareaPlantilla(editandoPlantilla.id, formPlantilla);
        setPlantillas(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      } else {
        const created = await qfService.createTareaPlantilla({
          ...formPlantilla,
          activo: true
        });
        setPlantillas(prev => [...prev, created]);
      }
      setEditandoPlantilla(null);
      setFormPlantilla({
        semana: 1,
        dia_semana: 1,
        bloque: 'AM',
        categoria_codigo: 'REC',
        titulo: '',
        descripcion: '',
        registro_evidencia: '',
        normativa_ref: ''
      });
      // Recargar tareas del mes actual para reflejar cambios
      cargarTareasMes();
    } catch (err) {
      console.error('Error al guardar tarea en plantilla:', err);
      alert('Error al guardar la tarea en la plantilla.');
    }
  };

  const eliminarTareaPlantilla = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta tarea de la plantilla maestra?')) return;
    try {
      await qfService.deleteTareaPlantilla(id);
      setPlantillas(prev => prev.filter(p => p.id !== id));
      cargarTareasMes();
    } catch (err) {
      console.error('Error al eliminar tarea de la plantilla:', err);
    }
  };

  // Agregar Tarea Directa al Mes
  const guardarTareaMesDirecta = async (e) => {
    e.preventDefault();
    try {
      const nueva = await qfService.addTareaMesDirecta({
        anio,
        mes,
        semana_mes: formNuevaMes.semana_mes,
        dia_semana: formNuevaMes.dia_semana,
        bloque: formNuevaMes.bloque,
        categoria_codigo: formNuevaMes.categoria_codigo,
        titulo: formNuevaMes.titulo,
        descripcion: formNuevaMes.descripcion,
        estado: 'PENDIENTE',
        es_periodica: false,
        orden: 99
      });
      setTareasMes(prev => [...prev, nueva]);
      setModalNuevaTareaMes(false);
      setFormNuevaMes({
        semana_mes: semanaActiva === 'PERIODICAS' ? 1 : semanaActiva,
        dia_semana: 1,
        bloque: 'AM',
        categoria_codigo: 'REC',
        titulo: '',
        descripcion: ''
      });
    } catch (err) {
      console.error('Error al agregar tarea directa:', err);
      alert('No se pudo agregar la tarea al mes.');
    }
  };

  // Renderizador de cada tarjeta de tarea
  const renderCardTarea = (tarea) => {
    const cat = categoriaMap[tarea.categoria_codigo] || {
      nombre: tarea.categoria_codigo || 'General',
      color: '#3b82f6',
      color_bg: 'rgba(59, 130, 246, 0.15)'
    };

    const esRealizada = tarea.estado === 'REALIZADA';
    const esNoAplica = tarea.estado === 'NO_APLICA';

    return (
      <div
        key={tarea.id}
        onClick={() => abrirModalCompletar(tarea)}
        style={{
          padding: '12px',
          borderRadius: '12px',
          border: esRealizada 
            ? '1px solid rgba(16, 185, 129, 0.4)' 
            : esNoAplica 
            ? '1px dashed var(--border-color)' 
            : '1px solid var(--border-color)',
          background: esRealizada 
            ? 'rgba(16, 185, 129, 0.05)' 
            : esNoAplica 
            ? 'rgba(255, 255, 255, 0.02)' 
            : 'var(--input-bg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        {/* Categoría Badge y Estado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: '800',
            padding: '2px 8px',
            borderRadius: '6px',
            background: cat.color_bg,
            color: cat.color,
            border: `1px solid ${cat.color}40`,
            letterSpacing: '0.04em'
          }}>
            {tarea.categoria_codigo || 'QF'}
          </span>

          <span style={{
            fontSize: '0.72rem',
            fontWeight: '700',
            padding: '2px 6px',
            borderRadius: '6px',
            background: esRealizada ? 'rgba(16, 185, 129, 0.2)' : esNoAplica ? 'rgba(255, 255, 255, 0.05)' : 'rgba(245, 158, 11, 0.15)',
            color: esRealizada ? '#10b981' : esNoAplica ? 'var(--text-secondary)' : '#f59e0b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {esRealizada ? <Check size={12} /> : null}
            {tarea.estado}
          </span>
        </div>

        {/* Título de la Tarea */}
        <div style={{
          fontSize: '0.85rem',
          fontWeight: '600',
          lineHeight: '1.35',
          color: esNoAplica ? 'var(--text-secondary)' : 'var(--text-primary)',
          textDecoration: esNoAplica ? 'line-through' : 'none'
        }}>
          {tarea.titulo}
        </div>

        {/* Información de cumplimiento (QF y Fecha) */}
        {esRealizada && tarea.realizado_por && (
          <div style={{
            fontSize: '0.72rem',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '2px'
          }}>
            <CheckCircle2 size={12} />
            <span>{tarea.realizado_por}</span>
            {tarea.fecha_realizacion && (
              <span style={{ opacity: 0.8 }}>
                · {new Date(tarea.fecha_realizacion).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* Indicador de Comentarios */}
        {tarea.comentario && (
          <div style={{
            fontSize: '0.75rem',
            color: '#3b82f6',
            background: 'rgba(59, 130, 246, 0.08)',
            padding: '4px 8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            marginTop: '2px'
          }}>
            <MessageSquare size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tarea.comentario}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* 1. BARRA SUPERIOR: SELECTOR DE MES, PROGRESO GLOBAL Y BOTONES DE GESTIÓN */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '20px 24px', 
          borderRadius: '16px', 
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Navegador de Mes y Año */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <Calendar size={22} />
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Control Mensual de Tareas QF
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  {MESES_NOMBRES[mes - 1]} {anio}
                </h2>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={retrocederMes}
                    disabled={!puedeRetroceder}
                    title={puedeRetroceder ? 'Mes anterior' : 'El registro histórico inicia en Octubre 2026'}
                    style={{
                      padding: '6px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: puedeRetroceder ? 'var(--text-primary)' : 'var(--text-secondary)',
                      opacity: puedeRetroceder ? 1 : 0.4,
                      cursor: puedeRetroceder ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={avanzarMes}
                    title="Mes siguiente"
                    style={{
                      padding: '6px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Profesional QF Activo y Acciones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px'
            }}>
              <User size={16} color="#3b82f6" />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>QF Activo:</span>
              <input
                type="text"
                value={qfNombre}
                onChange={(e) => {
                  setQfNombre(e.target.value);
                  localStorage.setItem('qf_usuario_activo', e.target.value);
                }}
                placeholder="Nombre del QF"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  fontSize: '0.86rem',
                  outline: 'none',
                  width: '140px'
                }}
              />
            </div>

            <button
              onClick={() => setModalNuevaTareaMes(true)}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 15px',
                fontSize: '0.86rem',
                borderRadius: '10px'
              }}
            >
              <Plus size={16} /> Tarea Adicional
            </button>

            <button
              onClick={abrirModalGestion}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 15px',
                fontSize: '0.86rem',
                borderRadius: '10px'
              }}
            >
              <Settings size={16} /> Plantilla Maestra
            </button>

            <button
              onClick={cargarTareasMes}
              title="Recargar mes"
              style={{
                padding: '9px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Barra de Progreso y Métricas del Mes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Cumplimiento Global:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${metricas.porcentaje}%`,
                  background: metricas.porcentaje >= 80 ? '#10b981' : metricas.porcentaje >= 40 ? '#f59e0b' : '#3b82f6',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
              <span style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {metricas.porcentaje}%
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Realizadas:</span>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {metricas.realizadas} de {metricas.total - metricas.noAplica}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pendientes:</span>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {metricas.pendientes} tareas
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94a3b8' }} />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No Aplica:</span>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {metricas.noAplica} tareas
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PESTAÑAS DE SEMANAS Y PERIÓDICAS */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {SEMANAS_CONFIG.map(sem => {
          const m = metricasPorSemana[sem.id] || { total: 0, realizadas: 0, pct: 0 };
          const esActiva = semanaActiva === sem.id;
          return (
            <button
              key={sem.id}
              onClick={() => setSemanaActiva(sem.id)}
              style={{
                flex: '1 1 200px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: esActiva ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                background: esActiva ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                color: esActiva ? '#3b82f6' : 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '800', fontSize: '0.98rem' }}>{sem.label}</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: m.pct >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: m.pct >= 80 ? '#10b981' : 'var(--text-secondary)'
                }}>
                  {m.pct}%
                </span>
              </div>
              <div style={{
                fontSize: '0.73rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.3',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {sem.subtitulo}
              </div>
            </button>
          );
        })}

        {/* Pestaña de Tareas Periódicas */}
        <button
          onClick={() => setSemanaActiva('PERIODICAS')}
          style={{
            flex: '0 0 180px',
            padding: '14px 16px',
            borderRadius: '12px',
            border: semanaActiva === 'PERIODICAS' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
            background: semanaActiva === 'PERIODICAS' ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-card)',
            color: semanaActiva === 'PERIODICAS' ? '#a78bfa' : 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '800', fontSize: '0.98rem' }}>Periódicas</span>
            <Sparkles size={16} />
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
            Simulacros / Anuales
          </div>
        </button>
      </div>

      {/* 3. CONTENIDO PRINCIPAL: VISTA DE LA SEMANA SELECCIONADA */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <RefreshCw size={32} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '12px', fontSize: '0.95rem' }}>Cargando tareas del mes...</p>
        </div>
      ) : semanaActiva === 'PERIODICAS' ? (
        /* VISTA DE TAREAS PERIÓDICAS */
        <div 
          className="glass-card"
          style={{
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Tareas Periódicas Asignadas a {MESES_NOMBRES[mes - 1]}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Actividades con frecuencia trimestral, semestral o anual correspondientes a este mes.
              </p>
            </div>
          </div>

          {tareasDeLaSemana.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No hay tareas periódicas programadas específicamente para {MESES_NOMBRES[mes - 1]}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {tareasDeLaSemana.map(t => renderCardTarea(t))}
            </div>
          )}
        </div>
      ) : (
        /* VISTA SEMANAL (LUNES A VIERNES + TAREAS DIARIAS) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Fila / Tarjeta "Todos los días (Diario)" de la semana activa */}
          {tareasDiarias.length > 0 && (
            <div 
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', fontWeight: '700', fontSize: '0.85rem' }}>
                <Clock size={16} /> Tareas Diarias Continuas (Todos los días de esta semana):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tareasDiarias.map(td => (
                  <div 
                    key={td.id}
                    onClick={() => abrirModalCompletar(td)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--bg-card)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: td.estado === 'REALIZADA' ? '#10b981' : 'transparent',
                        border: td.estado === 'REALIZADA' ? 'none' : '2px solid var(--border-color)',
                        color: '#ffffff'
                      }}>
                        {td.estado === 'REALIZADA' && <Check size={16} />}
                      </div>
                      <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {td.titulo}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {td.comentario && <MessageSquare size={16} color="#3b82f6" title={td.comentario} />}
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: td.estado === 'REALIZADA' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                        color: td.estado === 'REALIZADA' ? '#10b981' : 'var(--text-secondary)'
                      }}>
                        {td.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grilla de 5 Columnas (Lunes a Viernes) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            alignItems: 'start'
          }}>
            {DIAS_LABORALES.map(dia => {
              // Tareas AM para este día
              const tareasAM = tareasDeLaSemana.filter(t => t.dia_semana === dia.id && t.bloque === 'AM');
              // Tareas PM para este día
              const tareasPM = tareasDeLaSemana.filter(t => t.dia_semana === dia.id && t.bloque === 'PM');
              
              // Fecha estimada del día si está disponible
              const fechaDia = tareasAM[0]?.fecha_programada || tareasPM[0]?.fecha_programada;
              const fechaFormateada = fechaDia ? fechaDia.split('-').slice(1).reverse().join('/') : '';

              return (
                <div 
                  key={dia.id}
                  className="glass-card"
                  style={{
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                >
                  {/* Encabezado del Día */}
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {dia.nombre}
                    </span>
                    {fechaFormateada && (
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                        {fechaFormateada}
                      </span>
                    )}
                  </div>

                  {/* Cuerpo del Día: AM y PM */}
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* BLOQUE AM */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase' }}>
                        <Sun size={14} /> Mañana (AM)
                      </div>
                      {tareasAM.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px', background: 'var(--input-bg)', borderRadius: '8px', textAlign: 'center', fontStyle: 'italic' }}>
                          Sin tarea específica
                        </div>
                      ) : (
                        tareasAM.map(t => renderCardTarea(t))
                      )}
                    </div>

                    {/* BLOQUE PM */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase' }}>
                        <Moon size={14} /> Tarde (PM)
                      </div>
                      {tareasPM.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px', background: 'var(--input-bg)', borderRadius: '8px', textAlign: 'center', fontStyle: 'italic' }}>
                          Sin tarea específica
                        </div>
                      ) : (
                        tareasPM.map(t => renderCardTarea(t))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. MODAL: COMPLETAR / MODIFICAR ESTADO Y COMENTARIOS DE TAREA */}
      <AnimatePresence>
        {modalTarea && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card"
              style={{
                width: '100%',
                maxWidth: '540px',
                borderRadius: '20px',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
            >
              {/* Header Modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: categoriaMap[modalTarea.categoria_codigo]?.color_bg || 'rgba(59, 130, 246, 0.15)',
                    color: categoriaMap[modalTarea.categoria_codigo]?.color || '#3b82f6'
                  }}>
                    {modalTarea.categoria_codigo} · {categoriaMap[modalTarea.categoria_codigo]?.nombre || 'General'}
                  </span>
                  <h3 style={{ margin: '10px 0 0 0', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Registro de Cumplimiento
                  </h3>
                </div>
                <button
                  onClick={() => setModalTarea(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Título y detalles de la tarea */}
              <div style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                fontSize: '0.92rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                lineHeight: '1.5'
              }}>
                {modalTarea.titulo}
                {modalTarea.registro_evidencia && (
                  <div style={{ fontSize: '0.78rem', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    <strong>Registro / Evidencia:</strong> {modalTarea.registro_evidencia}
                  </div>
                )}
                {modalTarea.normativa_ref && (
                  <div style={{ fontSize: '0.78rem', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <strong>Normativa:</strong> {modalTarea.normativa_ref}
                  </div>
                )}
              </div>

              {/* Selector de Estado */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                  Estado de la Tarea:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { id: 'REALIZADA', label: 'Realizada ✓', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
                    { id: 'PENDIENTE', label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
                    { id: 'NO_APLICA', label: 'No Aplica', color: '#94a3b8', bg: 'rgba(255, 255, 255, 0.08)' }
                  ].map(est => (
                    <button
                      key={est.id}
                      type="button"
                      onClick={() => setFormEstado(est.id)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '10px',
                        border: formEstado === est.id ? `2px solid ${est.color}` : '1px solid var(--border-color)',
                        background: formEstado === est.id ? est.bg : 'var(--input-bg)',
                        color: formEstado === est.id ? est.color : 'var(--text-secondary)',
                        fontWeight: '700',
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {est.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profesional QF Responsable */}
              {formEstado === 'REALIZADA' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                    Profesional QF que realizó la tarea:
                  </label>
                  <input
                    type="text"
                    value={formQf}
                    onChange={(e) => setFormQf(e.target.value)}
                    placeholder="Ej: QF Juan Pérez"
                    className="input-field"
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              )}

              {/* Comentarios / Observaciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                  Comentario / Observación Técnica (Opcional):
                </label>
                <textarea
                  rows={3}
                  value={formComentario}
                  onChange={(e) => setFormComentario(e.target.value)}
                  placeholder="Ej: Se completó verificación de stock y Data Logger sin alertas de temperatura..."
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalTarea(null)}
                  className="btn-secondary"
                  style={{ padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarCambiosTarea}
                  disabled={guardandoTarea}
                  className="btn-primary"
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Save size={16} /> {guardandoTarea ? 'Guardando...' : 'Guardar Registro'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. MODAL: GESTIÓN DE PLANTILLA MAESTRA (CRUD COMPLETO) */}
      <AnimatePresence>
        {modalGestion && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card"
              style={{
                width: '100%',
                maxWidth: '960px',
                maxHeight: '90vh',
                overflowY: 'auto',
                borderRadius: '20px',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
              }}
            >
              {/* Header Modal Gestión */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Plantilla Maestra de Tareas QF
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                    Modifica o agrega tareas maestras. Estas se usan automáticamente para los calendarios de cada mes.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setModalGestion(false);
                    setEditandoPlantilla(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={22} />
                </button>
              </div>

              {/* Formulario de Agregar / Editar Tarea en la Plantilla */}
              <form 
                onSubmit={guardarTareaPlantilla}
                style={{
                  padding: '20px',
                  borderRadius: '14px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#3b82f6' }}>
                  {editandoPlantilla ? '✏️ Editar Tarea de la Plantilla' : '➕ Crear Nueva Tarea en la Plantilla'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Semana del Mes:</label>
                    <select
                      value={formPlantilla.semana}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, semana: parseInt(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', marginTop: '4px' }}
                    >
                      <option value={1}>Semana 1</option>
                      <option value={2}>Semana 2</option>
                      <option value={3}>Semana 3</option>
                      <option value={4}>Semana 4</option>
                      <option value={0}>Periódica (Anual/Semestral)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Día:</label>
                    <select
                      value={formPlantilla.dia_semana || ''}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, dia_semana: e.target.value ? parseInt(e.target.value) : null })}
                      className="input-field"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', marginTop: '4px' }}
                    >
                      <option value="">Todos los días (Diario)</option>
                      <option value={1}>Lunes</option>
                      <option value={2}>Martes</option>
                      <option value={3}>Miércoles</option>
                      <option value={4}>Jueves</option>
                      <option value={5}>Viernes</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Horario / Bloque:</label>
                    <select
                      value={formPlantilla.bloque}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, bloque: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', marginTop: '4px' }}
                    >
                      <option value="AM">Mañana (AM)</option>
                      <option value="PM">Tarde (PM)</option>
                      <option value="DIARIO">Continuo / Diario</option>
                      <option value="PERIODICA">Periódica del Mes</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Categoría:</label>
                    <select
                      value={formPlantilla.categoria_codigo}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, categoria_codigo: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', marginTop: '4px' }}
                    >
                      {categorias.map(c => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Título / Descripción de la Tarea:</label>
                  <input
                    type="text"
                    required
                    value={formPlantilla.titulo}
                    onChange={(e) => setFormPlantilla({ ...formPlantilla, titulo: e.target.value })}
                    placeholder="Ej: Bajar info Data Logger / Revisión QFs: T° y H%..."
                    className="input-field"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  {editandoPlantilla && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoPlantilla(null);
                        setFormPlantilla({
                          semana: 1,
                          dia_semana: 1,
                          bloque: 'AM',
                          categoria_codigo: 'REC',
                          titulo: '',
                          descripcion: '',
                          registro_evidencia: '',
                          normativa_ref: ''
                        });
                      }}
                      className="btn-secondary"
                      style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      Cancelar Edición
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    {editandoPlantilla ? 'Guardar Cambios' : 'Agregar a la Plantilla'}
                  </button>
                </div>
              </form>

              {/* Lista de Tareas Existentes en la Plantilla */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Tareas Configuradas ({plantillas.length})
                </div>

                {loadingPlantillas ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Cargando tareas...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                    {plantillas.map(p => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-color)',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: categoriaMap[p.categoria_codigo]?.color_bg || 'rgba(255,255,255,0.08)',
                            color: categoriaMap[p.categoria_codigo]?.color || '#3b82f6'
                          }}>
                            {p.categoria_codigo}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                            {p.semana === 0 ? 'Periódica' : `Sem ${p.semana}`} · {p.dia_semana ? DIAS_LABORALES.find(d => d.id === p.dia_semana)?.nombre : 'Diario'} · {p.bloque}
                          </span>
                          <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                            {p.titulo}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => {
                              setEditandoPlantilla(p);
                              setFormPlantilla({
                                semana: p.semana,
                                dia_semana: p.dia_semana,
                                bloque: p.bloque,
                                categoria_codigo: p.categoria_codigo,
                                titulo: p.titulo,
                                descripcion: p.descripcion || '',
                                registro_evidencia: p.registro_evidencia || '',
                                normativa_ref: p.normativa_ref || ''
                              });
                            }}
                            title="Editar tarea"
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => eliminarTareaPlantilla(p.id)}
                            title="Eliminar tarea"
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'transparent',
                              color: '#ef4444',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL: AGREGAR TAREA DIRECTA AL MES EN CURSO */}
      <AnimatePresence>
        {modalNuevaTareaMes && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card"
              style={{
                width: '100%',
                maxWidth: '500px',
                borderRadius: '20px',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Agregar Tarea a {MESES_NOMBRES[mes - 1]} {anio}
                </h3>
                <button
                  onClick={() => setModalNuevaTareaMes(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={guardarTareaMesDirecta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Semana:</label>
                    <select
                      value={formNuevaMes.semana_mes}
                      onChange={(e) => setFormNuevaMes({ ...formNuevaMes, semana_mes: parseInt(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', marginTop: '4px' }}
                    >
                      <option value={1}>Semana 1</option>
                      <option value={2}>Semana 2</option>
                      <option value={3}>Semana 3</option>
                      <option value={4}>Semana 4</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Día:</label>
                    <select
                      value={formNuevaMes.dia_semana}
                      onChange={(e) => setFormNuevaMes({ ...formNuevaMes, dia_semana: parseInt(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', marginTop: '4px' }}
                    >
                      <option value={1}>Lunes</option>
                      <option value={2}>Martes</option>
                      <option value={3}>Miércoles</option>
                      <option value={4}>Jueves</option>
                      <option value={5}>Viernes</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Horario:</label>
                    <select
                      value={formNuevaMes.bloque}
                      onChange={(e) => setFormNuevaMes({ ...formNuevaMes, bloque: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', marginTop: '4px' }}
                    >
                      <option value="AM">Mañana (AM)</option>
                      <option value="PM">Tarde (PM)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Categoría:</label>
                    <select
                      value={formNuevaMes.categoria_codigo}
                      onChange={(e) => setFormNuevaMes({ ...formNuevaMes, categoria_codigo: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', marginTop: '4px' }}
                    >
                      {categorias.map(c => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Título de la Tarea:</label>
                  <input
                    type="text"
                    required
                    value={formNuevaMes.titulo}
                    onChange={(e) => setFormNuevaMes({ ...formNuevaMes, titulo: e.target.value })}
                    placeholder="Descripción de la tarea adicional..."
                    className="input-field"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalNuevaTareaMes(false)}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    Agregar al Mes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
